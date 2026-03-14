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
            
            # Get model information and call appropriate provider API
            model_id = job_data.get("model")
            if model_id:
                model_info = await cls._get_model_info(model_id)
                if model_info:
                    result = await cls._call_provider_api(job_data, model_info)
                else:
                    # Fallback to Flux if model not found
                    result = await cls._call_flux_provider(job_data)
            else:
                # Fallback to Flux if no model specified
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
                    
                    # Update model analytics after successful generation
                    await cls._update_model_analytics(job_data, result, processed_images)
                    
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
    async def _call_provider_api(cls, job_data: dict, model_info: dict) -> Optional[Dict[str, Any]]:
        """Call the appropriate provider API based on model configuration"""
        try:
            import uuid
            import json
            from app.services.provider_health import get_provider_status
            
            # Get active providers for this model
            providers = model_info.get("providers", [])
            if not providers:
                return {"success": False, "error": "No active providers configured for this model"}
            
            # Apply provider selection algorithm:
            # 1. Filter providers where status = active
            active_providers = [p for p in providers if p.get("status") == "active"]
            if not active_providers:
                return {"success": False, "error": "No active providers available for this model"}
            
            # 2. Filter providers where provider health = healthy
            healthy_providers = []
            for provider in active_providers:
                health_status = await get_provider_status(provider["provider_id"])
                if health_status.get("status") == "healthy":
                    healthy_providers.append(provider)
            
            if not healthy_providers:
                return {"success": False, "error": "No healthy providers available for this model"}
            
            # 3. Sort by provider_cost ascending
            # 4. Select cheapest provider first, but implement fallback
            sorted_providers = sorted(healthy_providers, key=lambda x: float(x.get("provider_cost", float('inf'))))
            
            # Try each provider in order until one succeeds (fallback mechanism)
            last_error = None
            for selected_provider in sorted_providers:
                provider_id = selected_provider["provider_id"]
                provider_model_id = selected_provider["provider_model_id"]
                
                # Get provider configuration
                provider_config = await cls._get_provider_config(provider_id)
                if not provider_config:
                    last_error = f"Provider {provider_id} not configured"
                    continue
                
                try:
                    # Generate a unique device ID for each request
                    device_id = str(uuid.uuid4())
                    
                    # Build payload based on provider
                    payload = {
                        "device_id": device_id,
                        "prompt": job_data.get("prompt", "").strip(),
                        "size": job_data.get("size", "1024x1024"),
                        "n": job_data.get("n", 1),
                        "output_format": "png"
                    }
                    
                    # Add provider-specific parameters
                    if provider_id == "flux":
                        # Flux-specific configuration
                        payload["model"] = provider_model_id
                    elif provider_id == "openai":
                        # OpenAI-specific configuration
                        payload["model"] = provider_model_id
                        payload["quality"] = job_data.get("quality", "standard")
                        payload["style"] = job_data.get("style", "vivid")
                    
                    headers = {
                        "accept": "*/*",
                        "content-type": "application/json",
                        "origin": "https://deepimg.ai",
                        "referer": "https://deepimg.ai/",
                        "user-agent": "Mozilla/5.0 (Linux; Android 15; POCO F5) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
                    }
                    
                    # Add provider-specific headers
                    if provider_id == "flux":
                        headers["x-api-key"] = provider_config.get("api_key", "")
                    elif provider_id == "openai":
                        headers["Authorization"] = f"Bearer {provider_config.get('api_key', '')}"
                    
                    api_url = provider_config.get("api_url", cls.flux_api_url)
                    
                    logger.info(f"Calling {provider_id} API: {api_url}")
                    logger.info(f"Payload: {payload}")
                    
                    async with aiohttp.ClientSession() as session:
                        async with session.post(
                            api_url, 
                            json=payload, 
                            headers=headers,
                            timeout=aiohttp.ClientTimeout(total=120)
                        ) as response:
                            
                            logger.info(f"{provider_id} API response status: {response.status}")
                            logger.info(f"{provider_id} API response headers: {dict(response.headers)}")
                            
                            if response.status == 200:
                                try:
                                    result = await response.json()
                                    logger.info(f"{provider_id} API success response: {result}")
                                    return {"success": True, "data": result, "selected_provider": selected_provider}
                                except json.JSONDecodeError as e:
                                    error_text = await response.text()
                                    logger.error(f"Failed to parse {provider_id} API response as JSON: {e}")
                                    logger.error(f"Raw response: {error_text}")
                                    last_error = "Invalid JSON response from API"
                                    continue
                            else:
                                error_text = await response.text()
                                logger.error(f"{provider_id} API error {response.status}: {error_text}")
                                last_error = f"API error {response.status}: {error_text}"
                                continue
                                
                except asyncio.TimeoutError:
                    logger.error(f"{provider_id} API request timed out")
                    last_error = "Request timed out"
                    continue
                except Exception as e:
                    logger.error(f"{provider_id} API call failed: {e}")
                    logger.exception(e)
                    last_error = str(e)
                    continue
            
            # If all providers failed, return the last error
            return {"success": False, "error": f"All providers failed. Last error: {last_error}"}
            
        except Exception as e:
            logger.error(f"Provider API call failed: {e}")
            logger.exception(e)
            return {"success": False, "error": str(e)}
    
    @classmethod
    async def _get_provider_config(cls, provider_id: str) -> Optional[Dict[str, Any]]:
        """Get provider configuration from database"""
        sb = DatabaseService.get_client()
        response = sb.table("provider_configurations").select("*").eq("provider_id", provider_id).single().execute()
        return response.data if response.data else None
    
    @classmethod
    async def _get_model_info(cls, model_id: str, refresh: bool = False) -> Optional[Dict[str, Any]]:
        """Get model information from database using new model registry"""
        sb = DatabaseService.get_client()
        # First get the model from the models table
        model_response = sb.table("models").select("*").eq("model_id", model_id).single().execute()
        if not model_response.data:
            return None
        
        model_data = model_response.data
        
        # Check if model is in maintenance (real-time check)
        if model_data.get("status") == "maintenance":
            logger.warning(f"Model {model_id} is in maintenance mode")
            return None
        
        # Get active provider mappings for this model (real-time refresh)
        provider_response = sb.table("model_providers").select("*").eq("model_id", model_data["id"]).eq("status", "active").execute()
        
        # Get provider details
        if provider_response.data:
            provider_ids = [p["provider_id"] for p in provider_response.data]
            providers_response = sb.table("providers").select("*").in_("id", provider_ids).execute()
            providers_dict = {p["id"]: p for p in providers_response.data} if providers_response.data else {}
            
            # Combine model data with provider information
            model_data["providers"] = []
            for mapping in provider_response.data:
                provider = providers_dict.get(mapping["provider_id"])
                if provider:
                    model_data["providers"].append({
                        "id": mapping["id"],
                        "provider_id": mapping["provider_id"],
                        "provider_name": provider["name"],
                        "provider_model_id": mapping["provider_model_id"],
                        "provider_cost": float(mapping["provider_cost"]),
                        "platform_price": float(mapping["platform_price"]),
                        "max_images_supported": mapping["max_images_supported"],
                        "status": mapping["status"]
                    })
        
        return model_data
    
    @classmethod
    async def _call_flux_provider(cls, job_data: dict) -> Optional[Dict[str, Any]]:
        """Call the Flux provider API (fallback method)"""
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
    async def _update_model_analytics(cls, job_data: dict, result: dict, processed_images: List[Dict[str, Any]]):
        """Update model analytics after successful generation"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            from datetime import date
            
            model_id = job_data.get("model")
            selected_provider = result.get("selected_provider")
            
            if not model_id or not selected_provider:
                logger.warning("Cannot update analytics: missing model_id or selected_provider")
                return
            
            # Calculate analytics values
            num_images = len(processed_images)
            provider_cost = float(selected_provider.get("provider_cost", 0))
            platform_price = float(selected_provider.get("platform_price", 0))
            
            total_provider_cost = provider_cost * num_images
            total_revenue = platform_price * num_images
            profit = total_revenue - total_provider_cost
            
            today = date.today()
            
            # Check if analytics record exists for today
            analytics_response = sb.table("model_analytics").select("*").eq("model_id", model_id).eq("date", today.isoformat()).execute()
            
            if analytics_response.data:
                # Update existing record
                existing_analytics = analytics_response.data[0]
                updated_analytics = {
                    "total_generations": existing_analytics["total_generations"] + num_images,
                    "total_revenue": float(existing_analytics["total_revenue"]) + total_revenue,
                    "total_provider_cost": float(existing_analytics["total_provider_cost"]) + total_provider_cost,
                    "profit": float(existing_analytics["profit"]) + profit,
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                sb.table("model_analytics").update(updated_analytics).eq("id", existing_analytics["id"]).execute()
                logger.info(f"Updated analytics for model {model_id}: +{num_images} generations, +${total_revenue:.2f} revenue, +${total_provider_cost:.2f} cost, +${profit:.2f} profit")
            else:
                # Create new analytics record
                new_analytics = {
                    "model_id": model_id,
                    "date": today.isoformat(),
                    "total_generations": num_images,
                    "total_revenue": total_revenue,
                    "total_provider_cost": total_provider_cost,
                    "profit": profit
                }
                
                sb.table("model_analytics").insert(new_analytics).execute()
                logger.info(f"Created new analytics for model {model_id}: {num_images} generations, ${total_revenue:.2f} revenue, ${total_provider_cost:.2f} cost, ${profit:.2f} profit")
                
        except Exception as e:
            logger.error(f"Failed to update model analytics: {e}")
            logger.exception(e)

    @classmethod
    async def start_processing_loop(cls):
        """Start the continuous job processing loop with priority support"""
        logger.info("Starting image processing loop with priority queue")
        
        while True:
            try:
                # Get next job based on priority (Enterprise > Pro > Free)
                job = await DatabaseService.get_job_priority_queue()
                
                if job:
                    logger.info(f"Processing priority job: {job['id']} (Priority: {job.get('priority', 1)})")
                    await cls.process_job(job)
                else:
                    # No jobs, sleep briefly
                    await asyncio.sleep(5)
                    
            except Exception as e:
                logger.error(f"Processing loop error: {e}")
                await asyncio.sleep(10)
