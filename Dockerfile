# EvalOS "lite" image -- ONE free container: FastAPI + built frontend + SQLite + local files.
# No Postgres / Redis / MinIO / Celery worker needed. See DEPLOY_FREE.md.
# (The multi-service production stack is unchanged: docker-compose.yml + backend/Dockerfile.)

# ---- 1. build the frontend with a same-origin API base ---------------------------------
FROM node:20-alpine AS web
WORKDIR /app
ENV VITE_API_URL=/api/v1
COPY package*.json ./
RUN npm install
COPY index.html vite.config.js ./
COPY src ./src
ENV VITE_API_URL=/api/v1
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
RUN npm install
RUN npm run build

# ---- 2. backend + static frontend ---------------------------------------------------------
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# uid 1000: required by Hugging Face Spaces, harmless elsewhere
RUN useradd -m -u 1000 user
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend ./backend
COPY --from=web /app/dist ./dist
RUN chown -R user:user /app
USER user

ENV PYTHONPATH=/app/backend \
    EVALOS_LITE=1 \
    DATABASE_URL=sqlite:////tmp/evalos.db \
    STORAGE_BACKEND=local \
    LOCAL_STORAGE_DIR=/tmp/uploads \
    FRONTEND_DIST_DIR=/app/dist \
    PORT=7860

WORKDIR /app/backend
EXPOSE 7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
