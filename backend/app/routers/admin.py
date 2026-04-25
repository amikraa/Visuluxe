from fastapi import APIRouter, Depends, HTTPException, Query, Request
from app.security import get_current_user
from app.services.database import DatabaseService
from app.services.monitoring import monitoring_service
from app.services.abuse_detector import abuse_detector
from app.services.audit_logger import audit_logger, AuditAction
from app.services.telegram_logger import log_system_alert
from typing import List, Dict, Any, Optional
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    # Check x-forwarded-for header first (for proxy setups)
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    # Check cf-connecting-ip (Cloudflare)
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip
    # Fall back to direct client IP
    if request.client:
        return request.client.host
    return "unknown"


async def verify_admin(user: dict = Depends(get_current_user)):
    from app.security import get_supabase
    sb = get_supabase()
    response = sb.table("user_roles").select("role").eq("user_id", user["user_id"]).in_("role", ["admin", "super_admin"]).execute()
    if not response.data:
        raise HTTPException(status_code=403, detail="Admin access required")
    audit_logger.log_admin_access(
        admin_user_id=user["user_id"],
        endpoint="/admin/*",
        ip_address="unknown",
        success=True
    )
    return user


@router.get("/config")
async def get_backend_config(admin: dict = Depends(verify_admin), request: Request = None):
    # Log admin access
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint="/v1/admin/config",
        ip_address=ip_addr,
        success=True
    )
    return {"message": "Backend config endpoint"}


@router.post("/cleanup-expired")
async def cleanup_expired_images(admin: dict = Depends(verify_admin), request: Request = None):
    from app.services.storage import StorageService
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    
    # Log admin access first
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint="/v1/admin/cleanup-expired",
        ip_address=ip_addr,
        success=True
    )
    
    # Perform cleanup
    from app.services.storage import StorageService
    await StorageService.cleanup_expired_images()
    
    # Log the cleanup action
    audit_logger.log_cleanup(
        admin_user_id=admin_user_id,
        action="expired_images",
        count=0,
        ip_address=ip_addr
    )
    
    return {"success": True, "message": "Expired images cleaned up"}


@router.get("/failed-jobs", response_model=List[Dict[str, Any]])
async def get_failed_jobs(
    limit: int = 50, 
    admin: dict = Depends(verify_admin),
    request: Request = None
):
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint="/v1/admin/failed-jobs",
        ip_address=ip_addr,
        success=True
    )
    
    failed_jobs = await DatabaseService.get_failed_jobs(limit)
    return failed_jobs


@router.delete("/failed-jobs/{job_id}")
async def terminate_failed_job(
    job_id: str, 
    admin: dict = Depends(verify_admin),
    request: Request = None
):
    """Terminate/delete a failed job - with full audit trail"""
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    
    # Log admin access
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint=f"/v1/admin/failed-jobs/{job_id}",
        ip_address=ip_addr,
        success=True
    )
    
    # Perform the termination
    success = await DatabaseService.terminate_failed_job(job_id)
    
    if success:
        # Log the termination action with full audit trail
        audit_logger.log_job_terminate(
            admin_user_id=admin_user_id,
            job_id=job_id,
            ip_address=ip_addr
        )
        return {"success": True, "message": f"Failed job {job_id} terminated successfully"}
    else:
        # Log failed attempt
        audit_logger.log_job_terminate(
            admin_user_id=admin_user_id,
            job_id=job_id,
            ip_address=ip_addr
        )  # Still log attempt
        raise HTTPException(status_code=400, detail=f"Failed to terminate job {job_id}")


@router.get("/jobs", response_model=List[Dict[str, Any]])
async def get_jobs(
    status: Optional[str] = Query(None, description="Filter by job status"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    limit: int = Query(100, ge=1, le=1000, description="Number of jobs to return"),
    admin: dict = Depends(verify_admin),
    request: Request = None
):
    """Get jobs with optional filtering - logged for audit"""
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint="/v1/admin/jobs",
        ip_address=ip_addr,
        success=True
    )
    
    if status:
        jobs = await DatabaseService.get_jobs_by_status(status, limit)
    elif user_id:
        jobs = await DatabaseService.get_jobs_by_user(user_id, limit)
    else:
        sb = DatabaseService.get_client()
        response = sb.table("generation_jobs").select("*").order("created_at", desc=True).limit(limit).execute()
        jobs = response.data or []
    
    return jobs


@router.get("/jobs/{job_id}", response_model=Dict[str, Any])
async def get_job_details(
    job_id: str, 
    admin: dict = Depends(verify_admin),
    request: Request = None
):
    """Get detailed information about a specific job - with full audit trail"""
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    
    # Log admin access to sensitive job details
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint=f"/v1/admin/jobs/{job_id}",
        ip_address=ip_addr,
        success=True
    )
    
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
async def cancel_job(
    job_id: str, 
    admin: dict = Depends(verify_admin),
    request: Request = None
):
    """Cancel a pending or processing job - with full audit trail"""
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    
    # Log admin access
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint=f"/v1/admin/jobs/{job_id}/cancel",
        ip_address=ip_addr,
        success=True
    )
    
    success = await DatabaseService.cancel_job(job_id, admin_user_id)
    if success:
        # Log the cancellation action with full audit trail
        audit_logger.log_job_cancel(
            admin_user_id=admin_user_id,
            job_id=job_id,
            ip_address=ip_addr
        )
        return {"success": True, "message": f"Job {job_id} cancelled successfully"}
    else:
        raise HTTPException(status_code=400, detail=f"Failed to cancel job {job_id}")


@router.post("/jobs/{job_id}/retry")
async def retry_job(
    job_id: str, 
    admin: dict = Depends(verify_admin),
    request: Request = None
):
    """Retry a failed job - with full audit trail including before state"""
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    
    # Log admin access
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint=f"/v1/admin/jobs/{job_id}/retry",
        ip_address=ip_addr,
        success=True
    )
    
    sb = DatabaseService.get_client()
    
    # Get the job with before state
    job_response = sb.table("generation_jobs").select("*").eq("job_id", job_id).execute()
    
    if not job_response.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = job_response.data[0]
    before_state = {
        "status": job["status"],
        "retry_count": job.get("retry_count", 0),
        "error": job.get("error")
    }
    
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
    
    # Log the retry with BEFORE state for audit trail
    audit_logger.log_job_retry(
        admin_user_id=admin_user_id,
        job_id=job_id,
        before_state=before_state,
        ip_address=ip_addr
    )
    
    return {"success": True, "message": f"Job {job_id} retried successfully"}


@router.get("/jobs/queue", response_model=List[Dict[str, Any]])
async def get_job_queue(admin: dict = Depends(verify_admin), request: Request = None):
    """Get current job queue with priority ordering"""
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint="/v1/admin/jobs/queue",
        ip_address=ip_addr,
        success=True
    )
    
    jobs = await DatabaseService.get_jobs_by_status("pending", 100)
    processing_jobs = await DatabaseService.get_jobs_by_status("processing", 50)
    
    return {
        "pending": jobs,
        "processing": processing_jobs,
        "queue_size": len(jobs),
        "processing_count": len(processing_jobs)
    }


@router.get("/jobs/stats", response_model=Dict[str, Any])
async def get_job_stats(admin: dict = Depends(verify_admin), request: Request = None):
    """Get job statistics"""
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint="/v1/admin/jobs/stats",
        ip_address=ip_addr,
        success=True
    )
    
    sb = DatabaseService.get_client()
    
    statuses = ["pending", "processing", "completed", "failed", "cancelled"]
    stats = {}
    
    for status in statuses:
        response = sb.table("generation_jobs").select("id").eq("status", status).execute()
        stats[status] = len(response.data or [])
    
    total_response = sb.table("generation_jobs").select("id").execute()
    stats["total"] = len(total_response.data or [])
    
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
    admin: dict = Depends(verify_admin),
    request: Request = None
):
    """Get job logs with optional filtering"""
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint="/v1/admin/jobs/logs",
        ip_address=ip_addr,
        success=True
    )
    
    sb = DatabaseService.get_client()
    
    query = sb.table("job_logs").select("*").order("created_at", desc=True).limit(limit)
    
    if job_id:
        query = query.eq("job_id", job_id)
    
    if log_type:
        query = query.eq("log_type", log_type)
    
    response = query.execute()
    return response.data or []


@router.get("/jobs/priority/{job_id}")
async def get_job_priority(
    job_id: str, 
    admin: dict = Depends(verify_admin),
    request: Request = None
):
    """Get job priority information"""
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint=f"/v1/admin/jobs/priority/{job_id}",
        ip_address=ip_addr,
        success=True
    )
    
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
    admin: dict = Depends(verify_admin),
    request: Request = None
):
    """Update job priority - with full audit trail including before/after state"""
    admin_user_id = admin["user_id"]
    ip_addr = get_client_ip(request) if request else "unknown"
    
    # Log admin access
    audit_logger.log_admin_access(
        admin_user_id=admin_user_id,
        endpoint=f"/v1/admin/jobs/{job_id}/priority",
        ip_address=ip_addr,
        success=True
    )
    
    sb = DatabaseService.get_client()
    
    # Get the job with before state
    job_response = sb.table("generation_jobs").select("*").eq("job_id", job_id).execute()
    
    if not job_response.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = job_response.data[0]
    old_priority = job["priority"]
    
    # Only allow updating pending jobs
    if job["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot update priority of job {job_id} with status {job['status']}")
    
    # Update priority
    sb.table("generation_jobs").update({
        "priority": priority,
        "updated_at": "now()"
    }).eq("job_id", job_id).execute()
    
    # Log the priority change with BEFORE and AFTER state for full audit trail
    audit_logger.log_job_priority_change(
        admin_user_id=admin_user_id,
        job_id=job_id,
        old_priority=old_priority,
        new_priority=priority,
        ip_address=ip_addr
    )
    
    return {"success": True, "message": f"Job {job_id} priority updated from {old_priority} to {priority}"}