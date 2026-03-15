#!/bin/bash
echo "============================================"
echo "  FRAUD GRAPH MONITOR - Starting..."
echo "============================================"
echo ""
echo "[!] Make sure Neo4j Desktop is open and your database is STARTED."
echo "    Press Enter once Neo4j is running..."
read

# Activate venv
source venv/bin/activate

echo ""
echo "[1/2] Starting FastAPI backend on http://localhost:8000 ..."

# Detect OS to open a new terminal window
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS — open a new Terminal window
    osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"' && source venv/bin/activate && cd backend/api && python -m uvicorn main:app --reload --port 8000"'
else
    # Linux — try common terminal emulators
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd $(pwd) && source venv/bin/activate && cd backend/api && python -m uvicorn main:app --reload --port 8000; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -e "cd $(pwd) && source venv/bin/activate && cd backend/api && python -m uvicorn main:app --reload --port 8000" &
    else
        echo "[!] Could not detect terminal. Run this manually in a new terminal:"
        echo "    source venv/bin/activate && cd backend/api && python -m uvicorn main:app --reload --port 8000"
    fi
fi

# Wait for backend to start
sleep 3

echo "[2/2] Starting React frontend on http://localhost:5173 ..."

if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/frontend && npm run dev"'
else
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd $(pwd)/frontend && npm run dev; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -e "cd $(pwd)/frontend && npm run dev" &
    else
        echo "[!] Could not detect terminal. Run this manually in a new terminal:"
        echo "    cd frontend && npm run dev"
    fi
fi

echo ""
echo "============================================"
echo "  Both servers are starting!"
echo "  Open http://localhost:5173 in your browser"
echo "============================================"