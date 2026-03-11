from fastapi import APIRouter, Depends, HTTPException, Query
from app.security import get_current_user
from app.services.database import DatabaseService
from typing import List, Dict, Any, Optional

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

# Enhanced Job Management Endpoints

@router.get("/jobs", response_model=List[Dict[str, Any]])
async def get_jobs(
    status: Optional[str] = Query(None, description="Filter by job status"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    limit: int = Query(100, ge=1, le=1000, description="Number of jobs to return"),
    admin: dict = Depends(verify_admin)
):
    """Get jobs with optional filtering"""
    if status:
        jobs = await DatabaseService.get_jobs_by_status(status, limit)
    elif user_id:
        jobs = await DatabaseService.get_jobs_by_user(user_id, limit)
    else:
        # Get all jobs ordered by created_at
        sb = DatabaseService.get_client()
        response = sb.table("generation_jobs").select("*").order("created_at", desc=True).limit(limit).execute()
        jobs = response.data or []
    
    return jobs

@router.get("/jobs/{job_id}", response_model=Dict[str, Any])
async def get_job_details(job_id: str, admin: dict = Depends(verify_admin)):
    """Get detailed information about a specific job"""
    sb = DatabaseService.get_client()
    response = sb.table("generation_jobs").select("*").eq("job_id", job_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = response.data[0]
    
    # Get job logs
    logs_response = sb.table("job_logs").select("*").eq("job_id", job_id).order("created_at", desc=True).execute()
    job_logs = logs_response.data or []
    
    return {
        "job": job,
        "logs": job_logs
    }

@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str, admin: dict = Depends(verify_admin)):
    """Cancel a pending or processing job"""
    success = await DatabaseService.cancel_job(job_id, admin["user_id"])
    if success:
        return {"success": True, "message": f"Job {job_id} cancelled successfully"}
    else:
        raise HTTPException(status_code=400, detail=f"Failed to cancel job {job_id}")

@router.post("/jobs/{job_id}/retry")
async def retry_job(job_id: str, admin: dict = Depends(verify_admin)):
    """Retry a failed job"""
    sb = DatabaseService.get_client()
    
    # Get the job
    job_response = sb.table("generation_jobs").select("*").eq("job_id", job_id).execute()
    
    if not job_response.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = job_response.data[0]
    
    # Only allow retry of failed jobs
    if job["status"] != "failed":
        raise HTTPException(status_code=400, detail=f"Cannot retry job {job_id} with status {job['status']}")
    
    # Reset job to pending
    sb.table("generation_jobs").update({
        "status": "pending",
        "error": None,
        "retry_count": job.get("retry_count", 0) + 1,
        "updated_at": "now()"
    }).eq("job_id", job_id).execute()
    
    # Log the retry
    await DatabaseService.log_job_event(
        job_id=job_id,
        user_id=job["user_id"],
        username=job.get("job_owner_username", ""),
        account_type=job.get("account_type", "free"),
        prompt=job.get("prompt", ""),
        negative_prompt=job.get("negative_prompt", ""),
        model_name=job.get("model_name", ""),
        model_id=job.get("model_id", ""),
        provider_name=job.get("provider_name", ""),
        provider_id="flux",
        credits_used=job.get("num_images", 1),
        provider_credit_cost=job.get("provider_credit_cost", 0),
        platform_profit=job.get("platform_profit", 0),
        status="pending",
        log_type="retry",
        failure_reason=f"Retried by admin {admin['user_id']}"
    )
    
    return {"success": True, "message": f"Job {job_id} retried successfully"}

@router.get("/jobs/queue", response_model=List[Dict[str, Any]])
async def get_job_queue(admin: dict = Depends(verify_admin)):
    """Get current job queue with priority ordering"""
    jobs = await DatabaseService.get_jobs_by_status("pending", 100)
    
    # Add processing jobs
    processing_jobs = await DatabaseService.get_jobs_by_status("processing", 50)
    
    return {
        "pending": jobs,
        "processing": processing_jobs,
        "queue_size": len(jobs),
        "processing_count": len(processing_jobs)
    }

@router.get("/jobs/stats", response_model=Dict[str, Any])
async def get_job_stats(admin: dict = Depends(verify_admin)):
    """Get job statistics"""
    sb = DatabaseService.get_client()
    
    # Count jobs by status
    statuses = ["pending", "processing", "completed", "failed", "cancelled"]
    stats = {}
    
    for status in statuses:
        response = sb.table("generation_jobs").select("id").eq("status", status).execute()
        stats[status] = len(response.data or [])
    
    # Get total jobs
    total_response = sb.table("generation_jobs").select("id").execute()
    stats["total"] = len(total_response.data or [])
    
    # Get today's jobs
    from datetime import datetime, timedelta
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    
    today_response = sb.table("generation_jobs").select("id").gte("created_at", today.isoformat()).lt("created_at", tomorrow.isoformat()).execute()
    stats["today"] = len(today_response.data or [])
    
    return stats

@router.get("/jobs/logs", response_model=List[Dict[str, Any]])
async def get_job_logs(
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    log_type: Optional[str] = Query(None, description="Filter by log type"),
    limit: int = Query(100, ge=1, le=1000, description="Number of logs to return"),
    admin: dict = Depends(verify_admin)
):
    """Get job logs with optional filtering"""
    sb = DatabaseService.get_client()
    
    query = sb.table("job_logs").select("*").order("created_at", desc=True).limit(limit)
    
    if job_id:
        query = query.eq("job_id", job_id)
    
    if log_type:
        query = query.eq("log_type", log_type)
    
    response = query.execute()
    return response.data or []

@router.get("/jobs/priority/{job_id}")
async def get_job_priority(job_id: str, admin: dict = Depends(verify_admin)):
    """Get job priority information"""
    sb = DatabaseService.get_client()
    response = sb.table("generation_jobs").select("priority, account_type, created_at").eq("job_id", job_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = response.data[0]
    
    return {
        "job_id": job_id,
        "priority": job["priority"],
        "account_type": job["account_type"],
        "created_at": job["created_at"],
        "priority_explanation": f"Priority {job['priority']} based on {job['account_type']} account type"
    }

@router.put("/jobs/{job_id}/priority")
async def update_job_priority(
    job_id: str, 
    priority: int = Query(..., ge=1, le=10, description="New priority value (1-10)"),
    admin: dict = Depends(verify_admin)
):
    """Update job priority"""
    sb = DatabaseService.get_client()
    
    # Get the job
    job_response = sb.table("generation_jobs").select("*").eq("job_id", job_id).execute()
    
    if not job_response.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = job_response.data[0]
    
    # Only allow updating pending jobs
    if job["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot update priority of job {job_id} with status {job['status']}")
    
    # Update priority
    sb.table("generation_jobs").update({
        "priority": priority,
        "updated_at": "now()"
    }).eq("job_id", job_id).execute()
    
    # Log the priority change
    await DatabaseService.log_job_event(
        job_id=job_id,
        user_id=job["user_id"],
        username=job.get("job_owner_username", ""),
        account_type=job.get("account_type", "free"),
        prompt=job.get("prompt", ""),
        negative_prompt=job.get("negative_prompt", ""),
        model_name=job.get("model_name", ""),
        model_id=job.get("model_id", ""),
        provider_name=job.get("provider_name", ""),
        provider_id="flux",
        credits_used=job.get("num_images", 1),
        provider_credit_cost=job.get("provider_credit_cost", 0),
        platform_profit=job.get("platform_profit", 0),
        status=job["status"],
        log_type="priority_updated",
        failure_reason=f"Priority changed to {priority} by admin {admin['user_id']}"
    )
    
    return {"success": True, "message": f"Job {job_id} priority updated to {priority}"}
