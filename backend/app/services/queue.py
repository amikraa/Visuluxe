"""
Cloudflare Queue Service
Uses Cloudflare Queues for job processing
"""
import logging
import json
import uuid
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class QueueService:
    queue_name: str = "visuluxe-jobs"
    account_id: str = ""
    api_token: str = ""
    
    @classmethod
    def initialize(cls):
        from app.config import settings
        cls.account_id = settings.cloudflare_account_id
        cls.api_token = settings.cloudflare_api_token
        cls.queue_name = settings.cf_queue_name
        logger.info(f"Queue service initialized with queue: {cls.queue_name}")
    
    @classmethod
    async def enqueue_job(cls, job_data: dict) -> str:
        if not cls.account_id:
            cls.initialize()
        
        job_id = str(uuid.uuid4())
        job = {"id": job_id, "status": "pending", "data": job_data, "created_at": "now"}
        
        import aiohttp
        url = f"https://api.cloudflare.com/client/v4/accounts/{cls.account_id}/queues/{cls.queue_name}/messages"
        headers = {"Authorization": f"Bearer {cls.api_token}", "Content-Type": "application/json"}
        payload = {"messages": [{"id": job_id, "body": json.dumps(job)}]}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers) as response:
                    if response.status == 200:
                        logger.info(f"Enqueued job {job_id}")
                    else:
                        error_text = await response.text()
                        logger.warning(f"Queue enqueue failed: {error_text}")
                        await cls._store_job_fallback(job)
                        return job_id
        except Exception as e:
            logger.warning(f"Cloudflare Queue unavailable, using fallback: {e}")
            await cls._store_job_fallback(job)
        
        return job_id
    
    @classmethod
    async def _store_job_fallback(cls, job: dict):
        from app.services.database import DatabaseService
        await DatabaseService.store_pending_job(job)
    
    @classmethod
    async def get_job_status(cls, job_id: str) -> Dict[str, Any]:
        from app.services.database import DatabaseService
        return await DatabaseService.get_job_status(job_id)
    
    @classmethod
    async def update_job_status(cls, job_id: str, status: str, result: Optional[dict] = None, error: Optional[str] = None):
        from app.services.database import DatabaseService
        await DatabaseService.update_job_status(job_id, status, result, error)
    
    @classmethod
    async def dequeue_job(cls) -> Optional[dict]:
        if not cls.account_id:
            cls.initialize()
        
        try:
            import aiohttp
            url = f"https://api.cloudflare.com/client/v4/accounts/{cls.account_id}/queues/{cls.queue_name}/consume"
            headers = {"Authorization": f"Bearer {cls.api_token}"}
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        messages = data.get("messages", [])
                        if messages:
                            job = json.loads(messages[0]["body"])
                            await cls._acknowledge_message(messages[0]["id"])
                            return job
        except Exception as e:
            logger.warning(f"Cloudflare Queue consume failed: {e}")
        
        return await cls._get_next_job_fallback()
    
    @classmethod
    async def _acknowledge_message(cls, message_id: str):
        try:
            import aiohttp
            url = f"https://api.cloudflare.com/client/v4/accounts/{cls.account_id}/queues/{cls.queue_name}/messages/{message_id}/ack"
            headers = {"Authorization": f"Bearer {cls.api_token}"}
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers) as response:
                    pass
        except Exception as e:
            logger.warning(f"Failed to acknowledge message: {e}")
    
    @classmethod
    async def _get_next_job_fallback(cls) -> Optional[dict]:
        from app.services.database import DatabaseService
        return await DatabaseService.get_next_pending_job()
