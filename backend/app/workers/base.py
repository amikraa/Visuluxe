import requests
import uuid
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class BaseWorker(ABC):
    def __init__(self, config: dict = None):
        self.config = config or {}
        self.api_endpoint = self.config.get("api_endpoint")
        self.api_key = self.config.get("api_key")
    
    @abstractmethod
    async def generate(self, prompt: str, negative_prompt: Optional[str] = None, size: str = "1024x1024", n: int = 1, seed: Optional[int] = None, **kwargs) -> Dict[str, Any]:
        pass
    
    async def download_image(self, url: str) -> bytes:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.content
    
    async def process_job(self, job_data: dict) -> dict:
        from app.services.storage import StorageService
        try:
            result = await self.generate(prompt=job_data["prompt"], negative_prompt=job_data.get("negative_prompt"), size=job_data.get("size", "1024x1024"), n=job_data.get("n", 1), seed=job_data.get("seed"))
            uploaded_images = []
            images_data = result.get("images", [])
            for img_data in images_data:
                img_url = img_data.get("url") or img_data.get("image_url")
                if not img_url:
                    continue
                image_bytes = await self.download_image(img_url)
                r2_key = await StorageService.upload_image(image_bytes=image_bytes, user_id=job_data["user_id"], job_id=job_data["job_id"])
                signed_url = await StorageService.generate_signed_url(r2_key)
                expiry = StorageService.get_expiry_time()
                uploaded_images.append({"url": signed_url, "r2_key": r2_key, "expires_at": expiry.isoformat()})
            return {"status": "completed", "images": uploaded_images, "prompt": result.get("revised_prompt", job_data["prompt"])}
        except Exception as e:
            logger.error(f"Job processing failed: {e}", exc_info=True)
            return {"status": "failed", "error": str(e)}

class FluxDevWorker(BaseWorker):
    def __init__(self):
        from app.config import settings
        super().__init__({"api_endpoint": settings.flux_api_url})
    
    async def generate(self, prompt: str, negative_prompt: Optional[str] = None, size: str = "1024x1024", n: int = 1, seed: Optional[int] = None, **kwargs) -> Dict[str, Any]:
        payload = {"device_id": str(uuid.uuid4()), "prompt": prompt.strip(), "size": size, "n": n, "output_format": "png"}
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        if seed:
            payload["seed"] = seed
        headers = {"accept": "*/*", "content-type": "application/json", "origin": "https://deepimg.ai", "referer": "https://deepimg.ai/"}
        response = requests.post(self.api_endpoint, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        return response.json()

class WorkerRegistry:
    _workers = {"flux-dev": FluxDevWorker, "flux-1-dev": FluxDevWorker}
    
    @classmethod
    def get_worker(cls, model: str):
        worker_class = cls._workers.get(model)
        if worker_class:
            return worker_class()
        if "flux" in model.lower():
            return FluxDevWorker()
        return None