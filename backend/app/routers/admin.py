from fastapi import APIRouter, Depends, HTTPException
from app.security import get_current_user
from app.services.database import DatabaseService
from typing import List, Dict, Any

router = APIRouter()

async def verify_admin(user: dict = Depends(get_current_user)):
    from app.security import get_supabase
    sb = get_supabase()
    response = sb.table("user_roles").select("role").eq("user_id", user["user_id"]).in_("role", ["admin", "super_admin"]).execute()
    if not response.data:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@router.get("/config")
async def get_backend_config(admin: dict = Depends(verify_admin)):
    return {"message": "Backend config endpoint"}

@router.post("/cleanup-expired")
async def cleanup_expired_images(admin: dict = Depends(verify_admin)):
    from app.services.storage import StorageService
    await StorageService.cleanup_expired_images()
    return {"success": True, "message": "Expired images cleaned up"}

@router.get("/failed-jobs", response_model=List[Dict[str, Any]])
async def get_failed_jobs(limit: int = 50, admin: dict = Depends(verify_admin)):
    """Get list of failed jobs for admin panel"""
    failed_jobs = await DatabaseService.get_failed_jobs(limit)
    return failed_jobs

@router.delete("/failed-jobs/{job_id}")
async def terminate_failed_job(job_id: str, admin: dict = Depends(verify_admin)):
    """Terminate/delete a failed job"""
    success = await DatabaseService.terminate_failed_job(job_id)
    if success:
        return {"success": True, "message": f"Failed job {job_id} terminated successfully"}
    else:
        raise HTTPException(status_code=400, detail=f"Failed to terminate job {job_id}")