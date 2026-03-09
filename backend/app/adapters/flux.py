"""
Flux provider adapter.

Translates OpenAI image generation requests into the Flux API format used by
deepimg.ai and returns responses in OpenAI-compatible format.
"""
import logging
import uuid
import time
import asyncio
from typing import Dict, Any, Optional, List

import aiohttp

from app.adapters.base import BaseProviderAdapter

logger = logging.getLogger(__name__)


class FluxAdapter(BaseProviderAdapter):
    """Adapter for the Flux image generation provider."""

    provider_name = "flux"

    def __init__(self):
        from app.config import settings
        self.api_url = settings.flux_api_url

    # -- Image generation (the primary capability of Flux) -------------------

    async def image_generation(
        self,
        model: str,
        prompt: str,
        n: int = 1,
        size: str = "1024x1024",
        quality: str = "standard",
        style: str = "natural",
        negative_prompt: Optional[str] = None,
        seed: Optional[int] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Call the Flux API and return an OpenAI-compatible image response."""

        device_id = str(uuid.uuid4())
        payload = {
            "device_id": device_id,
            "prompt": prompt.strip(),
            "size": size,
            "n": n,
            "output_format": "png",
        }
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        if seed is not None:
            payload["seed"] = seed

        headers = {
            "accept": "*/*",
            "content-type": "application/json",
            "origin": "https://deepimg.ai",
            "referer": "https://deepimg.ai/",
            "user-agent": (
                "Mozilla/5.0 (Linux; Android 15; POCO F5) "
                "AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
            ),
        }

        logger.info(f"Flux adapter: calling {self.api_url}")

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.api_url,
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"Flux API error {response.status}: {error_text}")
                        return {"success": False, "error": f"Provider error {response.status}"}

                    result = await response.json()

        except asyncio.TimeoutError:
            return {"success": False, "error": "Provider request timed out"}
        except Exception as e:
            logger.error(f"Flux API call failed: {e}")
            return {"success": False, "error": str(e)}

        # Parse the nested Flux response: result -> data -> data -> images
        outer_data = result.get("data", {})
        inner_data = outer_data.get("data", {}) if isinstance(outer_data, dict) else {}
        images_list = inner_data.get("images", []) if isinstance(inner_data, dict) else []

        image_objects = []
        for img in images_list:
            url = img.get("url")
            if url:
                image_objects.append({"url": url, "revised_prompt": prompt})

        return {
            "success": True,
            "created": int(time.time()),
            "data": image_objects,
        }

    # -- Stubs for non-image endpoints (Flux is image-only) ------------------

    async def chat_completion(self, model, messages, **kwargs):
        raise NotImplementedError("Flux provider only supports image generation")

    async def chat_completion_stream(self, model, messages, **kwargs):
        raise NotImplementedError("Flux provider only supports image generation")
        yield ""  # noqa: unreachable – required for async generator signature

    async def completion(self, model, prompt, **kwargs):
        raise NotImplementedError("Flux provider only supports image generation")

    async def embeddings(self, model, input_texts, **kwargs):
        raise NotImplementedError("Flux provider only supports image generation")
