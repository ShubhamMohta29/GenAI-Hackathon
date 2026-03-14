import json
import os
import asyncio
import random

import pandas as pd
import networkx as nx
from google import genai
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# ── Load environment ─────────────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

app = FastAPI(title="Fraud Graph Monitor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load Data at Startup (No Neo4j required!) ────────────────────
BASE = os.path.dirname(__file__)
SCORES_PATH = os.path.join(BASE, "..", "model", "scores.json")
CSV_PATH = os.path.join(BASE, "..", "data", "raw_data", "PS_20174392719_1491204439457_log.csv")

# Load the 9-million-account risk scores
with open(SCORES_PATH) as f:
    SCORES: dict[str, float] = json.load(f)

# Load the PaySim transactions into Pandas (sampling for speed on Mac)
# We load a reasonable subset for the API to serve graph data quickly
print("Loading PaySim CSV for API...")
DF = pd.read_csv(CSV_PATH, nrows=500_000)
print(f"Loaded {len(DF):,} transactions for API graph serving.")

# ── Pre-compute risk tiers ───────────────────────────────────────
HIGH_RISK = sorted(
    [{"account_id": k, "risk_score": v} for k, v in SCORES.items() if v > 0.7],
    key=lambda x: -x["risk_score"],
)
MEDIUM_RISK = sorted(
    [{"account_id": k, "risk_score": v} for k, v in SCORES.items() if 0.4 < v <= 0.7],
    key=lambda x: -x["risk_score"],
)
LOW_RISK_COUNT = sum(1 for v in SCORES.values() if v <= 0.4)

print(f"Risk tiers → High: {len(HIGH_RISK):,}  Medium: {len(MEDIUM_RISK):,}  Low: {LOW_RISK_COUNT:,}")

# ── Gemini LLM Client ───────────────────────────────────────────
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# ── Fraud Ring Detection (pre-computed) ──────────────────────────
print("Detecting fraud rings...")
G = nx.DiGraph()

# Build graph from transactions flagged as fraud in the dataset
# OR where at least one endpoint is a high/medium-risk account
fraud_tx = DF[DF["isFraud"] == 1]
for _, row in fraud_tx.iterrows():
    src, dst = row["nameOrig"], row["nameDest"]
    G.add_edge(src, dst, amount=row["amount"], tx_type=row["type"])

# Find connected components (treat as undirected for ring detection)
RINGS = []
for component in nx.connected_components(G.to_undirected()):
    if len(component) >= 2:
        ring_accounts = [
            {"account_id": aid, "risk_score": SCORES.get(aid, 0.0)}
            for aid in component
        ]
        ring_accounts.sort(key=lambda x: -x["risk_score"])
        total_amount = sum(
            G.edges[e].get("amount", 0)
            for e in G.edges
            if e[0] in component and e[1] in component
        )
        RINGS.append({
            "size": len(component),
            "total_amount": round(total_amount, 2),
            "accounts": ring_accounts,
        })

RINGS.sort(key=lambda x: -x["total_amount"])
print(f"Found {len(RINGS)} fraud rings.")


# ══════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@app.get("/graph")
def get_graph():
    """Return nodes + edges from the loaded CSV with risk scores attached."""
    # Build unique nodes from transactions
    all_ids = set(DF["nameOrig"].unique()) | set(DF["nameDest"].unique())
    nodes = [
        {
            "id": nid,
            "is_fraud": SCORES.get(nid, 0.0) > 0.7,
            "risk_score": SCORES.get(nid, 0.0),
        }
        for nid in list(all_ids)[:2000]  # cap for frontend performance
    ]

    # Build edges only between the included nodes
    node_ids = {n["id"] for n in nodes}
    edges = [
        {
            "src": row["nameOrig"],
            "dst": row["nameDest"],
            "amount": row["amount"],
            "is_fraud": bool(row["isFraud"]),
        }
        for _, row in DF.iterrows()
        if row["nameOrig"] in node_ids and row["nameDest"] in node_ids
    ]

    return {"nodes": nodes, "edges": edges}


@app.get("/alerts")
def get_alerts():
    """Top 20 highest-risk accounts."""
    return HIGH_RISK[:20]


@app.get("/accounts/high")
def get_high_risk():
    """All accounts with risk > 0.7."""
    return {"tier": "high", "threshold": "> 0.7", "count": len(HIGH_RISK), "accounts": HIGH_RISK[:200]}


@app.get("/accounts/medium")
def get_medium_risk():
    """All accounts with risk between 0.4 and 0.7."""
    return {"tier": "medium", "threshold": "0.4 - 0.7", "count": len(MEDIUM_RISK), "accounts": MEDIUM_RISK[:200]}


@app.get("/accounts/low")
def get_low_risk():
    """Summary of low-risk accounts (too many to list)."""
    return {"tier": "low", "threshold": "≤ 0.4", "count": LOW_RISK_COUNT}


@app.get("/rings")
def get_fraud_rings():
    """Detected fraud rings — clusters of connected high-risk accounts."""
    return {"total_rings": len(RINGS), "rings": RINGS[:20]}


@app.get("/profile/{account_id}")
async def get_account_profile(account_id: str):
    """Generate an AI-powered fraud investigation profile using Google Gemini."""
    risk_score = SCORES.get(account_id, None)
    if risk_score is None:
        return {"error": f"Account {account_id} not found in scores."}

    # Pull all transactions for this account from the CSV
    sent = DF[DF["nameOrig"] == account_id]
    received = DF[DF["nameDest"] == account_id]

    # Build transaction summary
    summary_lines = [
        f"Account ID: {account_id}",
        f"GNN Risk Score: {risk_score:.4f}",
        f"Risk Tier: {'HIGH' if risk_score > 0.7 else 'MEDIUM' if risk_score > 0.4 else 'LOW'}",
        f"",
        f"OUTGOING TRANSACTIONS ({len(sent)} total):",
        f"  Total sent: ${sent['amount'].sum():,.2f}" if len(sent) > 0 else "  No outgoing transactions",
        f"  Avg amount: ${sent['amount'].mean():,.2f}" if len(sent) > 0 else "",
        f"  Transaction types: {dict(sent['type'].value_counts())}" if len(sent) > 0 else "",
        f"  Recipients: {sent['nameDest'].nunique()} unique accounts" if len(sent) > 0 else "",
        f"",
        f"INCOMING TRANSACTIONS ({len(received)} total):",
        f"  Total received: ${received['amount'].sum():,.2f}" if len(received) > 0 else "  No incoming transactions",
        f"  Avg amount: ${received['amount'].mean():,.2f}" if len(received) > 0 else "",
        f"  Transaction types: {dict(received['type'].value_counts())}" if len(received) > 0 else "",
        f"  Senders: {received['nameOrig'].nunique()} unique accounts" if len(received) > 0 else "",
        f"",
        f"FRAUD FLAGS IN RAW DATA:",
        f"  Outgoing flagged as fraud: {int(sent['isFraud'].sum())}" if len(sent) > 0 else "  None",
        f"  Incoming flagged as fraud: {int(received['isFraud'].sum())}" if len(received) > 0 else "  None",
    ]

    # Top 5 largest transactions
    all_tx = pd.concat([
        sent[["nameDest", "amount", "type", "isFraud"]].rename(columns={"nameDest": "counterparty"}).assign(direction="SENT"),
        received[["nameOrig", "amount", "type", "isFraud"]].rename(columns={"nameOrig": "counterparty"}).assign(direction="RECEIVED"),
    ])
    if len(all_tx) > 0:
        top5 = all_tx.nlargest(5, "amount")
        summary_lines.append("")
        summary_lines.append("TOP 5 LARGEST TRANSACTIONS:")
        for _, tx in top5.iterrows():
            flag = " ⚠ FRAUD" if tx["isFraud"] else ""
            summary_lines.append(
                f"  {tx['direction']} ${tx['amount']:,.2f} ({tx['type']}) → {tx['counterparty']}{flag}"
            )

    transaction_summary = "\n".join(summary_lines)

    # Send to Gemini for analysis
    prompt = f"""You are a fraud analyst at TD Bank. Generate a concise Suspicious Activity Report (SAR) 
for the following account flagged by our GNN fraud detection system.

{transaction_summary}

Respond in EXACTLY this format (keep each section SHORT — 1-2 lines max, bullets max 8 words each):

TYPOLOGY: [One of: Money Mule | Layering | Smurfing | Shell Account | Bust-Out | Clean]
SEVERITY: [CRITICAL / HIGH / MEDIUM / LOW]
SUMMARY: [One sentence, max 20 words, explaining the core suspicion]

RED FLAGS:
• [flag 1]
• [flag 2]
• [flag 3]
(max 5 flags)

TRANSACTION PATTERN: [2-3 sentences describing the money flow]

CONNECTED ENTITIES: [List key counterparty account IDs and their role]

RECOMMENDED ACTION: [One specific next step]

Be specific — cite dollar amounts and account IDs from the data. No filler text.
If the account is clean (low risk, no flags), state: "No suspicious activity detected." and stop."""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
        )
        profile_text = response.text
    except Exception as e:
        profile_text = f"Error generating profile: {str(e)}"

    return {
        "account_id": account_id,
        "risk_score": risk_score,
        "risk_tier": "HIGH" if risk_score > 0.7 else "MEDIUM" if risk_score > 0.4 else "LOW",
        "transactions_sent": len(sent),
        "transactions_received": len(received),
        "total_sent": round(float(sent["amount"].sum()), 2) if len(sent) > 0 else 0,
        "total_received": round(float(received["amount"].sum()), 2) if len(received) > 0 else 0,
        "profile": profile_text,
    }


@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    """Simulate a live transaction feed using REAL PaySim rows + GNN risk scores."""
    await ws.accept()
    try:
        while True:
            row = DF.sample(1).iloc[0]
            dst_score = SCORES.get(row["nameDest"], 0.0)
            event = {
                "type": row["type"],
                "src": row["nameOrig"],
                "dst": row["nameDest"],
                "amount": round(float(row["amount"]), 2),
                "risk_score": dst_score,
                "flagged": dst_score > 0.7,
            }
            await ws.send_json(event)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass