from core.database import SessionLocal
from core.seed_data import ensure_golden_path_assessment

if __name__ == "__main__":
    db = SessionLocal()
    try:
        assessment = ensure_golden_path_assessment(db)
        print(f"Golden-path assessment ready: {assessment.title} ({assessment.id})")
    finally:
        db.close()
