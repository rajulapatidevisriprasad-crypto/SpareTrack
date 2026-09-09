#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SpareTrack — Startup Script
# Usage: bash run.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$DIR/backend"
VENV="$BACKEND/venv"

echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   SpareTrack v2.0                               ║"
echo "  ║   Billing · Inventory · Customers · Reports      ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""

# ── Python setup ──────────────────────────────────────────────────────────────
if [ ! -d "$VENV" ]; then
  echo "[Setup] Creating Python virtual environment..."
  python3 -m venv "$VENV"
fi

echo "[Setup] Installing Python dependencies..."
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q flask flask-cors reportlab openpyxl

# ── Start Flask ───────────────────────────────────────────────────────────────
echo "[Flask] Starting server on http://localhost:5000 ..."
cd "$BACKEND"
"$VENV/bin/python3" app.py &
FLASK_PID=$!

# ── Wait ──────────────────────────────────────────────────────────────────────
echo -n "[Flask] Waiting..."
for i in $(seq 1 30); do
  if curl -s http://localhost:5000/ > /dev/null 2>&1; then echo " Ready!"; break; fi
  echo -n "."; sleep 0.5
done
echo ""

# ── Start Electron or browser ─────────────────────────────────────────────────
cd "$DIR"
if [ -d "node_modules" ] || command -v npx &>/dev/null; then
  echo "[Electron] Launching desktop app..."
  npx electron . 2>/dev/null || echo "[Info] Electron not available"
fi

# Fallback: open browser
if ! pgrep -f "electron" > /dev/null 2>&1; then
  echo "[Browser] Opening http://localhost:5000"
  command -v xdg-open &>/dev/null && xdg-open http://localhost:5000 || true
  command -v open &>/dev/null && open http://localhost:5000 || true
fi

trap "echo 'Stopping...'; kill $FLASK_PID 2>/dev/null" EXIT
wait $FLASK_PID
