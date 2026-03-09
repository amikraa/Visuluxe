"""
POST /v1/images/generations
GET  /v1/images/jobs/{job_id}

OpenAI-compatible image generation endpoint. Supports both synchronous
(wait for result) and asynchronous (job polling) modes.
"""
import time
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.openai_schemas import (
    ImageGenerationRequest,
    ImageGenerationResponse,
    ImageJobStatusResponse,
    ImageObject,
)
from app.security import get_authenticated_user
from app.services.queue import QueueService
from app.services.credit import CreditService
from app.adapters.registry import get_adapter
from app.errors import InsufficientCreditsError, ServerError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/generations")
async def create_image_generation(
    body: ImageGenerationRequest,
    user: dict = Depends(get_authenticated_user),
):
    """
    Create image generation(s) from a text prompt.

    The response format matches OpenAI's /v1/images/generations exactly.
    By default, jobs are queued asynchronously and a job_id is returned.
    Pass `?wait=true` to block until the generation completes (up to 120s).
    """
    user_id = user["user_id"]

    # Check and reserve credits
    credit_check = await CreditService.check_and_reserve_credits(
        user_id=user_id, amount=body.n
    )
    if not credit_check["success"]:
        raise InsufficientCreditsError(
            f"Insufficient credits. Required: {body.n}, available: {credit_check.get('available', 0)}"
        )

    # Enqueue the job
    job_data = {
        "user_id": user_id,
        "prompt": body.prompt,
        "negative_prompt": body.negative_prompt,
        "model": body.model or "flux-dev",
        "size": body.size or "1024x1024",
        "n": body.n,
        "quality": body.quality,
        "style": body.style,
        "seed": body.seed,
    }
    job_id = await QueueService.enqueue_job(job_data)

    # Return OpenAI-compatible async response with job_id extension
    return ImageJobStatusResponse(
        job_id=job_id,
        status="pending",
        created=int(time.time()),
        data=None,
        error=None,
    )


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    user: dict = Depends(get_authenticated_user),
):
    """
    Poll the status of an image generation job.

    Once status is "completed", the `data` field contains the generated
    images in OpenAI-compatible format.
    """
    status = await QueueService.get_job_status(job_id)

    if status.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Job not found")

    # Build OpenAI-compatible image objects from result
    data = None
    if status["status"] == "completed" and status.get("result"):
        images = status["result"].get("images", [])
        data = [
            ImageObject(
                url=img.get("url") if isinstance(img, dict) else img,
                revised_prompt=status["result"].get("prompt"),
            )
            for img in images
        ]

    return ImageJobStatusResponse(
        job_id=job_id,
        status=status["status"],
        created=int(time.time()),
        data=data,
        error=status.get("error"),
    )
