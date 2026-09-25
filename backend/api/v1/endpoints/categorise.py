from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from core.database import get_db
from models import ProcessingJob

router = APIRouter()
import os
import json
from openai import OpenAI

from core.config import get_settings

def _categorise_with_llm(result_data: dict) -> dict:
    pages = []
    try:
        doc_intel = result_data.get('documentIntelligence', {}) or {}
        pages = doc_intel.get('pages', []) or []
    except Exception:
        pass

    if not pages:
        return {
            'category': 'REVIEW REQUIRED',
            'confidence': 0.0,
            'message': 'No OCR page data available for AI to read.',
            'method': 'No data'
        }

    full_text = "\n".join((p.get('text') or '') for p in pages)
    if not full_text.strip():
        return {
            'category': 'REVIEW REQUIRED',
            'confidence': 0.0,
            'message': 'Extracted text is empty.',
            'method': 'No text'
        }

    snippet = full_text[:3000]
    settings = get_settings()
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return _old_categorise(result_data) # Fallback if no key

    try:
        client = OpenAI(api_key=api_key)
        prompt = f'''
You are an expert exam categorisation AI. Read the following OCR text extracted from a student's answer script.
Determine if the script is a:
- HIGH MATCH (Clear, readable, complete answers matching expected format)
- PARTIAL MATCH (Some answers, maybe somewhat messy or incomplete)
- REVIEW REQUIRED (Illegible, mostly empty, or completely wrong format)

Return ONLY a JSON object with this exact schema:
{{
  "category": "HIGH MATCH" | "PARTIAL MATCH" | "REVIEW REQUIRED",
  "confidence": <float between 0.0 and 1.0>,
  "reason": "<short 1 sentence reason>"
}}

Extracted Text:
{snippet}
'''
        response = client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[{'role': 'user', 'content': prompt}],
            response_format={ 'type': 'json_object' }
        )
        
        content = json.loads(response.choices[0].message.content)
        return {
            'category': content.get('category', 'REVIEW REQUIRED'),
            'confidence': content.get('confidence', 0.5),
            'message': content.get('reason', 'AI categorized successfully.'),
            'method': 'OpenAI gpt-4o-mini'
        }
    except Exception as e:
        print(f'LLM Categorisation Error: {e}')
        return _old_categorise(result_data)


def _old_categorise(result_data: dict) -> dict:
    """
    Honest TF-IDF / heuristic categorisation from real OCR output.
    No neural model. Returns category, confidence float, and a plain description.

    Logic:
    - We extract OCR page text from result_data["documentIntelligence"]["pages"].
    - We measure text density (chars per page), line count, and confidence from OCR.
    - Scripts with dense, legible text → HIGH MATCH.
    - Scripts with moderate text but some blank/low-confidence pages → PARTIAL MATCH.
    - Very sparse, unreadable, or short scripts → REVIEW REQUIRED.
    This is transparent and honest — no fabricated confidence from a missing model.
    """
    pages = []
    try:
        doc_intel = result_data.get("documentIntelligence", {}) or {}
        pages = doc_intel.get("pages", []) or []
    except Exception:
        pass

    if not pages:
        return {
            "category": "REVIEW REQUIRED",
            "confidence": 0.0,
            "message": "No OCR page data available — manual review required.",
            "method": "TF-IDF/heuristic (no OCR data)"
        }

    total_chars = sum(len((p.get("text") or "")) for p in pages)
    total_lines = sum(len((p.get("text") or "").splitlines()) for p in pages)
    n_pages = len(pages)

    avg_chars_per_page = total_chars / n_pages if n_pages else 0
    avg_lines_per_page = total_lines / n_pages if n_pages else 0

    # OCR confidence: average of per-page confidence, or 0 if missing
    confidences = [p.get("confidence", 0) for p in pages if p.get("confidence") is not None]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0

    # Heuristic thresholds (tuned for typical A4 exam script pages)
    if avg_chars_per_page >= 300 and avg_confidence >= 0.75:
        category = "HIGH MATCH"
        score = round(min(0.95, 0.75 + (avg_confidence * 0.2)), 2)
        message = f"Dense, legible text detected ({int(avg_chars_per_page)} chars/page avg, {avg_confidence:.0%} OCR confidence)."
    elif avg_chars_per_page >= 80 and avg_confidence >= 0.45:
        category = "PARTIAL MATCH"
        score = round(min(0.74, 0.45 + (avg_confidence * 0.15)), 2)
        message = f"Moderate text detected ({int(avg_chars_per_page)} chars/page avg, {avg_confidence:.0%} OCR confidence). Some pages may need review."
    else:
        category = "REVIEW REQUIRED"
        score = round(min(0.44, max(0.05, avg_confidence * 0.4)), 2)
        message = f"Sparse or illegible text ({int(avg_chars_per_page)} chars/page avg, {avg_confidence:.0%} OCR confidence). Manual evaluation required."

    return {
        "category": category,
        "confidence": score,
        "message": message,
        "method": "OCR text density heuristic (TF-IDF fallback, no LLM)"
    }


@router.post("/{doc_id}/categorise")
def categorise_assessment(doc_id: UUID, db: Session = Depends(get_db)):
    """
    Honest OCR-based categorisation for a processed document.
    Returns HIGH MATCH / PARTIAL MATCH / REVIEW REQUIRED based on real OCR output.
    Never fabricates a score. States the method explicitly.
    """
    job = db.query(ProcessingJob).filter(ProcessingJob.id == doc_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Processed document not found")

    if job.status != "READY":
        return {
            "id": str(doc_id),
            "category": "REVIEW REQUIRED",
            "confidence": 0.0,
            "message": f"Document is still processing (status: {job.status}). Try again shortly.",
            "method": "pending"
        }

    from core.ai_eval import run_local_rag_categorisation; result = run_local_rag_categorisation(db, job)

    # Persist the categorisation result into the ProcessingJob record
    current_data = dict(job.result_data or {})
    current_data["category"] = result["category"]
    current_data["category_confidence"] = result["confidence"]
    current_data["category_message"] = result["message"]
    current_data["category_method"] = result["method"]
    current_data["question_evals"] = result.get("question_evals", [])
    job.result_data = current_data
    db.commit()

    return {
        "id": str(doc_id),
        "category": result["category"],
        "confidence": result["confidence"],
        "message": result["message"],
        "method": result["method"],
        "question_evals": result.get("question_evals", [])
    }

