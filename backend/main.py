from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from core.config import get_settings

settings = get_settings()

app = FastAPI(title="EvalOS Backend API", version="1.0.0")

# CORS for frontend — configure via CORS_ORIGINS env var in production.
# The wildcard-with-credentials combination is invalid (browsers reject it);
# we list explicit origins instead.
_cors_origins_raw = __import__("os").environ.get(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
)
_cors_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,   # No cookie/token auth yet — keep False
    allow_methods=["*"],
    allow_headers=["*"],
)

class DocumentResponse(BaseModel):
    id: str
    filename: str
    status: str
    pageCount: Optional[int] = None

# Global state for health reporting
APP_STATE = {"db_ready": True}

@app.get("/health")
def health_check():
    return {
        "status": "healthy" if APP_STATE["db_ready"] else "degraded", 
        "service": "EvalOS API",
        "db_ready": APP_STATE["db_ready"]
    }

from api.v1.api import api_router

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.on_event("startup")
def provision_golden_path_assessment():
    """
    Ensure the real golden-path assessment (Q01-Q06) exists in PostgreSQL on
    boot. If the DB is unreachable, we set db_ready=False to fail health checks.
    """
    import logging
    from core.database import SessionLocal
    from core.seed_data import ensure_golden_path_assessment

    logger = logging.getLogger(__name__)

    if settings.EVALOS_LITE:
        from core.database import engine
        from models import Base
        Base.metadata.create_all(bind=engine)
        logger.info("EVALOS_LITE: tables created from models")

    db = SessionLocal()
    try:
        assessment = ensure_golden_path_assessment(db)
        logger.info(f"Golden-path assessment ready: {assessment.title} ({assessment.id})")
        APP_STATE["db_ready"] = True
    except Exception as e:
        logger.error(f"CRITICAL: Could not provision DB on startup: {e}")
        APP_STATE["db_ready"] = False
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Free / lite deployment: serve the built frontend from the same origin, so a single
# container gives one public URL and the browser needs no separate API host (no CORS,
# no VITE_API_URL juggling). Registered LAST so /api/v1, /health and /docs win.
# Only active when FRONTEND_DIST_DIR points at an existing build.
# ---------------------------------------------------------------------------
import os as _os
if settings.FRONTEND_DIST_DIR and _os.path.isdir(settings.FRONTEND_DIST_DIR):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=settings.FRONTEND_DIST_DIR, html=True), name="frontend")
