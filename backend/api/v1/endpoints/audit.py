from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import String
from typing import List, Dict, Any
from uuid import UUID

from core.database import get_db
from models import AuditEvent

router = APIRouter()

@router.get("/{entity_id}")
def get_audit_trail(entity_id: str, db: Session = Depends(get_db)):
    """
    Retrieves the verifiable audit trail for a specific script/evaluation.
    Searches for the entity_id in the details JSON.
    """
    events = db.query(AuditEvent).filter(
        AuditEvent.details.cast(String).ilike(f"%{entity_id}%")
    ).order_by(AuditEvent.created_at.asc()).all()
    
    import hashlib
    import json

    formatted_events = []
    for ev in events:
        event_dict = {
            "id": str(ev.id),
            "timestamp": ev.created_at.isoformat() if ev.created_at else None,
            "actor": str(ev.user_id) if ev.user_id else "System",
            "action": ev.action,
            "details": ev.details
        }
        event_hash = hashlib.sha256(json.dumps(event_dict, sort_keys=True).encode()).hexdigest()

        formatted_events.append({
            **event_dict,
            "hash": event_hash
        })
        
    return {
        "entity_id": entity_id,
        "events": formatted_events
    }
