"""
POST /v1/images/generations
GET  /v1/images/jobs/{job_id}

OpenAI-compatible image generation endpoint. Supports both synchronous
(wait for result) and asynchronous (job polling) modes.
"""
import time
import logging
import re
from datetime import datetime, timedelta

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
from app.services.database import DatabaseService
from app.services.config_service import get_config
from app.adapters.registry import get_adapter
from app.errors import InsufficientCreditsError, ServerError

logger = logging.getLogger(__name__)
router = APIRouter()

# =============================================================================
# SIZE VALIDATION - VULN-011 FIX
# =============================================================================
# Strict image size validation to prevent resource exhaustion via malformed/extreme inputs
# - Only allow preset sizes and common aspect ratios
# - Enforce bounds: min=64, max=2048 pixels per dimension
# - Reject non-numeric, negative, or oversized dimensions
# =============================================================================

VALID_IMAGE_SIZES = {
    # Square presets
    "256x256": (256, 256),
    "512x512": (512, 512),
    "1024x1024": (1024, 1024),
    # Portrait presets  
    "768x1024": (768, 1024),
    "1024x1792": (1024, 1792),
    # Landscape presets
    "1024x768": (1024, 768),
    "1792x1024": (1792, 1024),
    # Wide/Ultrawide
    "1280x720": (1280, 720),
    "1920x1080": (1920, 1080),
}

# Aspect ratio buckets (width x height) - accepted with tolerance
ASPECT_RATIO_BUCKETS = {
    "1:1": (1.0, 0.1),      # Square ±10%
    "16:9": (16/9, 0.15),    # Landscape ±15%
    "9:16": (9/16, 0.15),    # Portrait ±15%
    "4:3": (4/3, 0.15),      # Standard ±15%
    "3:4": (3/4, 0.15),      # Portrait standard ±15%
    "21:9": (21/9, 0.2),     # Ultrawide ±20%
}

MIN_DIMENSION = 64
MAX_DIMENSION = 2048
MAX_PIXELS = 2048 * 2048  # 4MP max to prevent memory exhaustion


def _validate_and_normalize_size(size: str) -> tuple[int, int]:
    """
    Validate and normalize image size string.
    
    SECURITY: VULN-011 fix - prevents resource exhaustion via malformed size inputs.
    Rejects extreme, negative, or non-numeric dimensions BEFORE any processing.
    
    Args:
        size: String in format "WIDTHxHEIGHT" (e.g., "1024x1024")
        
    Returns:
        Tuple of (width, height) as integers
        
    Raises:
        HTTPException: If size is invalid, out of bounds, or malformed
    """
    if not size:
        # Default to 1024x1024 if not specified
        return (1024, 1024)
    
    size = str(size).strip().lower()
    
    # Check for preset sizes first (fast path)
    if size in VALID_IMAGE_SIZES:
        return VALID_IMAGE_SIZES[size]
    
    # Parse WIDTHxHEIGHT format
    match = re.match(r'^(\d+)[x×](\d+)$', size)
    if not match:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid size format '{size}'. Use WIDTHxHEIGHT (e.g., '1024x1024'). "
                   f"Valid presets: {', '.join(VALID_IMAGE_SIZES.keys())}"
        )
    
    try:
        width = int(match.group(1))
        height = int(match.group(2))
    except (ValueError, OverflowError):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid size values in '{size}'. Width and height must be integers."
        )
    
    # Reject negative dimensions
    if width <= 0 or height <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid size '{size}'. Dimensions must be positive integers."
        )
    
    # Reject dimension below minimum
    if width < MIN_DIMENSION or height < MIN_DIMENSION:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid size '{size}'. Minimum dimension is {MIN_DIMENSION}px."
        )
    
    # Reject dimension above maximum
    if width > MAX_DIMENSION or height > MAX_DIMENSION:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid size '{size}'. Maximum dimension is {MAX_DIMENSION}px per side."
        )
    
    # Reject extreme pixel counts (memory exhaustion protection)
    pixel_count = width * height
    if pixel_count > MAX_PIXELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid size '{size}'. Maximum pixels allowed: {MAX_PIXELS:,} ({MAX_DIMENSION}x{MAX_DIMENSION}). "
                   f"Requested: {pixel_count:,}."
        )
    
    # Validate aspect ratio is reasonable
    if min(width, height) > 0:
        aspect_ratio = width / height
        aspect_ratio_tolerance = 0.15  # 15% tolerance
        
        valid_aspect = False
        for ratio_name, (expected_ratio, tolerance) in ASPECT_RATIO_BUCKETS.items():
            if abs(aspect_ratio - expected_ratio) <= tolerance * expected_ratio:
                valid_aspect = True
                break
        
        if not valid_aspect:
            # Check if it's close to any common ratio
            closest_ratio = min(
                ASPECT_RATIO_BUCKETS.items(),
                key=lambda x: abs((x[1][0] - aspect_ratio) / aspect_ratio)
            )
            ratio_name, (expected_ratio, _) = closest_ratio
            deviation = abs((aspect_ratio - expected_ratio) / expected_ratio) * 100
            raise HTTPException(
                status_code=400,
                detail=f"Invalid aspect ratio for '{size}'. Aspect ratio {aspect_ratio:.2f} deviates "
                       f"{deviation:.1f}% from valid presets. Use standard ratios like 1:1, 16:9, 9:16, 4:3."
            )
    
    return (width, height)


def _format_size(width: int, height: int) -> str:
    """Format width x height as string."""
    return f"{width}x{height}"


async def check_rate_limit(user_id: str, api_key_id: str = None) -> dict:
    """
    Per-user rate limiting check.
    
    SECURITY: Implements sliding window rate limiting to prevent:
    - Resource exhaustion attacks
    - Shadow AI Service attacks (CHAIN-001)
    - Credit card fraud via unlimited generation
    
    Returns dict with allowed status and current counts.
    """
    try:
        from app.services.config_service import get_config
        
        # Get rate limits from config (with defaults)
        default_rpm = await get_config("rate_limit_rpm", 60)
        default_rpd = await get_config("rate_limit_rpd", 1000)
        
        # User-specific overrides from API key or profile
        custom_rpm = None
        custom_rpd = None
        
        if api_key_id:
            sb = DatabaseService.get_client()
            key_response = sb.table("api_keys").select("custom_rpm, custom_rpd").eq("id", api_key_id).single().execute()
            if key_response.data:
                custom_rpm = key_response.data.get("custom_rpm")
                custom_rpd = key_response.data.get("custom_rpd")
        
        rpm_limit = custom_rpm or default_rpm
        rpd_limit = custom_rpd or default_rpd
        
        # Get current counts
        now = datetime.utcnow()
        one_minute_ago = now - timedelta(minutes=1)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        sb = DatabaseService.get_client()
        
        # Count requests in last minute
        minute_response = sb.table("request_logs").select(
            "id", 
            count="exact"
        ).eq("user_id", user_id).gte("created_at", one_minute_ago.isoformat()).execute()
        minute_count = minute_response.count or 0
        
        # Count requests today
        day_response = sb.table("request_logs").select(
            "id", 
            count="exact"
        ).eq("user_id", user_id).gte("created_at", start_of_day.isoformat()).execute()
        day_count = day_response.count or 0
        
        # Check limits
        if minute_count >= rpm_limit:
            return {
                "allowed": False,
                "reason": "rpm_exceeded",
                "retry_after": 60,
                "current_rpm": minute_count,
                "rpm_limit": rpm_limit,
                "current_rpd": day_count,
                "rpd_limit": rpd_limit
            }
        
        if day_count >= rpd_limit:
            # Calculate seconds until midnight
            seconds_until_midnight = (24 * 3600) - (now.hour * 3600 + now.minute * 60 + now.second)
            return {
                "allowed": False,
                "reason": "rpd_exceeded",
                "retry_after": seconds_until_midnight,
                "current_rpm": minute_count,
                "rpm_limit": rpm_limit,
                "current_rpd": day_count,
                "rpd_limit": rpd_limit
            }
        
        return {
            "allowed": True,
            "current_rpm": minute_count,
            "rpm_limit": rpm_limit,
            "current_rpd": day_count,
            "rpd_limit": rpd_limit
        }
        
    except Exception as e:
        logger.error(f"Rate limit check failed: {e}")
        # SECURITY: Fail CLOSED on system errors - deny requests when we cannot verify limits
        return {
            "allowed": False,
            "reason": "rate_limit_system_unavailable",
            "retry_after": 60,
            "current_rpm": 0,
            "rpm_limit": 60,
            "current_rpd": 0,
            "rpd_limit": 1000
        }


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
    api_key_id = user.get("api_key_id")
    
    # SECURITY: Check rate limit BEFORE accepting the job
    # This prevents resource exhaustion even if model is valid
    rate_limit_check = await check_rate_limit(user_id, api_key_id)
    if not rate_limit_check["allowed"]:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {rate_limit_check.get('retry_after', 60)} seconds. "
                   f"Limit: {rate_limit_check['rpm_limit']} requests/minute, "
                   f"{rate_limit_check['rpd_limit']} requests/day."
        )
    
    # Check and reserve credits
    credit_check = await CreditService.check_and_reserve_credits(
        user_id=user_id, amount=body.n
    )
    if not credit_check["success"]:
        raise InsufficientCreditsError(
            f"Insufficient credits. Required: {body.n}, available: {credit_check.get('available', 0)}"
        )

    # Validate model status (maintenance enforcement)
    model_id = body.model or "flux-dev"
    from app.services.provider import ProviderService
    model_info = await ProviderService.get_model_info(model_id)
    
    # SECURITY: Strict fail-closed model validation - VULN-012/REGRESSION-001 fix
    # ONLY "active" models are accepted. All other statuses are rejected.
    ALLOWED_MODEL_STATUSES = {"active"}
    
    if not model_info:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{model_id}' not found. Unknown models are rejected to prevent Shadow AI Service attacks."
        )
    
    model_status = model_info.get("status")
    if model_status not in ALLOWED_MODEL_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{model_id}' is not available (status: {model_status or 'unknown'}). Only active models are accepted."
        )

    # SECURITY: Validate and normalize size parameter BEFORE any processing
    # VULN-011 fix - prevents resource exhaustion via malformed/extreme sizes
    try:
        validated_width, validated_height = _validate_and_normalize_size(body.size)
        normalized_size = _format_size(validated_width, validated_height)
    except HTTPException:
        raise  # Re-raise validation errors
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid size '{body.size}': {str(e)}"
        )

    # Enqueue the job
    job_data = {
        "user_id": user_id,
        "prompt": body.prompt,
        "negative_prompt": body.negative_prompt,
        "model": model_id,
        "size": normalized_size,
        "n": body.n,
        "quality": body.quality,
        "style": body.style,
        "seed": body.seed,
    }
    job_id = await QueueService.enqueue_job(job_data)
    
    # Log request for rate limiting
    try:
        sb = DatabaseService.get_client()
        sb.table("request_logs").insert({
            "user_id": user_id,
            "api_key_id": api_key_id,
            "endpoint": "/v1/images/generations",
            "method": "POST",
            "status_code": 202,
            "ip_address": "unknown",  # Would need request context for real IP
            "created_at": datetime.utcnow().isoformat()
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to log request: {e}")

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
    user_id = user["user_id"]
    status = await QueueService.get_job_status(job_id, user_id)

    if status.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Job not found")

    if status.get("status") == "forbidden":
        raise HTTPException(status_code=403, detail="You do not have access to this job")

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