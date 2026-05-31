# ARGUS — AML Investigation Dashboard

A real-time Anti-Money Laundering (AML) fraud investigation platform built with a Graph Neural Network (GNN) and Google Gemini AI. Argus scores accounts for fraud risk, detects suspicious transaction clusters, and generates AI-powered Suspicious Activity Reports (SARs) on demand.

Sponsored Prize Category: TD

---

## Demo

> On load, the dashboard shows a live overview graph of the highest-value flagged transactions. Click any node, any account from the **Alerts** panel, or any ring from **Clusters** to drill into its 1-hop transaction network and generate an AI investigation report.

---

## How It Works

1. **Data** — Uses the [PaySim dataset](https://www.kaggle.com/datasets/ealaxi/paysim1) (~6M simulated mobile money transactions).
2. **GNN Model** — A 3-layer GraphSAGE network trained on the transaction graph assigns a fraud risk score (0–1) to every account node.
3. **Backend** — A FastAPI server loads pre-computed risk scores and the PaySim CSV at startup. Serves an overview fraud graph, per-account graphs, risk tiers, and suspicious cluster data — no database required.
4. **AI Reports** — Google Gemini 2.5 Flash Lite generates structured Suspicious Activity Reports (SARs) for any account or cluster, citing exact dollar amounts and timestamps.
5. **Frontend** — A React + Vite dashboard renders the live transaction graph using `react-force-graph-2d`, with a real-time WebSocket feed of incoming transactions.

---

## Features

- **Live transaction feed** — WebSocket stream of real PaySim rows, flagged by GNN risk score
- **Force-directed graph** — Color-coded by risk tier (red/amber/green), custom canvas renderer with glow and risk % badges
- **Account search** — Search any account ID directly from the right panel
- **Multi-hop graph expand** — "Expand network" button merges a node's neighbors into the current graph without replacing the view
- **AI SAR generation** — Gemini-generated reports with typology, severity, red flags, transaction pattern, and recommended action
- **SAR caching** — Gemini responses cached client-side for 5 minutes to avoid redundant API calls
- **Case status tagging** — Mark accounts as CLEARED, ESCALATED, or FLAGGED; persisted in localStorage, shown as badges on alert cards
- **SAR export** — "Export" button prints the report as a clean page (hides the graph and panels)
- **Cluster detection** — NetworkX connected components on fraud edges; AI ring-level SARs

---

## Project Structure

```
GenAI-Hackathon/
├── backend/
│   ├── api/
│   │   └── main.py             # FastAPI server — all active endpoints
│   ├── data/
│   │   ├── generate_data.py    # Kaggle dataset downloader
│   │   └── raw_data/           # PaySim CSV goes here (gitignored, ~500MB)
│   ├── model/
│   │   ├── dataset.py          # Builds PyTorch Geometric graph from CSV
│   │   ├── gnn.py              # FraudGNN model definition (3-layer GraphSAGE)
│   │   ├── train.py            # Training script
│   │   ├── fraud_gnn.pt        # Trained model weights (gitignored)
│   │   └── scores.json         # Pre-computed risk scores (gitignored)
│   ├── .env                    # API keys (gitignored)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main dashboard component
│   │   ├── main.jsx            # React entry point
│   │   └── index.css           # All layout and component styles
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
├── run.bat / run.sh            # Launch both servers
├── setup.bat / setup.sh        # First-time setup
└── README.md
```

---

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Kaggle API token](https://www.kaggle.com/docs/api) (`~/.kaggle/kaggle.json`)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

### 1. Clone & install Python dependencies

```bash
git clone https://github.com/your-username/GenAI-Hackathon.git
cd GenAI-Hackathon
pip install -r backend/requirements.txt
```

### 2. Set up environment variables

Create `backend/.env` (see `.env.example`):

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Download the dataset

```bash
python backend/data/generate_data.py
```

This downloads and extracts the PaySim CSV from Kaggle into `backend/data/raw_data/`.

> **Prerequisite:** Place your Kaggle API token at `~/.kaggle/kaggle.json`. Get it from your [Kaggle account settings](https://www.kaggle.com/settings/account).

### 4. Train the GNN

```bash
cd backend/model
python train.py
```

Trains for 200 epochs and outputs:
- `model/fraud_gnn.pt` — model weights
- `model/scores.json` — risk score for every account in the training sample

> Training on the default 100k-row sample takes ~5 minutes on CPU. Remove `sample_size=100000` in `train.py` (line 15) and `dataset.py` (line 24) to train on the full dataset (~6M rows, much longer).

### 5. Start the servers

**Windows:**
```
run.bat
```

**Mac / Linux:**
```bash
bash run.sh
```

Or manually:

```bash
# Backend
cd backend/api
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Docker

```bash
docker-compose up --build
```

Requires `backend/.env` (with `GEMINI_API_KEY`), `backend/model/scores.json`, `backend/model/fraud_gnn.pt`, and `backend/data/raw_data/` to be present on the host (all gitignored, generated by the setup steps above).

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/alerts` | Top 20 highest-risk accounts |
| `GET` | `/accounts/high` | All accounts with risk > 0.7 |
| `GET` | `/accounts/medium` | All accounts with risk 0.4–0.7 |
| `GET` | `/accounts/low` | Count of low-risk accounts |
| `GET` | `/graph/overview` | Pre-computed graph of top 400 fraud transactions |
| `GET` | `/graph/{account_id}` | 1-hop transaction network for an account |
| `GET` | `/profile/ring/{ring_id}` | AI-generated SAR for a cluster |
| `GET` | `/profile/{account_id}` | AI-generated SAR for an account |
| `GET` | `/rings` | Top 20 suspicious transaction clusters |
| `WS` | `/ws/live` | WebSocket stream of simulated live transactions |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| ML Model | PyTorch 2.10, PyTorch Geometric 2.7 (GraphSAGE) |
| AI Reports | Google Gemini 2.5 Flash Lite (`google-genai` SDK) |
| Backend | FastAPI 0.135, Uvicorn, Pandas, NetworkX |
| Frontend | React 19, Vite 8, react-force-graph-2d |
| Dataset | PaySim (Kaggle: ealaxi/paysim1) |

---

## What's Not in This Repo

The following are excluded via `.gitignore` due to size or sensitivity:

- `backend/model/fraud_gnn.pt` — trained model weights
- `backend/model/scores.json` — account risk scores
- `backend/data/raw_data/` — PaySim CSV (~500MB)
- `backend/.env` — API keys

---

## Team

Built at GenAI Genesis · 13–15 March 2026
