# ◈ Fraud Graph Monitor

A real-time financial fraud detection system built with a Graph Neural Network (GNN) and an interactive graph visualization dashboard.

Transactions are modelled as a directed graph — accounts are nodes, payments are edges — and a GraphSAGE neural network assigns each account a fraud risk score by learning from the structure of who sends money to whom.

---

## Demo

- 🔴 **Red nodes** = high fraud risk (>80%)
- 🟠 **Orange nodes** = elevated risk (>50%)
- 🟡 **Yellow nodes** = moderate risk (>30%)
- 🟢 **Green nodes** = low risk
- Click **Flagged** or **High Risk** cards to highlight all matching accounts in the graph
- Click any live transaction to zoom to the involved nodes
- Click any fraud alert to locate that account in the graph

---

## Architecture

```
PaySim Dataset (Kaggle)
        ↓
  Data Pipeline          → builds PyTorch Geometric graph
        ↓
  GNN Training           → GraphSAGE (3-layer), outputs per-node risk scores
        ↓
  Neo4j Graph DB         → stores accounts + transactions
        ↓
  FastAPI Backend        → /graph, /alerts, /ws/live (WebSocket)
        ↓
  React Frontend         → force-directed graph + live feed dashboard
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| ML Model | PyTorch Geometric (GraphSAGE) |
| Dataset | PaySim (Kaggle `ealaxi/paysim1`) |
| Graph DB | Neo4j |
| Backend | FastAPI + Uvicorn |
| Frontend | React + Vite + react-force-graph-2d |

---

## Project Structure

```
GenAI-Hackathon/
├── backend/
│   ├── api/
│   │   └── main.py           # FastAPI app (graph, alerts, WebSocket)
│   ├── data/
│   │   ├── generate_data.py  # Kaggle dataset downloader
│   │   ├── dataset.py        # PyG graph builder
│   │   └── load_neo4j.py     # Neo4j loader
│   ├── model/
│   │   ├── gnn.py            # FraudGNN model definition
│   │   ├── train.py          # Training script
│   │   ├── fraud_gnn.pt      # Trained model weights (generated)
│   │   └── scores.json       # Per-account risk scores (generated)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main dashboard component
│   │   ├── main.jsx          # React entry point
│   │   └── index.css
│   └── package.json
└── .env                      # Neo4j credentials (not committed)
```

---

## Setup & Installation

### Prerequisites

Before running anything, install the following:

- [Python 3.10+](https://python.org)
- [Node.js 18+](https://nodejs.org)
- [Neo4j Desktop](https://neo4j.com/download/) — create a local database and start it
- [Kaggle API token](https://www.kaggle.com/docs/api) — place `kaggle.json` at `~/.kaggle/kaggle.json`

---

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/GenAI-Hackathon.git
cd GenAI-Hackathon
```

---

### 2. Configure environment variables

Create a `backend/.env` file with your Neo4j credentials:

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password_here
```

---

### 3. Run setup (installs all dependencies)

**Windows:**
```bash
setup.bat
```

**Mac/Linux:**
```bash
chmod +x setup.sh run.sh
bash setup.sh
```

This will automatically create a virtual environment and install all Python and Node dependencies.

---

### 4. Train the model & load Neo4j

```bash
# Activate venv first
# Windows:   venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

cd backend/model
python train.py

cd ../data
python load_neo4j.py
```

Training uses 100,000 rows by default for speed. Remove `sample_size=100000` in `train.py` to use the full 6M-row dataset.

---

### 5. Start the app

**Windows:**
```bash
run.bat
```

**Mac/Linux:**
```bash
bash run.sh
```

This opens the backend and frontend in separate terminal windows automatically. Then open `http://localhost:5173` in your browser.

---

## How the Model Works

The dataset (PaySim) simulates mobile money transactions with labelled fraud cases. Fraud is heavily concentrated in `TRANSFER` and `CASH_OUT` transaction types.

**Node features (per account):**
- Number of transactions sent
- Total amount sent
- Number of transactions received
- Total amount received

**Edge features (per transaction):**
- Amount
- Old/new balances (origin and destination)
- Transaction type (one-hot encoded)

**Model:** 3-layer GraphSAGE with dropout, trained with weighted cross-entropy loss to handle class imbalance (fraud accounts are ~0.3% of the dataset).

**Output:** A risk score (0–1) per account, saved to `scores.json` and served by the API.

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/graph` | GET | All account nodes and transaction edges |
| `/alerts` | GET | Top 20 highest risk accounts |
| `/ws/live` | WebSocket | Streams simulated live transactions every 2s |

---

## .gitignore

Make sure these are excluded from your repo:

```
venv/
__pycache__/
*.pt
*.csv
raw_data/
.env
.DS_Store
node_modules/
dist/
```
