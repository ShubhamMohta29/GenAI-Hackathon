#!/bin/bash
echo "============================================"
echo "  ARGUS — Starting..."
echo "============================================"
echo ""

# Activate venv
source venv/bin/activate

echo "[1/2] Starting FastAPI backend on http://localhost:8000 ..."

if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"' && source venv/bin/activate && cd backend/api && python -m uvicorn main:app --reload --port 8000"'
else
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd $(pwd) && source venv/bin/activate && cd backend/api && python -m uvicorn main:app --reload --port 8000; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -e "cd $(pwd) && source venv/bin/activate && cd backend/api && python -m uvicorn main:app --reload --port 8000" &
    else
        echo "[!] Could not detect terminal. Run this manually in a new terminal:"
        echo "    source venv/bin/activate && cd backend/api && python -m uvicorn main:app --reload --port 8000"
    fi
fi

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
