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
        
        # Query models table to get the UUID for this model name
        model_response = sb.table("models").select("id").eq("model_id", model_name).execute()
        if model_response.data:
            model_uuid = model_response.data[0]["id"]
        
        # Get user account type and username for priority calculation
        user_id = job_data.get("user_id")
        plan_type = "free"
        account_type = "normal"
        username = ""
        priority = 1
        
        if user_id:
            user_response = sb.table("profiles").select("plan_type, account_type, username").eq("user_id", user_id).execute()
            if user_response.data:
                plan_type = user_response.data[0].get("plan_type", "free")
                account_type = user_response.data[0].get("account_type", "normal")
                username = user_response.data[0].get("username", "")
                
                # Set priority based on plan type
                if plan_type == "enterprise":
                    priority = 10
                elif plan_type == "pro":
                    priority = 5
                else:
                    priority = 1
        
        # Calculate credits and costs
        credits_used = job_data.get("n", 1)  # Default to 1 credit per image
        provider_credit_cost = 0
        platform_profit = 0
        
        # Get provider configuration for cost calculation
        provider_config_response = sb.table("provider_configurations").select("*").eq("provider_id", "flux").execute()
        if provider_config_response.data:
            provider_config = provider_config_response.data[0]
            provider_credit_cost = provider_config.get("cost_per_generation", 0) * credits_used
            platform_profit = credits_used - provider_credit_cost
        
        sb.table("generation_jobs").insert({
            "job_id": job_id,
            "user_id": user_id,
            "status": "pending",
            "prompt": job_data.get("prompt", ""),
            "negative_prompt": job_data.get("negative_prompt", ""),
            "model_id": model_uuid,  # Store the actual UUID, not the model name
            "size": job_data.get("size", "1024x1024"),
            "num_images": job_data.get("n", 1),
            "expires_at": (datetime.utcnow() + timedelta(minutes=ttl_minutes)).isoformat(),
            "account_type": account_type,
            "priority": priority,
            "job_owner_username": username,
            "provider_credit_cost": provider_credit_cost,
            "platform_profit": platform_profit,
            "model_name": model_name,
            "provider_name": "Flux"
        }).execute()
        
        # Log job creation
        await cls.log_job_event(
            job_id=job_id,
            user_id=user_id or "",
            username=username,
            account_type=account_type,
            prompt=job_data.get("prompt", ""),
            negative_prompt=job_data.get("negative_prompt", ""),
            model_name=model_name,
            model_id=model_uuid or "",
            provider_name="Flux",
            provider_id="flux",
            credits_used=credits_used,
            provider_credit_cost=provider_credit_cost,
            platform_profit=platform_profit,
            status="pending",
            log_type="created",
            metadata={"job_data": job_data}
        )
        
        logger.info(f"Stored pending job {job_id} with model {model_name} (UUID: {model_uuid}), priority: {priority}, account_type: {account_type}")
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

        # Also keep edge_generation_jobs (used by the Edge Function) in sync
        try:
            edge_update: Dict[str, Any] = {
                "updated_at": datetime.utcnow().isoformat(),
                "status": status,
            }

            # If we have signed URLs in the result, store the first one
            if status == "completed" and result:
                images = result.get("images") or []
                if images:
                    # Each image dict should contain a public URL under "url"
                    first = images[0]
                    edge_update["image_url"] = first.get("url")

            if error:
                edge_update["error"] = error

            sb.table("edge_generation_jobs").update(edge_update).eq("backend_job_id", job_id).execute()
            logger.info(f"Synced edge_generation_jobs for backend_job_id {job_id} with status {status}")
        except Exception as e:
            logger.warning(f"Failed to sync edge_generation_jobs for job {job_id}: {e}")
    
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
        else:
            model_id = str(model_id) if model_id else ""
            
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
    
    @classmethod
    async def log_job_event(cls, job_id: str, user_id: str, username: str, account_type: str, 
                           prompt: str, negative_prompt: str, model_name: str, model_id: str,
                           provider_name: str, provider_id: str, credits_used: float,
                           provider_credit_cost: float, platform_profit: float, status: str,
                           image_url: str = None, failure_reason: str = None, 
                           processing_time_ms: int = None, log_type: str = "created",
                           metadata: dict = None):
        """Log job events to job_logs table and send Telegram notifications"""
        sb = cls.get_client()
        
        log_data = {
            "job_id": job_id,
            "user_id": user_id,
            "username": username,
            "account_type": account_type,
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "model_name": model_name,
            "model_id": model_id,
            "provider_name": provider_name,
            "provider_id": provider_id,
            "credits_used": credits_used,
            "provider_credit_cost": provider_credit_cost,
            "platform_profit": platform_profit,
            "status": status,
            "log_type": log_type
        }
        
        if image_url:
            log_data["image_url"] = str(image_url)
        if failure_reason:
            log_data["failure_reason"] = str(failure_reason)
        if processing_time_ms:
            log_data["processing_time_ms"] = int(processing_time_ms)
        if metadata:
            log_data["metadata"] = metadata
        
        sb.table("job_logs").insert(log_data).execute()
        logger.info(f"Logged job event: {job_id} - {log_type} - {status}")
        
        # Send Telegram notification for important events
        if status in ["completed", "failed"]:
            from app.services.telegram_logger import log_image_generation_event
            await log_image_generation_event(
                username=username,
                user_id=user_id,
                account_type=account_type,
                job_id=job_id,
                prompt=prompt,
                model_name=model_name,
                model_id=model_id,
                provider_name=provider_name,
                provider_id=provider_id,
                credits_used=credits_used,
                status=status,
                image_url=image_url,
                failure_reason=failure_reason
            )
    
    @classmethod
    async def get_jobs_by_status(cls, status: str, limit: int = 100) -> List[dict]:
        """Get jobs by status with pagination"""
        sb = cls.get_client()
        response = sb.table("generation_jobs").select("*").eq("status", status).order("created_at", desc=True).limit(limit).execute()
        return response.data or []
    
    @classmethod
    async def get_jobs_by_user(cls, user_id: str, limit: int = 100) -> List[dict]:
        """Get jobs by user with pagination"""
        sb = cls.get_client()
        response = sb.table("generation_jobs").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
        return response.data or []
    
    @classmethod
    async def cancel_job(cls, job_id: str, cancelled_by: str = None) -> bool:
        """Cancel a pending or processing job"""
        try:
            sb = cls.get_client()
            
            # Get the job to check if it exists and can be cancelled
            job_response = sb.table("generation_jobs").select("*").eq("job_id", job_id).execute()
            
            if not job_response.data:
                logger.warning(f"Job {job_id} not found")
                return False
            
            job = job_response.data[0]
            
            # Only allow cancellation of pending or processing jobs
            if job["status"] not in ["pending", "processing"]:
                logger.warning(f"Cannot cancel job {job_id} with status {job['status']}")
                return False
            
            # Update job status to cancelled
            update_data = {
                "status": "cancelled",
                "cancelled_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if cancelled_by:
                update_data["cancelled_by"] = cancelled_by
            
            sb.table("generation_jobs").update(update_data).eq("job_id", job_id).execute()
            
            # Log the cancellation
            await cls.log_job_event(
                job_id=job_id,
                user_id=job["user_id"],
                username=job.get("job_owner_username", ""),
                account_type=job.get("account_type", "normal"),
                prompt=job.get("prompt", ""),
                negative_prompt=job.get("negative_prompt", ""),
                model_name=job.get("model_name", ""),
                model_id=job.get("model_id", ""),
                provider_name=job.get("provider_name", ""),
                provider_id="flux",  # Default provider
                credits_used=job.get("num_images", 1),
                provider_credit_cost=job.get("provider_credit_cost", 0),
                platform_profit=job.get("platform_profit", 0),
                status="cancelled",
                log_type="cancelled",
                failure_reason="User cancelled"
            )
            
            logger.info(f"Cancelled job {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error cancelling job {job_id}: {e}")
            return False
    
    @classmethod
    async def get_job_priority_queue(cls) -> Optional[dict]:
        """Get next job based on priority (Enterprise > Pro > Free)"""
        sb = cls.get_client()
        
        # Get pending jobs ordered by priority (desc) and then by created_at (asc)
        pending_response = sb.table("generation_jobs").select("*").eq("status", "pending").order("priority", desc=True).order("created_at", desc=False).limit(1).execute()
        
        if pending_response.data:
            job = pending_response.data[0]
            # Update job status to processing
            sb.table("generation_jobs").update({
                "status": "processing", 
                "started_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("job_id", job["job_id"]).execute()
            
            # Log job start
            await cls.log_job_event(
                job_id=job["job_id"],
                user_id=job["user_id"],
                username=job.get("job_owner_username", ""),
                account_type=job.get("account_type", "normal"),
                prompt=job.get("prompt", ""),
                negative_prompt=job.get("negative_prompt", ""),
                model_name=job.get("model_name", ""),
                model_id=job.get("model_id", ""),
                provider_name=job.get("provider_name", ""),
                provider_id="flux",
                credits_used=job.get("num_images", 1),
                provider_credit_cost=job.get("provider_credit_cost", 0),
                platform_profit=job.get("platform_profit", 0),
                status="processing",
                log_type="started"
            )
            
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
        
        logger.info("No pending jobs found in priority queue")
        return None
