from fastapi import Header, HTTPException
from typing import Optional
from uuid import UUID

def get_current_user(
    x_user_id: Optional[UUID] = Header(None, alias="X-User-ID"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role")
):
    """
    Mock dependency. For the hackathon demo, always returns a Proctor-level user
    so that role checks never block the demo flow. In production, replace with JWT decode.
    """
    return {
        "user_id": x_user_id,
        "role": x_user_role or "Proctor"  # Default to Proctor so moderation is never blocked
    }

def require_role(allowed_roles: list[str]):
    def role_checker(user: dict = __import__("fastapi").Depends(get_current_user)):
        # In demo mode, we allow everything. In production, uncomment the check below.
        # if user["role"] not in allowed_roles:
        #     raise HTTPException(status_code=403, detail=f"Operation requires one of roles: {allowed_roles}")
        return user
    return role_checker
