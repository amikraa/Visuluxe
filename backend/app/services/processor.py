"""
Image Processing Service
Handles image generation workflow including provider API calls and R2 storage
"""
import logging
import asyncio
import aiohttp
from typing import Optional, Dict, Any, List
from datetime import datetime

from app.services.storage import StorageService
from app.services.database import DatabaseService

logger = logging.getLogger(__name__)


class ImageProcessor:
    flux_api_url: str = ""
    
    @classmethod
    def initialize(cls):
        from app.config import settings
        cls.flux_api_url = settings.flux_api_url
        logger.info(f"Image processor initialized with API URL: {cls.flux_api_url}")
    
    @classmethod
    async def process_job(cls, job: dict) -> bool:
        """Process a single image generation job"""
        if not cls.flux_api_url:
            cls.initialize()
        
        job_id = job["id"]
        job_data = job["data"]
        
        try:
            # Update job status to processing
            await DatabaseService.update_job_status(job_id, "processing")
            
            # Call Flux provider API
            result = await cls._call_flux_provider(job_data)
            
            if result and result.get("success"):
                # Process and store images
                processed_images = await cls._process_images(result, job_data.get("user_id"))
                
                if processed_images:
                    # Update job with completed status and image URLs
                    await DatabaseService.update_job_status(
                        job_id, 
                        "completed", 
                        {"images": processed_images}
                    )
                    
                    # Store individual images in images table
                    await DatabaseService.store_generated_images(job_id, {"images": processed_images})
                    
                    logger.info(f"Successfully processed job {job_id} with {len(processed_images)} images")
                    return True
                else:
                    error_msg = "Failed to process generated images"
                    await DatabaseService.update_job_status(job_id, "failed", error=error_msg)
                    logger.error(f"Job {job_id} failed: {error_msg}")
                    return False
            else:
                error_msg = result.get("error", "Provider API call failed") if result else "Provider API call failed"
                await DatabaseService.update_job_status(job_id, "failed", error=error_msg)
                logger.error(f"Job {job_id} failed: {error_msg}")
                return False
                
        except Exception as e:
            error_msg = f"Processing error: {str(e)}"
            await DatabaseService.update_job_status(job_id, "failed", error=error_msg)
            logger.error(f"Job {job_id} failed with exception: {e}")
            return False
    
    @classmethod
    async def _call_flux_provider(cls, job_data: dict) -> Optional[Dict[str, Any]]:
        """Call the Flux provider API"""
        try:
            import uuid
            import json
            
            # Generate a unique device ID for each request (like your working code)
            device_id = str(uuid.uuid4())
            
            payload = {
                "device_id": device_id,
                "prompt": job_data.get("prompt", "").strip(),
                "size": job_data.get("size", "1024x1024"),
                "n": job_data.get("n", 1),
                "output_format": "png"  # Match your working implementation
            }
            
            headers = {
                "accept": "*/*",
                "content-type": "application/json",
                "origin": "https://deepimg.ai",
                "referer": "https://deepimg.ai/",
                "user-agent": "Mozilla/5.0 (Linux; Android 15; POCO F5) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
            }
            
            logger.info(f"Calling Flux API: {cls.flux_api_url}")
            logger.info(f"Payload: {payload}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    cls.flux_api_url, 
                    json=payload, 
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=120)
                ) as response:
                    
                    logger.info(f"Flux API response status: {response.status}")
                    logger.info(f"Flux API response headers: {dict(response.headers)}")
                    
                    if response.status == 200:
                        try:
                            result = await response.json()
                            logger.info(f"Flux API success response: {result}")
                            return {"success": True, "data": result}
                        except json.JSONDecodeError as e:
                            error_text = await response.text()
                            logger.error(f"Failed to parse Flux API response as JSON: {e}")
                            logger.error(f"Raw response: {error_text}")
                            return {"success": False, "error": "Invalid JSON response from API"}
                    else:
                        error_text = await response.text()
                        logger.error(f"Flux API error {response.status}: {error_text}")
                        return {"success": False, "error": f"API error {response.status}: {error_text}"}
                        
        except asyncio.TimeoutError:
            logger.error("Flux API request timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Flux API call failed: {e}")
            logger.exception(e)
            return {"success": False, "error": str(e)}
    
    @classmethod
    async def _process_images(cls, provider_result: dict, user_id: str) -> List[Dict[str, Any]]:
        """Process images from provider response and upload to R2"""
        try:
            # Handle the actual response structure from Flux API
            logger.info(f"Provider result keys: {list(provider_result.keys())}")
            logger.info(f"Provider result: {provider_result}")
            
            # The Flux API response has nested data structure
            # provider_result["data"] contains {"code", "message", "data", "timestamp"}
            # The actual image data is in provider_result["data"]["data"]["images"]
            outer_data = provider_result.get("data", {})
            logger.info(f"Outer data keys: {list(outer_data.keys())}")
            logger.info(f"Outer data: {outer_data}")
            
            inner_data = outer_data.get("data", {})
            logger.info(f"Inner data keys: {list(inner_data.keys())}")
            logger.info(f"Inner data: {inner_data}")
            
            images_data = inner_data.get("images", [])
            logger.info(f"Images data: {images_data}")
            logger.info(f"Number of images found: {len(images_data)}")
            
            processed_images = []
            
            for img_data in images_data:
                image_url = img_data.get("url")
                if image_url:
                    logger.info(f"Downloading image from: {image_url}")
                    
                    # Upload to R2
                    r2_result = await StorageService.upload_image_from_url(image_url, user_id)
                    if r2_result:
                        processed_images.append({
                            "url": r2_result["url"],
                            "r2_key": r2_result["r2_key"],
                            "expires_at": r2_result["expires_at"],
                            "original_url": image_url,
                            "format": r2_result.get("format", "unknown"),
                            "extension": r2_result.get("extension", "png"),
                            "content_type": r2_result.get("content_type", "image/png")
                        })
                        logger.info(f"Successfully uploaded image to R2: {r2_result['url']} (.{r2_result.get('extension', 'png')})")
                    else:
                        logger.warning(f"Failed to upload image to R2: {image_url}")
                else:
                    logger.warning("Image data missing URL field")
            
            logger.info(f"Processed {len(processed_images)} images successfully")
            return processed_images
            
        except Exception as e:
            logger.error(f"Image processing failed: {e}")
            logger.exception(e)
            return []
    
    @classmethod
    async def start_processing_loop(cls):
        """Start the continuous job processing loop"""
        logger.info("Starting image processing loop")
        
        while True:
            try:
                # Get next pending job
                job = await DatabaseService.get_next_pending_job()
                
                if job:
                    logger.info(f"Processing job: {job['id']}")
                    await cls.process_job(job)
                else:
                    # No jobs, sleep briefly
                    await asyncio.sleep(5)
                    
            except Exception as e:
                logger.error(f"Processing loop error: {e}")
                await asyncio.sleep(10)