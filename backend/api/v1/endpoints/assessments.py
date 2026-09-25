import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

from core.database import get_db
from models import Assessment, Institution, QuestionSection, Question

router = APIRouter()


def _question_label(question: Question, fallback_index: int) -> str:
    """Derive a real display label (e.g. 'Q06') from the question's own persisted
    text rather than inventing one. Falls back to ordinal position only if the
    text has no discernible number in it."""
    match = re.search(r"(\d+)", question.text or "")
    number = int(match.group(1)) if match else fallback_index
    return f"Q{number:02d}"


def _ordered_questions_for_assessment(db: Session, assessment_id) -> List[Question]:
    questions = (
        db.query(Question)
        .join(QuestionSection, Question.section_id == QuestionSection.id)
        .filter(QuestionSection.assessment_id == assessment_id)
        .order_by(Question.created_at.asc())
        .all()
    )
    # Sort by the number embedded in the question text when available, since
    # created_at ordering isn't guaranteed if rows were inserted in the same
    # transaction with near-identical timestamps.
    def sort_key(q):
        match = re.search(r"(\d+)", q.text or "")
        return int(match.group(1)) if match else 0
    return sorted(questions, key=sort_key)

class AssessmentCreate(BaseModel):
    title: str
    code: str
    institution_id: UUID
    scheduled_date: Optional[datetime] = None
    total_marks: int = 100
    status: str = "DRAFT"

class AssessmentOut(BaseModel):
    id: UUID
    title: str
    code: str
    institution_id: UUID
    scheduled_date: Optional[datetime] = None
    total_marks: int
    status: str

    class Config:
        from_attributes = True

@router.get("/", response_model=List[AssessmentOut])
def read_assessments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    assessments = db.query(Assessment).offset(skip).limit(limit).all()
    return assessments

@router.get("/latest")
def get_latest_assessment(db: Session = Depends(get_db)):
    """
    Returns the most recently created assessment + questions.
    Used as a fallback when no specific assessment_id is available (e.g. marking scheme OCR failed to match regex).
    """
    assessment = db.query(Assessment).order_by(Assessment.created_at.desc()).first()
    if not assessment:
        return {"status": "UNAVAILABLE", "reason": "No assessments in database. Upload a marking scheme first."}

    questions = _ordered_questions_for_assessment(db, assessment.id)
    if not questions:
        return {"status": "UNAVAILABLE", "reason": f"Assessment '{assessment.title}' has no questions provisioned yet."}

    return {
        "status": "READY",
        "assessment": {
            "id": str(assessment.id),
            "title": assessment.title,
            "total_marks": sum(q.max_marks for q in questions),
            "created_at": assessment.created_at.isoformat() if assessment.created_at else None,
        },
        "questions": [
            {
                "id": str(q.id),
                "label": _question_label(q, i + 1),
                "text": q.text or f"Question {i + 1}",
                "max_marks": q.max_marks,
            }
            for i, q in enumerate(questions)
        ],
    }

@router.get("/{assessment_id}")
def get_assessment(assessment_id: UUID, db: Session = Depends(get_db)):
    """
    Returns the specific assessment + real questions the examiner workspace evaluates
    against.
    """
    assessment = (
        db.query(Assessment)
        .filter(Assessment.id == assessment_id)
        .first()
    )
    if not assessment:
        return {
            "status": "UNAVAILABLE",
            "reason": "Assessment not found.",
        }

    questions = _ordered_questions_for_assessment(db, assessment.id)
    if not questions:
        return {
            "status": "UNAVAILABLE",
            "reason": f"Assessment '{assessment.title}' exists but has no questions provisioned.",
        }

    return {
        "status": "READY",
        "assessment": {
            "id": str(assessment.id),
            "title": assessment.title,
            "code": assessment.code,
            "total_marks": sum(q.max_marks for q in questions),
        },
        "questions": [
            {
                "id": str(q.id),
                "label": _question_label(q, idx + 1),
                "max_marks": q.max_marks,
                "text": q.text,
            }
            for idx, q in enumerate(questions)
        ],
    }


@router.post("/", response_model=AssessmentOut)
def create_assessment(assessment_in: AssessmentCreate, db: Session = Depends(get_db)):
    institution = db.query(Institution).filter(Institution.id == assessment_in.institution_id).first()
    if not institution:
        raise HTTPException(status_code=400, detail="Institution not found")

    new_assessment = Assessment(
        title=assessment_in.title,
        code=assessment_in.code,
        institution_id=assessment_in.institution_id,
        scheduled_date=assessment_in.scheduled_date,
        total_marks=assessment_in.total_marks,
        status=assessment_in.status
    )
    db.add(new_assessment)
    db.commit()
    db.refresh(new_assessment)
    return new_assessment
