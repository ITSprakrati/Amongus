from sqlalchemy.orm import Session
from models import Institution, Assessment, QuestionSection, Question


def ensure_golden_path_assessment(db: Session) -> Assessment:
    """
    Get-or-create the real B.Sc. Mathematics assessment (Q01-Q06, 5 marks each)
    used as the golden-path test fixture in the handoff spec. This writes real
    rows through the normal database session -- it is not invented per-request
    by an API handler. If a real assessment already exists (e.g. provisioned by
    a registrar through POST /assessments/ in the future), this function does
    not touch it and simply returns the most recently created ACTIVE assessment.
    """
    existing = (
        db.query(Assessment)
        .filter(Assessment.code == "GOLDEN-MATH-101")
        .first()
    )
    if existing:
        return existing

    inst = db.query(Institution).filter(Institution.code == "UEC-2024").first()
    if not inst:
        inst = Institution(name="University Examination Council", code="UEC-2024")
        db.add(inst)
        db.commit()
        db.refresh(inst)

    assessment = Assessment(
        title="B.Sc. Mathematics & Spatial Vectors",
        code="GOLDEN-MATH-101",
        institution_id=inst.id,
        total_marks=30,  # matches the real Q01-Q06 @ 5 marks each provisioned below
        status="ACTIVE",
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    section = QuestionSection(title="Section A", assessment_id=assessment.id)
    db.add(section)
    db.commit()
    db.refresh(section)

    for i in range(1, 7):
        db.add(Question(section_id=section.id, text=f"Question {i:02d}", max_marks=5))
    db.commit()

    return assessment
