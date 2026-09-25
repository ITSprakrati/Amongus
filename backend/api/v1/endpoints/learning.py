from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel

from core.database import get_db
from models import InstitutionalKnowledge, ModerationCase, ModerationDecision, Evaluation, Assessment, AnswerScript

router = APIRouter()

class IngestCasePayload(BaseModel):
    case_id: UUID

@router.post("/ingest-case")
def ingest_resolved_case(payload: IngestCasePayload, db: Session = Depends(get_db)):
    """
    Phase 17: Institutional Learning
    Takes a resolved moderation case and updates the knowledge base.
    """
    case = db.query(ModerationCase).filter(ModerationCase.id == payload.case_id).first()
    if not case or case.status != "RESOLVED":
        raise HTTPException(status_code=400, detail="Case not found or not resolved")
        
    eval = db.query(Evaluation).filter(Evaluation.id == case.evaluation_id).first()
    if not eval:
        raise HTTPException(status_code=404, detail="Evaluation not found")
        
    script = db.query(AnswerScript).filter(AnswerScript.id == eval.answer_script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Answer script not found")
        
    assessment = db.query(Assessment).filter(Assessment.id == script.assessment_id).first()
    
    decision = db.query(ModerationDecision).filter(ModerationDecision.moderation_case_id == case.id).order_by(ModerationDecision.created_at.desc()).first()
    
    content = f"Case {case.id} resolved with decision {decision.decision if decision else 'N/A'}. Adjusted score: {decision.adjusted_score if decision else 'None'}."
    
    ik = InstitutionalKnowledge(
        institution_id=assessment.institution_id if assessment else None,
        content=content
    )
    db.add(ik)
    db.commit()
    db.refresh(ik)
    
    return {
        "status": "INGESTED",
        "knowledge_id": str(ik.id),
        "message": "Moderation outcome integrated into institutional knowledge base."
    }
