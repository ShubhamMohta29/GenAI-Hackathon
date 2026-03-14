#!/bin/bash
echo "============================================"
echo "  FRAUD GRAPH MONITOR - Setup"
echo "============================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 not found. Please install Python 3.10+ from https://python.org"
    exit 1
fi
echo "[OK] Python found: $(python3 --version)"

# Check Node
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi
echo "[OK] Node.js found: $(node --version)"

echo ""
echo "[1/3] Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo ""
echo "[2/3] Installing Python dependencies..."
pip install -r backend/requirements.txt

echo ""
echo "[3/3] Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "============================================"
echo "  Setup complete!"
echo "  Run 'bash run.sh' to start the application."
echo "============================================"