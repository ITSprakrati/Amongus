from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any

from core.database import get_db
from models import AnswerScript, Evaluation, ReviewSignal, ModerationCase, Mark, Question, QuestionSection

router = APIRouter()

@router.get("/dashboard")
def get_analytics_dashboard(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Analytics dashboard from real persisted data.
    All figures derived from DB queries — nothing hardcoded.
    """
    total_scripts = db.query(func.count(AnswerScript.id)).scalar() or 0

    # Evaluation status breakdown
    evaluations = db.query(Evaluation.status, func.count(Evaluation.id)).group_by(Evaluation.status).all()
    status_counts = {status: count for status, count in evaluations}

    scripts_evaluated = sum(
        count for status, count in status_counts.items()
        if status in {"IN_PROGRESS", "EVALUATED", "VERIFIED", "REVIEW_REQUIRED", "MODERATED", "RESULT_READY"}
    )
    verified = status_counts.get("VERIFIED", 0)
    moderated = status_counts.get("MODERATED", 0)
    result_ready = status_counts.get("RESULT_READY", 0)
    blocked = status_counts.get("REVIEW_REQUIRED", 0)
    in_progress = status_counts.get("IN_PROGRESS", 0)

    avg_eval_time = db.query(func.avg(Evaluation.evaluation_time_mins)).scalar() or 0.0

    # Review signal counts — single query
    signal_rows = db.query(ReviewSignal.reason, func.count(ReviewSignal.id)).group_by(ReviewSignal.reason).all()
    total_signals = sum(count for _, count in signal_rows)
    total_mismatch_signals = sum(count for reason, count in signal_rows if "TOTAL_MISMATCH" in (reason or ""))
    unanswered_signals = sum(count for reason, count in signal_rows if "NOT_EVALUATED" in (reason or ""))

    # Unanswered rate: proportion of all marks that are missing (NOT_EVALUATED signals / total expected marks)
    # Computed as: unanswered_signals / (total questions marked + unanswered) — honest fallback if no data
    total_marks_entered = db.query(func.count(Mark.id)).filter(Mark.question_id.isnot(None)).scalar() or 0
    total_expected = total_marks_entered + unanswered_signals
    unanswered_rate = round(unanswered_signals / total_expected, 3) if total_expected > 0 else 0.0

    total_mismatch_rate = round(total_mismatch_signals / total_signals, 3) if total_signals > 0 else 0.0

    return {
        "assessment": {
            "scripts_received": total_scripts,
            "scripts_evaluated": scripts_evaluated,
            "in_progress": in_progress,
            "blocked": blocked,
            "verified": verified,
            "moderated": moderated,
            "result_ready": result_ready
        },
        "examiner": {
            "average_evaluation_time_mins": round(float(avg_eval_time), 2),
            "review_signals_generated": total_signals
        },
        "anomalies": {
            "total_mismatch_rate": total_mismatch_rate,
            "unanswered_rate": unanswered_rate
        },
        "data_source": "real_db_queries"
    }
