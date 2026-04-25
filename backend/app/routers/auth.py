from fastapi import APIRouter, Depends
from app.security import get_current_user, verify_admin

router = APIRouter()

@router.get("/me")
async def get_current_user_info(user: dict = Depends(get_current_user)):
    return {"user_id": user["user_id"], "email": user.get("email")}

__all__ = ["get_current_user_info", "verify_admin"]