#!/usr/bin/env bash
# Run EvalOS with NO Docker, NO Postgres, NO Redis, NO MinIO: SQLite + local files + inline tasks.
# Needs: python3 (3.10+), node 18+ (only to build the frontend once).
#   ./run_lite.sh            -> http://localhost:8000
#   PORT=9000 ./run_lite.sh  -> custom port
# Optional OCR for scanned PDFs: install the `tesseract-ocr` system package.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8000}"

if [ ! -d .lite-venv ]; then
  python3 -m venv .lite-venv
fi
.lite-venv/bin/pip install -q -r backend/requirements.txt

if [ ! -f dist/index.html ] || [ -n "${REBUILD:-}" ]; then
  npm install --no-audit --no-fund
  VITE_API_URL=/api/v1 npm run build
fi

mkdir -p data
export EVALOS_LITE=1 STORAGE_BACKEND=local
export DATABASE_URL="sqlite:///$(pwd)/data/evalos.db"
export LOCAL_STORAGE_DIR="$(pwd)/data/uploads"
export FRONTEND_DIST_DIR="$(pwd)/dist"

echo ">> EvalOS lite on http://localhost:${PORT}   (API docs: /docs)"
cd backend
exec ../.lite-venv/bin/uvicorn main:app --host 0.0.0.0 --port "${PORT}"
