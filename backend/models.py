import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Integer, JSON, Text, Enum, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID

Base = declarative_base()

class BaseModel(Base):
    __abstract__ = True
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Institution(BaseModel):
    __tablename__ = 'institutions'
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)

class Role(BaseModel):
    __tablename__ = 'roles'
    name = Column(String, nullable=False)
    description = Column(String)

class User(BaseModel):
    __tablename__ = 'users'
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    institution_id = Column(UUID(as_uuid=True), ForeignKey('institutions.id'))
    role_id = Column(UUID(as_uuid=True), ForeignKey('roles.id'))

class Assessment(BaseModel):
    __tablename__ = 'assessments'
    title = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=True)
    institution_id = Column(UUID(as_uuid=True), ForeignKey('institutions.id'))
    scheduled_date = Column(DateTime)
    total_marks = Column(Integer)
    status = Column(String)

class QuestionSection(BaseModel):
    __tablename__ = 'question_sections'
    title = Column(String)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey('assessments.id'))

class Question(BaseModel):
    __tablename__ = 'questions'
    section_id = Column(UUID(as_uuid=True), ForeignKey('question_sections.id'))
    text = Column(Text)
    max_marks = Column(Integer)

class Candidate(BaseModel):
    __tablename__ = 'candidates'
    assessment_id = Column(UUID(as_uuid=True), ForeignKey('assessments.id'))
    candidate_identifier = Column(String, nullable=False)

class AnswerScript(BaseModel):
    __tablename__ = 'answer_scripts'
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('candidates.id'))
    assessment_id = Column(UUID(as_uuid=True), ForeignKey('assessments.id'))
    complexity_category = Column(String)

class Page(BaseModel):
    __tablename__ = 'pages'
    answer_script_id = Column(UUID(as_uuid=True), ForeignKey('answer_scripts.id'))
    image_path = Column(String)
    page_number = Column(Integer)

class AnswerRegion(BaseModel):
    __tablename__ = 'answer_regions'
    page_id = Column(UUID(as_uuid=True), ForeignKey('pages.id'))
    question_id = Column(UUID(as_uuid=True), ForeignKey('questions.id'))
    coordinates = Column(JSON)

class MarkingScheme(BaseModel):
    __tablename__ = 'marking_schemes'
    assessment_id = Column(UUID(as_uuid=True), ForeignKey('assessments.id'))

class Criterion(BaseModel):
    __tablename__ = 'criteria'
    marking_scheme_id = Column(UUID(as_uuid=True), ForeignKey('marking_schemes.id'))
    question_id = Column(UUID(as_uuid=True), ForeignKey('questions.id'))
    description = Column(Text)
    max_marks = Column(Integer)

class Examiner(BaseModel):
    __tablename__ = 'examiners'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))

class Evaluation(BaseModel):
    __tablename__ = 'evaluations'
    answer_script_id = Column(UUID(as_uuid=True), ForeignKey('answer_scripts.id'))
    examiner_id = Column(UUID(as_uuid=True), ForeignKey('examiners.id'))
    status = Column(String)
    evaluation_time_mins = Column(Integer)
class Mark(BaseModel):
    __tablename__ = 'marks'
    evaluation_id = Column(UUID(as_uuid=True), ForeignKey('evaluations.id'))
    question_id = Column(UUID(as_uuid=True), ForeignKey('questions.id'), nullable=True)
    criterion_id = Column(UUID(as_uuid=True), ForeignKey('criteria.id'), nullable=True)
    score = Column(Integer)
    
    __table_args__ = (
        UniqueConstraint('evaluation_id', 'question_id', name='uq_eval_question'),
    )

class ReviewSignal(BaseModel):
    __tablename__ = 'review_signals'
    evaluation_id = Column(UUID(as_uuid=True), ForeignKey('evaluations.id'))
    reason = Column(String)

class ModerationCase(BaseModel):
    __tablename__ = 'moderation_cases'
    evaluation_id = Column(UUID(as_uuid=True), ForeignKey('evaluations.id'))
    status = Column(String)

class ModerationDecision(BaseModel):
    __tablename__ = 'moderation_decisions'
    moderation_case_id = Column(UUID(as_uuid=True), ForeignKey('moderation_cases.id'))
    decision = Column(String)
    adjusted_score = Column(Integer)

class Result(BaseModel):
    __tablename__ = 'results'
    answer_script_id = Column(UUID(as_uuid=True), ForeignKey('answer_scripts.id'))
    total_score = Column(Integer)

class AuditEvent(BaseModel):
    __tablename__ = 'audit_events'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    action = Column(String)
    details = Column(JSON)

class InstitutionalKnowledge(BaseModel):
    __tablename__ = 'institutional_knowledge'
    institution_id = Column(UUID(as_uuid=True), ForeignKey('institutions.id'))
    content = Column(Text)

class ProcessingJob(BaseModel):
    __tablename__ = 'processing_jobs'
    status = Column(String)
    job_type = Column(String)
    result_data = Column(JSON)
