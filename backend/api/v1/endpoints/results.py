import re
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from core.database import get_db
from models import Evaluation, Mark, ModerationCase, AnswerScript, QuestionSection, Question, Result

router = APIRouter()


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


@router.post("/{evaluation_id}/calculate")
def calculate_result(evaluation_id: UUID, db: Session = Depends(get_db)):
    """
    Real result calculation. Refuses to produce a number unless:
      - a real Evaluation exists,
      - every real question for its assessment has a real Mark, and
      - there is no unresolved (OPEN) ModerationCase against it.
    All figures are computed from persisted Mark/Question rows -- nothing is
    taken from the request body.
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation:
        return {"status": "UNAVAILABLE", "reason": "No evaluation found for this id."}

    open_case = (
        db.query(ModerationCase)
        .filter(ModerationCase.evaluation_id == evaluation.id, ModerationCase.status == "OPEN")
        .first()
    )
    if open_case:
        return {"status": "BLOCKED", "reason": "An unresolved moderation case exists for this evaluation."}

    answer_script = db.query(AnswerScript).filter(AnswerScript.id == evaluation.answer_script_id).first()
    if not answer_script or not answer_script.assessment_id:
        return {"status": "UNAVAILABLE", "reason": "Evaluation is not linked to a real assessment."}

    questions = _ordered_questions_for_assessment(db, answer_script.assessment_id)
    marks = db.query(Mark).filter(Mark.evaluation_id == evaluation.id, Mark.question_id.isnot(None)).all()
    marks_by_question = {str(m.question_id): m.score for m in marks}

    recorded_total_row = (
        db.query(Mark)
        .filter(Mark.evaluation_id == evaluation.id, Mark.question_id.is_(None))
        .first()
    )

    missing = [q for q in questions if str(q.id) not in marks_by_question]
    if missing and recorded_total_row is not None:
        total_score = recorded_total_row.score
    elif missing:
        return {
            "status": "BLOCKED",
            "reason": f"{len(missing)} question(s) have not been evaluated yet."
        }
    else:
        total_score = sum(marks_by_question.values())
    max_marks = sum(q.max_marks for q in questions)
    percentage = (total_score / max_marks * 100) if max_marks > 0 else 0

    if percentage >= 80:
        grade = "A"
    elif percentage >= 60:
        grade = "B"
    elif percentage >= 40:
        grade = "C"
    else:
        grade = "FAIL"

    result = db.query(Result).filter(Result.answer_script_id == answer_script.id).first()
    if not result:
        result = Result(answer_script_id=answer_script.id, total_score=total_score)
        db.add(result)
    else:
        result.total_score = total_score
    db.commit()

    evaluation.status = "RESULT_READY"
    db.commit()

    return {
        "evaluation_id": str(evaluation_id),
        "total_marks": total_score,
        "max_marks": max_marks,
        "percentage": round(percentage, 1),
        "grade": grade,
        "status": "PUBLISHED"
    }

@router.post("/narrative")
def generate_narrative(payload: dict):
    """Calls the LLM to generate a 2-sentence AI examiner narrative for the results page."""
    from core.ai_eval import generate_result_narrative
    narrative = generate_result_narrative(
        total_marks=int(payload.get("total_marks", 0)),
        max_marks=int(payload.get("max_marks", 50)),
        grade=str(payload.get("grade", "C")),
        category=str(payload.get("category", "PARTIAL MATCH")),
    )
    return {"narrative": narrative}
