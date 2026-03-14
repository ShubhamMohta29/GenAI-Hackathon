import json
import os
import asyncio
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASSWORD"))
)

SCORES_PATH = os.path.join(os.path.dirname(__file__), "..", "model", "scores.json")
with open(SCORES_PATH) as f:
    SCORES = json.load(f)

@app.get("/graph")
def get_graph():
    with driver.session() as s:
        nodes_result = s.run("MATCH (a:Account) RETURN a")
        nodes = []
        for r in nodes_result:
            a = r["a"]
            nid = a["id"]
            nodes.append({
                "id": nid,
                "is_fraud": a.get("is_fraud", False),
                "risk_score": SCORES.get(nid, 0.0)
            })

        edges_result = s.run("""
            MATCH (src:Account)-[tx:SENT]->(dst:Account)
            RETURN src.id AS src, dst.id AS dst,
                   tx.amount AS amount, tx.is_fraud AS is_fraud
        """)
        edges = [
            {
                "src": r["src"],
                "dst": r["dst"],
                "amount": r["amount"],
                "is_fraud": r["is_fraud"]
            }
            for r in edges_result
        ]

    return {"nodes": nodes, "edges": edges}

@app.get("/alerts")
def get_alerts():
    alerts = [
        {"account_id": nid, "risk_score": score}
        for nid, score in SCORES.items()
        if score > 0.7
    ]
    alerts.sort(key=lambda x: -x["risk_score"])
    return alerts[:20]

@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    await ws.accept()
    account_ids = list(SCORES.keys())
    try:
        while True:
            src, dst = random.sample(account_ids, 2)
            event = {
                "type": "transaction",
                "src": src,
                "dst": dst,
                "amount": round(random.uniform(50, 9999), 2),
                "risk_score": SCORES.get(dst, 0.0),
                "flagged": SCORES.get(dst, 0.0) > 0.7
            }
            await ws.send_json(event)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass