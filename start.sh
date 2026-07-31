#!/usr/bin/env bash

echo "========================================================================="
echo "                   HOME LAN SHARE - STARTUP LAUNCHER"
echo "========================================================================="
echo ""

# Find Python 3
if command -v python3 &>/dev/null; then
    PY_CMD="python3"
elif command -v python &>/dev/null; then
    PY_CMD="python"
else
    echo "[ERROR] Python 3 is not installed on this system."
    echo "Please install Python 3 from https://www.python.org/downloads/"
    exit 1
fi

# Create virtual environment if missing
if [ ! -d ".venv" ]; then
    echo "[1/3] Creating virtual environment (.venv)..."
    $PY_CMD -m venv .venv
fi

# Activate & install dependencies
echo "[2/3] Checking dependencies..."
source .venv/bin/activate
pip install --quiet -r requirements.txt

# Open default browser
echo "[3/3] Opening browser at http://localhost:5000 ..."
if command -v open &>/dev/null; then
    open "http://localhost:5000"
elif command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:5000"
fi

echo ""
echo "========================================================================="
echo " SERVER IS RUNNING! Press Ctrl+C to stop."
echo "========================================================================="
echo ""

python share_server.py
