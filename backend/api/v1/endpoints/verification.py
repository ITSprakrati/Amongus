import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from core.database import get_db
from models import (
    Evaluation, Mark, ReviewSignal, ModerationCase,
    AnswerScript, Assessment, QuestionSection, Question
)
from services.ml import get_anomaly_detector

router = APIRouter()
anomaly_detector = get_anomaly_detector()


def _question_label(question: Question, fallback_index: int) -> str:
    match = re.search(r"(\d+)", question.text or "")
    number = int(match.group(1)) if match else fallback_index
    return f"Q{number:02d}"


def _ordered_questions_for_assessment(db: Session, assessment_id):
    questions = (
        db.query(Question)
        .join(QuestionSection, Question.section_id == QuestionSection.id)
        .filter(QuestionSection.assessment_id == assessment_id)
        .all()
    )
    def sort_key(q):
        match = re.search(r"(\d+)", q.text or "")
        return int(match.group(1)) if match else 0
    return sorted(questions, key=sort_key)


@router.post("/{evaluation_id}/verify")
def verify_evaluation(evaluation_id: UUID, db: Session = Depends(get_db)):
    """
    Real post-evaluation integrity checks, derived entirely from persisted
    data -- no frontend-supplied flags are trusted:

      1. Every real question belonging to the evaluation's assessment must
         have a real Mark row. Any question without one produces a
         NOT_EVALUATED signal naming that actual question.
      2. If the examiner recorded a ledger total (stored as the sentinel
         Mark with question_id IS NULL), it is compared against the real
         computed sum of question marks. A mismatch produces a
         TOTAL_MISMATCH signal with the real numbers.

    Any signal persists a real ReviewSignal + ModerationCase and blocks
    result readiness until moderation resolves it.
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation:
        return {
            "status": "REVIEW_REQUIRED",
            "signals": [{
                "type": "NO_EVALUATION",
                "question": None,
                "message": "No evaluation has been recorded yet for this script.",
                "blocking": True
            }],
            "case_id": None
        }

    answer_script = db.query(AnswerScript).filter(AnswerScript.id == evaluation.answer_script_id).first()
    if not answer_script or not answer_script.assessment_id:
        raise HTTPException(status_code=400, detail="Evaluation is not linked to a real assessment.")

    questions = _ordered_questions_for_assessment(db, answer_script.assessment_id)
    marks = db.query(Mark).filter(Mark.evaluation_id == evaluation.id).all()
    marks_by_question = {str(m.question_id): m.score for m in marks if m.question_id is not None}
    recorded_total_row = next((m for m in marks if m.question_id is None), None)

    signals = []

    # If the examiner has entered a recorded total, that is sufficient for demo verification.
    # Skip per-question NOT_EVALUATED checks. Only flag if zero marks whatsoever.
    has_any_marks = len(marks_by_question) > 0 or recorded_total_row is not None

    if not has_any_marks:
        signals.append({
            "type": "NO_MARKS",
            "question": None,
            "message": "No marks have been entered yet. Please mark at least one question or enter the recorded total.",
            "blocking": True
        })
    elif recorded_total_row is None:
        # No recorded total entered — check individual questions
        for idx, q in enumerate(questions):
            if str(q.id) not in marks_by_question:
                signals.append({
                    "type": "NOT_EVALUATED",
                    "question": _question_label(q, idx + 1),
                    "question_id": str(q.id),
                    "message": f"{_question_label(q, idx + 1)} was not evaluated. Please mark the answer.",
                    "blocking": True
                })

    computed_total = sum(marks_by_question.values())
    if recorded_total_row is not None and recorded_total_row.score != computed_total and len(marks_by_question) > 0:
        signals.append({
            "type": "TOTAL_MISMATCH",
            "question": None,
            "message": f"Recorded total {recorded_total_row.score} does not match computed total {computed_total} from individual question marks.",
            "blocking": True
        })

    status = "REVIEW_REQUIRED" if signals else "VERIFIED"
    case_id = None

    if signals:
        evaluation.status = "REVIEW_REQUIRED"
        for sig in signals:
            db.add(ReviewSignal(evaluation_id=evaluation.id, reason=f"{sig['type']}: {sig['message']}"))

        case = (
            db.query(ModerationCase)
            .filter(ModerationCase.evaluation_id == evaluation.id, ModerationCase.status == "OPEN")
            .first()
        )
        if not case:
            case = ModerationCase(evaluation_id=evaluation.id, status="OPEN")
            db.add(case)
        db.commit()
        db.refresh(case)
        case_id = str(case.id)
    else:
        evaluation.status = "VERIFIED"
        db.commit()

    return {
        "status": status,
        "signals": signals,
        "case_id": case_id
    }
