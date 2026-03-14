## GenAI Hackathon Project

This repository contains a full-stack GenAI application with a **React + Vite frontend** and a **Python backend** for model serving, retrieval, and data/graph processing.

- **Frontend**: `frontend/` (React + Vite SPA)
- **Backend**: `backend/` (Python API + GenAI logic)
- **Environment**: configuration via `.env` / `.env.example`
- **Orchestration**: optional `docker-compose.yml` to run services together

### Key Features

- **GenAI-powered backend**: Python service that can host LLM calls, vector search, and graph-based reasoning.
- **Modern React frontend**: Vite-powered dev server for fast iteration during the hackathon.
- **Configurable via env**: secrets and endpoints are managed via `.env`.
- **Optional containers**: run everything locally or via Docker Compose.

### Tech Stack

- **Frontend**: React, Vite, TypeScript/JavaScript, modern tooling via `npm`.
- **Backend**: Python 3.10+, typical stack (FastAPI/Flask-style API + data/graph utilities).
- **Infra / Tooling**: Docker, Docker Compose (optional), `.env`-based configuration.

### Prerequisites

- Node.js (LTS recommended)
- Python 3.10+ (or the version you use for the hackathon)
- `pip` / `venv` (or another Python environment manager)
- Docker & Docker Compose (optional, if you want to use containers)

### Backend Setup & Run

1. **Create and activate a virtual environment**:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
```

2. **Install dependencies**:

```bash
pip install -r requirements.txt
```

3. **Set up environment variables**:

- Copy `.env.example` from the repo root to `.env` (and adjust values), or
- Provide the required variables directly in your environment.

4. **Run the backend API** (example, adjust to your actual entrypoint/command):

```bash
cd backend
python -m api.main
```

If you are using a framework like FastAPI or Flask, adapt the run command accordingly (for example):

```bash
uvicorn backend.api.main:app --reload
```

### Frontend Setup & Run

1. **Install dependencies**:

```bash
cd frontend
npm install
```

2. **Run the dev server**:

```bash
npm run dev
```

3. **Open the app**:

Open the printed local URL (usually `http://localhost:5173`) in your browser.

### Using Docker Compose (Optional)

If `docker-compose.yml` is configured for your services, you can bring everything up with:

```bash
docker compose up --build
```

Then open the frontend URL shown in the logs. Check the compose file for exposed ports and service names.

### Data & Graph Utilities

The `backend/data/` and `backend/graph/` directories contain helper scripts for dataset generation and graph loading:

- `backend/data/generate_data.py` – dataset generation utilities.
- `backend/data/graph_builder.py` – graph construction helpers.
- `backend/graph/neo4j_loader.py` – example Neo4j graph loading utilities.

Adjust and run these as needed for your specific GenAI use case (for example, building knowledge graphs or augmenting LLM responses).

### Project Structure (High Level)

```text
GenAI-Hackathon/
├─ frontend/          # React + Vite app (UI)
├─ backend/           # Python backend (API, models, data utilities)
├─ docker-compose.yml # Optional container orchestration
├─ .env.example       # Example environment configuration
└─ README.md          # This file
```

### Development Workflow

- **Iterate quickly**: run backend and frontend locally, point the frontend to the local API URL in `.env`.
- **Use feature branches**: create a branch per feature or experiment.
- **Keep commits focused**: small, descriptive commits help during the hackathon crunch.

### Contributing / Hacking on This Repo

- **Branching**: create a feature branch for your change.
- **Coding style**: follow existing patterns in `frontend/` and `backend/`.
- **Commits**: keep them small and focused with descriptive messages.

Feel free to adapt this README as the project evolves during the hackathon.

