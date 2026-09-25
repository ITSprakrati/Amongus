from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
import uuid
import logging
from typing import List

from core.database import get_db
from models import ProcessingJob
from services.storage import storage

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...), 
    # Form(): the frontend sends this as a multipart field. As a plain default it was
    # treated as a query param and ignored, typing every upload "answer_script".
    document_type: str = Form("answer_script"),
    db: Session = Depends(get_db)
):
    """
    Ingests a real PDF.
    1. Validates it is a PDF.
    2. Uploads binary to Object Storage.
    3. Creates DB record for the processing job.
    4. Triggers Celery async processing.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a PDF.")

    job_id = str(uuid.uuid4())
    object_name = f"{document_type}s/{job_id}_{file.filename}"

    try:
        logger.info(f"Uploading {file.filename} to storage at {object_name}")
        path = storage.upload_file(file.file, object_name, content_type=file.content_type)
        
        # Save to database using ProcessingJob
        new_job = ProcessingJob(
            id=uuid.UUID(job_id),   # real UUID object (SQLite lite mode rejects str; Postgres accepts both)
            job_type=document_type,
            status="PROCESSING",
            result_data={"filename": file.filename, "path": path}
        )
        db.add(new_job)
        db.commit()

        # Trigger Async Job
        from core.celery_app import process_pdf_task
        process_pdf_task.delay(job_id, path)

        return {
            "id": job_id,
            "filename": file.filename,
            "path": path,
            "status": "PROCESSING",
            "message": "File received. Async processing initiated."
        }
    except Exception as e:
        logger.error(f"Error during document upload: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{job_id}")
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Job not found")
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_uuid).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": str(job.id),
        "status": job.status,
        "result_data": job.result_data
    }
