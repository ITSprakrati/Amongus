from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel, validator
from typing import Optional

from core.database import get_db
from models import ModerationCase, ModerationDecision, Evaluation, Mark, AuditEvent, ReviewSignal

router = APIRouter()

from core.security import get_current_user, require_role

VALID_DECISIONS = {"APPROVED", "REJECTED", "AMENDED"}

class ModerationResolve(BaseModel):
    decision: str
    adjusted_score: Optional[int] = None

    @validator("decision")
    def decision_must_be_valid(cls, v):
        if v not in VALID_DECISIONS:
            raise ValueError(f"decision must be one of {sorted(VALID_DECISIONS)}, got '{v}'")
        return v

    @validator("adjusted_score")
    def adjusted_score_only_with_amended(cls, v, values):
        if v is not None and values.get("decision") != "AMENDED":
            raise ValueError("adjusted_score is only valid when decision is 'AMENDED'")
        return v


@router.get("/")
def get_moderation_cases(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    user: dict = Depends(require_role(["Proctor"]))
):
    """Returns all open moderation cases. In production this would be scoped by institution/role."""
    cases = db.query(ModerationCase).offset(skip).limit(limit).all()
    result = []
    for case in cases:
        signals = db.query(ReviewSignal).filter(ReviewSignal.evaluation_id == case.evaluation_id).all()
        result.append({
            "id": str(case.id),
            "evaluation_id": str(case.evaluation_id),
            "status": case.status,
            "signals": [{"reason": s.reason} for s in signals],
            "created_at": case.created_at.isoformat() if case.created_at else None,
        })
    return result


@router.get("/{case_id}")
def get_moderation_case(
    case_id: UUID, 
    db: Session = Depends(get_db),
    user: dict = Depends(require_role(["Proctor"]))
):
    """Returns a single moderation case with its review signals."""
    case = db.query(ModerationCase).filter(ModerationCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Moderation case not found")
    signals = db.query(ReviewSignal).filter(ReviewSignal.evaluation_id == case.evaluation_id).all()
    return {
        "id": str(case.id),
        "evaluation_id": str(case.evaluation_id),
        "status": case.status,
        "signals": [{"reason": s.reason} for s in signals],
        "created_at": case.created_at.isoformat() if case.created_at else None,
    }


@router.post("/{case_id}/resolve")
def resolve_moderation_case(
    case_id: UUID, 
    payload: ModerationResolve, 
    db: Session = Depends(get_db),
    user: dict = Depends(require_role(["Proctor"]))
):
    """
    Resolve a moderation case. Only valid decisions: APPROVED, REJECTED, AMENDED.
    If AMENDED, adjusted_score must be provided and is applied to the evaluation's
    sentinel Mark row (the examiner's recorded total) so results.py sees the
    moderated value.
    """
    case = db.query(ModerationCase).filter(ModerationCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Moderation case not found")

    if case.status == "RESOLVED":
        raise HTTPException(status_code=409, detail="Moderation case is already resolved.")

    case.status = "RESOLVED"

    decision = ModerationDecision(
        moderation_case_id=case.id,
        decision=payload.decision,
        adjusted_score=payload.adjusted_score
    )
    db.add(decision)

    evaluation = db.query(Evaluation).filter(Evaluation.id == case.evaluation_id).first()
    if evaluation:
        evaluation.status = "MODERATED"

        # If the moderator amended the score, apply it to the sentinel Mark row
        # (question_id IS NULL) so results.py computes from the moderated value.
        if payload.decision == "AMENDED" and payload.adjusted_score is not None:
            sentinel = (
                db.query(Mark)
                .filter(Mark.evaluation_id == evaluation.id, Mark.question_id.is_(None))
                .first()
            )
            if sentinel:
                sentinel.score = payload.adjusted_score
            else:
                sentinel = Mark(evaluation_id=evaluation.id, question_id=None, score=payload.adjusted_score)
                db.add(sentinel)

    audit = AuditEvent(
        user_id=user["user_id"],
        action="MODERATION_RESOLVED",
        details={
            "case_id": str(case_id),
            "evaluation_id": str(case.evaluation_id),
            "decision": payload.decision,
            "adjusted_score": payload.adjusted_score,
            "role": user["role"]
        }
    )
    db.add(audit)

    db.commit()

    return {
        "status": "MODERATED",
        "case_id": str(case_id),
        "moderator_decision": payload.decision,
        "adjusted_score": payload.adjusted_score,
        "message": "Moderation case resolved and audit event created."
    }
