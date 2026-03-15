# Argus — Hackathon Submission Write-Up

---

## Project Inspiration

Financial fraud is one of the most damaging and fastest-growing problems faced by banks and their customers. According to industry estimates, billions of dollars are lost annually to money laundering and fraudulent transactions — and traditional rule-based fraud detection systems are simply not fast enough or smart enough to keep up.

We wanted to build something that a fraud analyst at a bank like TD could use to tackle this problem. The core insight driving Argus is that fraud is a graph problem — money launderers don't act alone. They operate in rings, layering transactions across multiple accounts to obscure the origin of funds. A rule-based system looking at individual transactions in isolation will always miss this. A graph neural network, by contrast, can see the entire network of relationships and flag accounts whose *connections* make them suspicious, even if any single transaction looks clean.

We also recognized a second pain point: even when fraud is detected, analysts spend hours writing Suspicious Activity Reports (SARs) by hand — pulling transaction histories, identifying patterns, and writing structured reports for compliance. This is exactly the kind of synthesis task that generative AI excels at. By combining a trained GNN with Google Gemini, we can go from a flagged account ID to a complete, citation-backed SAR in seconds.

---

## Technology Stack

### Languages
- **Python** — GNN training pipeline, data processing, and backend API
- **JavaScript (JSX)** — React frontend dashboard

### Frameworks & Libraries

**Machine Learning**
- `PyTorch` — deep learning framework for model definition and training
- `PyTorch Geometric` — graph neural network extensions; specifically `SAGEConv` (GraphSAGE) layers
- `scikit-learn` — feature scaling (`StandardScaler`) and evaluation metrics (precision, recall, F1)
- `NumPy` / `Pandas` — data loading, preprocessing, and feature engineering

**Backend**
- `FastAPI` — high-performance async REST API and WebSocket server
- `Uvicorn` — ASGI server
- `NetworkX` — graph construction and connected component detection for ring/cluster analysis
- `python-dotenv` — environment variable management

**AI / Generative**
- `Google Gemini 2.5 Flash Lite` (`google-genai` SDK) — generates structured Suspicious Activity Reports (SARs) from transaction summaries

**Frontend**
- `React` + `Vite` — UI framework and build tooling
- `react-force-graph-2d` — real-time force-directed transaction graph visualization
- Native `WebSocket` API — live transaction feed

### Platforms
- **Kaggle** — source of the PaySim financial transaction dataset (accessed via Kaggle API). Trained model leveraging Nvidia CUDA cloud hardware
- **Google AI Studio** — Gemini API access

### Tools
- `kaggle` Python SDK — automated dataset download
- VS Code — development environment
- Git / GitHub — version control and submission

---

## Product Summary

**Argus** is a real-time AML (Anti-Money Laundering) investigation dashboard that combines a custom-trained Graph Neural Network with Google Gemini AI to help fraud analysts identify, investigate, and report suspicious financial activity.

### What it does

**1. GNN-Powered Risk Scoring**
At its core, Argus trains a 3-layer GraphSAGE network on the PaySim dataset — a simulation of 6+ million mobile money transactions across ~9 million unique accounts. The model treats accounts as nodes and transactions as edges, engineering node features from transaction volume and counts. After training, it produces a fraud risk score between 0 and 1 for every account in the dataset.

**2. Real-Time Investigation Dashboard**
The React frontend gives analysts a live, interactive view of the fraud landscape:
- **Alerts panel** — top 20 highest-risk accounts, ranked by GNN score, clickable to investigate
- **Live feed** — a real-time WebSocket stream of simulated incoming transactions, flagging suspicious ones as they arrive
- **Force-directed graph** — clicking any account renders its 1-hop transaction neighborhood as an interactive graph, with nodes colored by risk tier (red = high, amber = medium, green = selected, teal = low) and edges colored by fraud flag

**3. Suspicious Cluster Detection**
Beyond individual accounts, Argus automatically detects *transaction rings* — groups of interconnected accounts that collectively move large sums through flagged transactions. These clusters are surfaced in the Clusters panel, ranked by total dollar volume.

**4. AI-Generated Suspicious Activity Reports**
The most innovative feature: clicking any account or cluster triggers a call to Google Gemini 2.5 Flash, which receives a structured transaction summary and returns a complete SAR in seconds. The report includes:
- **Typology** (Money Mule, Layering, Smurfing, Shell Account, etc.)
- **Severity** (Critical / High / Medium / Low)
- **Summary** — one-sentence core suspicion
- **Red Flags** — bulleted list of specific behavioral indicators
- **Transaction Pattern** — narrative with exact dates, times, and dollar amounts
- **Connected Entities** — key counterparty account IDs
- **Recommended Action** — specific next step for the analyst

### Why it matters

Traditional fraud detection flags individual transactions. Argus flags *networks*. The GNN sees that an account is suspicious not because of what it did, but because of *who it transacted with and how*. Combined with Gemini's ability to synthesize complex transaction data into actionable compliance reports, Argus reduces the time from detection to documented investigation from hours to seconds.

---

*Built at GenAI Genesis · 13-15 March 2026
