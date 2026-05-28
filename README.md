# 🔍 ARGUS — AML Investigation Dashboard

A real-time Anti-Money Laundering (AML) fraud investigation platform built with a Graph Neural Network (GNN) and Google Gemini AI. FraudLink scores 9 million accounts for fraud risk, detects suspicious transaction clusters, and generates AI-powered Suspicious Activity Reports (SARs) on demand.

Sponsored Prize Category: TD

---

## Demo

> On load, the dashboard shows a live overview graph of the highest-value flagged transactions across the dataset. Click any node, any account from the **Alerts** panel, or any ring from **Clusters** to drill into its 1-hop transaction network and generate an AI investigation report.

---

## How It Works

1. **Data** — Uses the [PaySim dataset](https://www.kaggle.com/datasets/ealaxi/paysim1) (~6M simulated mobile money transactions).
2. **GNN Model** — A 3-layer GraphSAGE network trained on the transaction graph to assign a fraud risk score (0–1) to every account node.
3. **Backend** — A FastAPI server loads the pre-computed risk scores and the PaySim CSV at startup. It serves an overview fraud graph, per-account graphs, risk tiers, and suspicious cluster data — no database required.
4. **AI Reports** — Google Gemini 2.5 Flash Lite generates structured Suspicious Activity Reports (SARs) for any account or cluster, citing exact dollar amounts and timestamps.
5. **Frontend** — A React + Vite dashboard renders the live transaction graph using `react-force-graph-2d`, with a real-time WebSocket feed of incoming transactions.

---

## Project Structure

```
GenAI-Hackathon/
├── backend/
│   ├── api/
│   │   └── main.py             # FastAPI server
│   ├── data/
│   │   ├── generate_data.py    # Kaggle dataset downloader
│   │   └── raw_data/           # PaySim CSV goes here (not in git)
│   ├── graph/
│   │   └── neo4j_loader.py     # Optional Neo4j graph loader
│   ├── model/
│   │   ├── dataset.py          # Builds PyTorch Geometric graph from CSV
│   │   ├── gnn.py              # FraudGNN model definition (GraphSAGE)
│   │   ├── train.py            # Training script
│   │   ├── fraud_gnn.pt        # Trained model weights (not in git)
│   │   └── scores.json         # Pre-computed risk scores (not in git)
│   ├── .env                    # API keys (not in git)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main dashboard component
│   │   ├── main.jsx
│   │   └── index.css
│   └── package.json
├── .env.example
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

Create a `backend/.env` file (see `.env.example` for the template):

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Download the dataset

```bash
cd backend/data
python generate_data.py
```

This downloads and extracts the PaySim CSV from Kaggle into `data/raw_data/`.

### 4. Train the GNN (or skip if weights are provided)

```bash
cd backend/model
python train.py
```

This trains for 200 epochs and outputs:
- `model/fraud_gnn.pt` — model weights
- `model/scores.json` — risk score for every account

> Training on 100k rows takes ~5 minutes on CPU. Remove `sample_size=100000` in `train.py` for the full dataset.

### 5. Start the backend

```bash
cd backend/api
uvicorn main:app --host 0.0.0.0 --port 8000
```

The server loads `scores.json` and the CSV at startup, then pre-computes risk tiers, suspicious clusters, and the overview graph. First boot takes ~30–60 seconds.

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Running on a Local Network (Demo Setup)

The model server runs on one machine and all teammates connect to it.

**On the host machine**, find your local IP:
```bash
ipconfig   # Windows
ifconfig   # Mac/Linux
```

**On client machines**, set the API URL before starting the frontend:
```bash
VITE_API_URL=http://<host-ip>:8000 npm run dev
```

Make sure port `8000` is allowed through the host machine's firewall.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/alerts` | Top 20 highest-risk accounts |
| `GET` | `/accounts/high` | All accounts with risk > 0.7 |
| `GET` | `/accounts/medium` | All accounts with risk 0.4–0.7 |
| `GET` | `/accounts/low` | Count of low-risk accounts |
| `GET` | `/graph/overview` | Pre-computed graph of top 400 fraud transactions (dashboard default) |
| `GET` | `/graph/{account_id}` | 1-hop transaction network for an account |
| `GET` | `/profile/{account_id}` | AI-generated SAR for an account |
| `GET` | `/rings` | Top 20 suspicious transaction clusters |
| `GET` | `/profile/ring/{ring_id}` | AI-generated SAR for a cluster |
| `WS` | `/ws/live` | WebSocket stream of simulated live transactions |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| ML Model | PyTorch, PyTorch Geometric (GraphSAGE) |
| AI Reports | Google Gemini 2.5 Flash Lite |
| Backend | FastAPI, Pandas, NetworkX |
| Frontend | React, Vite, react-force-graph-2d |
| Dataset | PaySim (Kaggle) |

---

## What's Not in This Repo

The following are excluded via `.gitignore` due to size or sensitivity:

- `backend/model/fraud_gnn.pt` — trained model weights
- `backend/model/scores.json` — 9M account risk scores (~large)
- `backend/data/raw_data/` — PaySim CSV (~500MB)
- `backend/.env` — API keys

---

## Team

Built at GenAI Genesis · 13-15 March 2026
