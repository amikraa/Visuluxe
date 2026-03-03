"""
Database Service
Handles all database operations with Supabase
"""
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class DatabaseService:
    @staticmethod
    def get_client():
        from app.security import get_supabase
        return get_supabase()
    
    @classmethod
    async def store_pending_job(cls, job: dict) -> str:
        sb = cls.get_client()
        job_id = job["id"]
        job_data = job["data"]
        
        from app.config import settings
        ttl_minutes = settings.default_image_ttl_minutes
        
        # Look up the model UUID from the model name
        model_name = job_data.get("model", "flux-dev")
        model_uuid = None
        
        # Query ai_models table to get the UUID for this model name
        model_response = sb.table("ai_models").select("id").eq("model_id", model_name).execute()
        if model_response.data:
            model_uuid = model_response.data[0]["id"]
        
        sb.table("generation_jobs").insert({
            "job_id": job_id,
            "user_id": job_data.get("user_id"),
            "status": "pending",
            "prompt": job_data.get("prompt"),
            "negative_prompt": job_data.get("negative_prompt"),
            "model_id": model_uuid,  # Store the actual UUID, not the model name
            "size": job_data.get("size", "1024x1024"),
            "num_images": job_data.get("n", 1),
            "expires_at": (datetime.utcnow() + timedelta(minutes=ttl_minutes)).isoformat()
        }).execute()
        
        logger.info(f"Stored pending job {job_id} with model {model_name} (UUID: {model_uuid})")
        return job_id
    
    @classmethod
    async def get_job_status(cls, job_id: str) -> Dict[str, Any]:
        sb = cls.get_client()
        response = sb.table("generation_jobs").select("*").eq("job_id", job_id).execute()
        
        if not response.data:
            return {"status": "not_found"}
        
        job = response.data[0]
        
        return {
            "status": job["status"],
            "result": {"images": job.get("signed_urls", []), "prompt": job.get("prompt")} if job["status"] == "completed" else None,
            "error": job.get("error")
        }
    
    @classmethod
    async def update_job_status(cls, job_id: str, status: str, result: Optional[dict] = None, error: Optional[str] = None):
        sb = cls.get_client()
        
        update_data = {"status": status, "updated_at": datetime.utcnow().isoformat()}
        
        if result and status == "completed":
            images = result.get("images", [])
            r2_keys = [img.get("r2_key") for img in images if img.get("r2_key")]
            signed_urls = [img.get("url") for img in images if img.get("url")]
            update_data["r2_keys"] = r2_keys
            update_data["signed_urls"] = signed_urls
        
        if error:
            update_data["error"] = error
            # Get current retry count and increment
            job_response = sb.table("generation_jobs").select("retry_count").eq("job_id", job_id).execute()
            current_retry_count = job_response.data[0].get("retry_count", 0) if job_response.data else 0
            new_retry_count = current_retry_count + 1
            update_data["retry_count"] = new_retry_count
            
            # Archive job if retry count exceeds limit (3 retries)
            if new_retry_count >= 3:
                update_data["archived"] = True
                logger.info(f"Job {job_id} archived after {new_retry_count} failed attempts")
        
        sb.table("generation_jobs").update(update_data).eq("job_id", job_id).execute()
        logger.info(f"Updated job {job_id} status to {status}")
    
    @classmethod
    async def get_pending_jobs(cls) -> List[dict]:
        sb = cls.get_client()
        response = sb.table("generation_jobs").select("*").eq("status", "pending").execute()
        return response.data or []
    
    @classmethod
    async def get_next_pending_job(cls) -> Optional[dict]:
        sb = cls.get_client()
        # Only process pending jobs - remove failed job polling to prevent infinite loops
        pending_response = sb.table("generation_jobs").select("*").eq("status", "pending").order("created_at").limit(1).execute()
        
        logger.info(f"Found {len(pending_response.data)} pending jobs")
        for job in pending_response.data:
            logger.info(f"Pending job {job['job_id']} has status '{job['status']}'")
        
        if pending_response.data:
            job = pending_response.data[0]
            # Update job status to processing
            sb.table("generation_jobs").update({"status": "processing", "updated_at": datetime.utcnow().isoformat()}).eq("job_id", job["job_id"]).execute()
            
            return {
                "id": job["job_id"],
                "data": {
                    "user_id": job["user_id"],
                    "prompt": job["prompt"],
                    "negative_prompt": job.get("negative_prompt"),
                    "model": job.get("model_id"),
                    "size": job.get("size", "1024x1024"),
                    "n": job.get("num_images", 1)
                }
            }
        
        logger.info("No pending jobs found")
        return None
    
    @classmethod
    async def store_generated_images(cls, job_id: str, result: dict):
        sb = cls.get_client()
        job_response = sb.table("generation_jobs").select("*").eq("job_id", job_id).execute()
        
        if not job_response.data:
            logger.error(f"Job {job_id} not found")
            return
        
        job = job_response.data[0]
        images = result.get("images", [])
        
        # Handle model_id - should already be a UUID from store_pending_job, but double-check
        model_id = job.get("model_id")
        # If model_id is not a valid UUID format, set it to None
        if model_id and (not isinstance(model_id, str) or len(str(model_id)) != 36 or '-' not in str(model_id)):
            logger.warning(f"Invalid model_id format: {model_id}, setting to None")
            model_id = None
            
        for img in images:
            sb.table("images").insert({
                "user_id": job["user_id"],
                "prompt": job["prompt"],
                "negative_prompt": job.get("negative_prompt"),
                "model_id": model_id,  # Use the validated model_id or None
                "image_url": img.get("url"),
                "status": "completed",
                "credits_used": job.get("num_images", 1),
                "width": int(job.get("size", "1024x1024").split("x")[0]) if job.get("size") else 1024,
                "height": int(job.get("size", "1024x1024").split("x")[1]) if job.get("size") else 1024,
                "metadata": {"r2_key": img.get("r2_key"), "expires_at": img.get("expires_at")}
            }).execute()
        
        logger.info(f"Stored {len(images)} images for job {job_id}")

    @classmethod
    async def get_failed_jobs(cls, limit: int = 50) -> List[dict]:
        """Get list of failed jobs for admin panel"""
        sb = cls.get_client()
        response = sb.table("generation_jobs").select("*").eq("status", "failed").order("created_at", desc=True).limit(limit).execute()
        return response.data or []

    @classmethod
    async def terminate_failed_job(cls, job_id: str) -> bool:
        """Terminate/delete a failed job"""
        try:
            sb = cls.get_client()
            
            # First, get the job to check if it exists and is failed
            job_response = sb.table("generation_jobs").select("*").eq("job_id", job_id).execute()
            
            if not job_response.data:
                logger.warning(f"Job {job_id} not found")
                return False
            
            job = job_response.data[0]
            
            # Only allow termination of failed jobs
            if job["status"] != "failed":
                logger.warning(f"Cannot terminate job {job_id} with status {job['status']}")
                return False
            
            # Delete the job from generation_jobs table
            delete_response = sb.table("generation_jobs").delete().eq("job_id", job_id).execute()
            
            if delete_response:
                logger.info(f"Terminated failed job {job_id}")
                return True
            else:
                logger.error(f"Failed to delete job {job_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error terminating job {job_id}: {e}")
            return False
