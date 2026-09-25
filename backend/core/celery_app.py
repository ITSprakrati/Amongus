import os
import sys

# Make `services`, `models`, `core` importable inside forked Celery workers regardless of
# the process's working directory / PYTHONPATH.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from celery import Celery
from kombu import Queue
from core.config import get_settings
import logging

settings = get_settings()
logger = logging.getLogger(__name__)

celery_app = Celery(
    "evalos_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.task_routes = {
    "tasks.document_processing.*": {"queue": "document_processing"},
    "tasks.ml.*": {"queue": "ml_tasks"}
}
# Declare every routed queue so a worker started WITHOUT `-Q` (as docker-compose does)
# consumes them; otherwise tasks routed to `document_processing` are never picked up.
celery_app.conf.task_queues = (
    Queue("celery"),
    Queue("document_processing"),
    Queue("ml_tasks"),
)

# Free/"lite" single-process mode: run tasks inline (no Redis / worker needed).
if settings.EVALOS_LITE:
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = False

@celery_app.task(name="tasks.document_processing.process_pdf")
def process_pdf_task(job_id: str, s3_path: str):
    """
    Background processing of PDFs with real Document Intelligence (PyMuPDF/OCR).
    """
    logger.info(f"Starting async processing for job: {job_id}, path: {s3_path}")
    from services.storage import storage
    from services.document_intelligence import get_document_intelligence
    from core.database import SessionLocal
    from models import ProcessingJob
    import tempfile
    
    import uuid
    job_uuid = uuid.UUID(str(job_id))
    db = SessionLocal()
    try:
        # 1. Download file from storage to memory
        file_bytes = storage.read_bytes(s3_path)

        # 2. Call real OCR / Document Intelligence provider
        doc_intel = get_document_intelligence()
        results = doc_intel.process_document(file_bytes)

        # 3. Update DB Status to READY with OCR results.
        #    NOTE: copy the JSON dict -- mutating and re-assigning the same object is not
        #    detected by SQLAlchemy (plain JSON column) and the update would silently be lost.
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_uuid).first()
        if job:
            job.status = "READY"
            current_data = dict(job.result_data or {})
            current_data["documentIntelligence"] = results
            # Flatten some stats for the frontend UI format
            pages = results.get("pages") or []
            conf = pages[0].get("confidence", 0.9) if pages else 0.0
            current_data["stats"] = {
                "ocrConfidence": f"{conf * 100:.1f}%",
                "pagesProcessed": results.get("metadata", {}).get("total_pages", len(pages))
            }
            job.result_data = current_data
            db.commit()

            # 4. Marking scheme -> real Assessment/Question rows (Item A). Honest UNAVAILABLE otherwise.
            if _is_marking_scheme(job.job_type):
                current_data = dict(job.result_data or {})
                current_data["parsing"] = _parse_marking_scheme_job(db, results, current_data.get("filename"))
                job.result_data = current_data
                db.commit()

        logger.info(f"Finished async processing for job: {job_id}")
    except Exception as e:
        import traceback
        logger.error(f"Async processing failed: {e}\n{traceback.format_exc()}")
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_uuid).first()
        if job:
            job.status = "FAILED"
            db.commit()
    finally:
        db.close()



def _is_marking_scheme(job_type) -> bool:
    return (job_type or "").replace("_", "").lower() == "markingscheme"


def _parse_marking_scheme_job(db, results: dict, filename) -> dict:
    """Run the parser on the OCR text. Never raises; never fabricates."""
    from services.marking_scheme_parser import parse_marking_scheme, persist_parsed_scheme
    try:
        meta = results.get("metadata", {}) or {}
        if meta.get("error") or meta.get("status") == "FALLBACK_DETERMINISTIC":
            return {"status": "UNAVAILABLE",
                    "reason": "Text extraction was unavailable or failed for this PDF"
                              + (f": {meta['error']}" if meta.get("error") else " (OCR libraries missing).")}
        text = "\n".join((p.get("text") or "") for p in results.get("pages", []))
        parsed = parse_marking_scheme(text)
        if parsed["status"] != "PARSED":
            return {"status": "UNAVAILABLE", "reason": parsed["reason"]}
        info = persist_parsed_scheme(db, parsed["questions"], filename)
        return {"status": "PARSED", "assessment_id": info["assessment_id"],
                "question_count": info["question_count"], "reused_existing": info["reused"]}
    except Exception as e:  # parser/DB problem must not fail the OCR job
        db.rollback()
        logger.error(f"Marking scheme parsing failed: {e}")
        return {"status": "UNAVAILABLE", "reason": f"Marking scheme parsing raised an error: {e}"}
