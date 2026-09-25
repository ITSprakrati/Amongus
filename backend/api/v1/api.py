from fastapi import APIRouter
from .endpoints import documents, assessments, categorise, verification, moderation, results, analytics, learning, audit, evaluation

api_router = APIRouter()
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(assessments.router, prefix="/assessments", tags=["assessments"])
api_router.include_router(categorise.router, prefix="/categorise", tags=["categorise"])
api_router.include_router(evaluation.router, prefix="/evaluation", tags=["evaluation"])
api_router.include_router(evaluation.router, prefix="/evaluations", tags=["evaluation"])
api_router.include_router(verification.router, prefix="/verification", tags=["verification"])
api_router.include_router(moderation.router, prefix="/moderation", tags=["moderation"])
api_router.include_router(results.router, prefix="/results", tags=["results"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(learning.router, prefix="/learning", tags=["learning"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
