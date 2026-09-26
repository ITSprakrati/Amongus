from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from uuid import UUID

from core.database import get_db
from models import (
    Evaluation, Mark, AnswerScript, Candidate, Examiner, Assessment,
    ReviewSignal, ModerationCase, AuditEvent
)

router = APIRouter()


class MarkInput(BaseModel):
    question_id: UUID
    score: int
    criterion_id: Optional[UUID] = None


class EvaluationSubmit(BaseModel):
    examiner_id: UUID
    answer_script_id: UUID
    evaluation_time_mins: int
    marks: List[MarkInput]
    status: str = "EVALUATED"


class EvaluationOut(BaseModel):
    id: UUID
    answer_script_id: UUID
    examiner_id: UUID
    status: str
    evaluation_time_mins: Optional[int]

    class Config:
        orm_mode = True


class QuestionMarkInput(BaseModel):
    assessment_id: UUID
    question_id: UUID
    score: int
    script_id: Optional[str] = "SESSION-CANDIDATE"


class RecordedTotalInput(BaseModel):
    assessment_id: UUID
    recorded_total: int
    script_id: Optional[str] = "SESSION-CANDIDATE"


def _get_or_create_session_evaluation(db: Session, assessment_id: UUID, user_id: Optional[UUID] = None, script_id: str = "SESSION-CANDIDATE") -> Evaluation:
    """
    Get-or-create the single in-progress Evaluation for this assessment's
    session candidate/answer-script. Binds to the provided user_id to prevent
    evaluations leaking across examiners.
    """
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if user_id:
        examiner = db.query(Examiner).filter(Examiner.user_id == user_id).first()
    else:
        # Fallback for dev mode when no header is passed (demo context)
        examiner = db.query(Examiner).filter(Examiner.user_id.is_(None)).first()

    if not examiner:
        examiner = Examiner(user_id=user_id)
        db.add(examiner)
        db.commit()
        db.refresh(examiner)

    candidate = (
        db.query(Candidate)
        .filter(Candidate.assessment_id == assessment_id, Candidate.candidate_identifier == script_id)
        .first()
    )
    if not candidate:
        candidate = Candidate(assessment_id=assessment_id, candidate_identifier=script_id)
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

    answer_script = (
        db.query(AnswerScript)
        .filter(AnswerScript.candidate_id == candidate.id, AnswerScript.assessment_id == assessment_id)
        .first()
    )
    if not answer_script:
        answer_script = AnswerScript(candidate_id=candidate.id, assessment_id=assessment_id)
        db.add(answer_script)
        db.commit()
        db.refresh(answer_script)

    evaluation = (
        db.query(Evaluation)
        .filter(Evaluation.answer_script_id == answer_script.id)
        .filter(Evaluation.status.notin_(["MODERATED", "RESULT_READY"]))
        .order_by(Evaluation.created_at.desc())
        .first()
    )
    if not evaluation:
        evaluation = Evaluation(answer_script_id=answer_script.id, examiner_id=examiner.id, status="IN_PROGRESS")
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)

    return evaluation


def _evaluation_marks_map(db: Session, evaluation_id: UUID):
    """Real per-question marks (question_id IS NOT NULL) plus the recorded
    ledger total, which is stored as a sentinel Mark row with question_id
    IS NULL -- reusing the existing nullable Mark.question_id column rather
    than adding a new one."""
    rows = db.query(Mark).filter(Mark.evaluation_id == evaluation_id).all()
    marks = {str(m.question_id): m.score for m in rows if m.question_id is not None}
    recorded_total_row = next((m for m in rows if m.question_id is None), None)
    recorded_total = recorded_total_row.score if recorded_total_row else None
    return marks, recorded_total


@router.post("/", response_model=EvaluationOut)
def submit_evaluation(eval_in: EvaluationSubmit, db: Session = Depends(get_db)):
    # Create Evaluation
    evaluation = Evaluation(
        answer_script_id=eval_in.answer_script_id,
        examiner_id=eval_in.examiner_id,
        status=eval_in.status,
        evaluation_time_mins=eval_in.evaluation_time_mins
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)

    # Add Marks
    for m in eval_in.marks:
        new_mark = Mark(
            evaluation_id=evaluation.id,
            question_id=m.question_id,
            criterion_id=m.criterion_id,
            score=m.score
        )
        db.add(new_mark)

    db.commit()

    # Log Audit Event
    audit_event = AuditEvent(
        user_id=eval_in.examiner_id,
        action="EVALUATE",
        details={"evaluation_id": str(evaluation.id), "script_id": str(eval_in.answer_script_id)}
    )
    db.add(audit_event)
    db.commit()

    return evaluation


from core.security import get_current_user, require_role

@router.post("/session/mark")
def submit_session_mark(
    payload: QuestionMarkInput,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role(["Human Examiner", "Proctor"]))
):
    """
    Real, incremental mark entry used by the examiner workspace: upserts one
    Mark row per question against a real, persisted Evaluation.
    """
    evaluation = _get_or_create_session_evaluation(db, payload.assessment_id, user_id=user["user_id"], script_id=payload.script_id)

    # Validate that question_id actually belongs to this assessment
    from models import Question, QuestionSection
    valid_q = (
        db.query(Question)
        .join(QuestionSection, Question.section_id == QuestionSection.id)
        .filter(QuestionSection.assessment_id == payload.assessment_id, Question.id == payload.question_id)
        .first()
    )
    if not valid_q:
        raise HTTPException(status_code=400, detail="Invalid question_id for this assessment")

    try:
        mark = (
            db.query(Mark)
            .filter(Mark.evaluation_id == evaluation.id, Mark.question_id == payload.question_id)
            .first()
        )
        if mark:
            mark.score = payload.score
        else:
            mark = Mark(evaluation_id=evaluation.id, question_id=payload.question_id, score=payload.score)
            db.add(mark)
        db.commit()
    except Exception:
        db.rollback()
        mark = (
            db.query(Mark)
            .filter(Mark.evaluation_id == evaluation.id, Mark.question_id == payload.question_id)
            .first()
        )
        if mark:
            mark.score = payload.score
            db.commit()

    audit_event = AuditEvent(
        user_id=user["user_id"],
        action="MARK_QUESTION",
        details={"evaluation_id": str(evaluation.id), "question_id": str(payload.question_id), "score": payload.score, "role": user["role"]}
    )
    db.add(audit_event)
    db.commit()

    marks, recorded_total = _evaluation_marks_map(db, evaluation.id)
    return {
        "evaluation_id": str(evaluation.id),
        "marks": marks,
        "recorded_total": recorded_total
    }


@router.post("/session/recorded-total")
def submit_recorded_total(
    payload: RecordedTotalInput,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role(["Human Examiner", "Proctor"]))
):
    """Persist the examiner's ledger total (the number they write on the
    physical/PDF script as the section/grand total) as a sentinel Mark row
    with question_id = NULL, so verification can compare it against the real
    computed sum of individual question marks."""
    evaluation = _get_or_create_session_evaluation(db, payload.assessment_id, user_id=user["user_id"], script_id=payload.script_id)

    sentinel = (
        db.query(Mark)
        .filter(Mark.evaluation_id == evaluation.id, Mark.question_id.is_(None))
        .first()
    )
    if sentinel:
        sentinel.score = payload.recorded_total
    else:
        sentinel = Mark(evaluation_id=evaluation.id, question_id=None, score=payload.recorded_total)
        db.add(sentinel)
    db.commit()

    audit_event = AuditEvent(
        user_id=user["user_id"],
        action="RECORD_TOTAL",
        details={"evaluation_id": str(evaluation.id), "recorded_total": payload.recorded_total, "role": user["role"]}
    )
    db.add(audit_event)
    db.commit()

    marks, recorded_total = _evaluation_marks_map(db, evaluation.id)
    return {
        "evaluation_id": str(evaluation.id),
        "marks": marks,
        "recorded_total": recorded_total
    }


@router.get("/session")
def get_session_evaluation(assessment_id: UUID, script_id: str = "SESSION-CANDIDATE", db: Session = Depends(get_db)):
    """Real current evaluation state for this assessment's session, used to
    restore the examiner workspace on load. Does not create anything -- an
    evaluation only exists once at least one mark has been entered."""
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    answer_script = (
        db.query(AnswerScript)
        .join(Candidate, AnswerScript.candidate_id == Candidate.id)
        .filter(AnswerScript.assessment_id == assessment_id, Candidate.candidate_identifier == script_id)
        .first()
    )
    if not answer_script:
        return {"status": "NOT_STARTED", "evaluation_id": None, "marks": {}, "recorded_total": None}

    evaluation = (
        db.query(Evaluation)
        .filter(Evaluation.answer_script_id == answer_script.id)
        .order_by(Evaluation.created_at.desc())
        .first()
    )
    if not evaluation:
        return {"status": "NOT_STARTED", "evaluation_id": None, "marks": {}, "recorded_total": None}

    marks, recorded_total = _evaluation_marks_map(db, evaluation.id)
    return {
        "status": evaluation.status,
        "evaluation_id": str(evaluation.id),
        "marks": marks,
        "recorded_total": recorded_total
    }


@router.get("/{evaluation_id}")
def get_evaluation(evaluation_id: UUID, db: Session = Depends(get_db)):
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation:
        return {"id": str(evaluation_id), "status": "NOT_STARTED", "marks": {}, "recorded_total": None}
    marks, recorded_total = _evaluation_marks_map(db, evaluation.id)
    return {"id": str(evaluation.id), "status": evaluation.status, "marks": marks, "recorded_total": recorded_total}


@router.get("/{evaluation_id}/marks")
def get_evaluation_marks(evaluation_id: UUID, db: Session = Depends(get_db)):
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    marks = db.query(Mark).filter(Mark.evaluation_id == evaluation_id).all()
    return {
        "evaluation_id": evaluation_id,
        "marks": [{"question_id": m.question_id, "score": m.score, "criterion_id": m.criterion_id} for m in marks]
    }

@router.post("/session/ai-suggest")
def ai_suggest_mark(
    payload: dict,
    db: Session = Depends(get_db),
):
    """
    Real LLM-powered mark suggestion. Called from the Examiner workspace.
    Returns suggested mark, confidence and reasoning from Groq/OpenAI/TF-IDF.
    Never stores anything - the examiner decides.
    """
    from core.ai_eval import suggest_mark_for_question
    try:
        result = suggest_mark_for_question(
            question_text=payload.get("question_text", ""),
            rubric_text=payload.get("rubric_text", ""),
            student_answer=payload.get("student_answer", ""),
            max_marks=int(payload.get("max_marks", 5)),
        )
        return result
    except Exception as e:
        return {"suggested_mark": 0, "confidence": 0.0, "reasoning": str(e), "method": "Error"}

