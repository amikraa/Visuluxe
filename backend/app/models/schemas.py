"""
Pydantic schemas for request/response models
OpenAI-compatible API schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


# Image Generation Request (OpenAI-compatible)
class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000, description="Text description of the desired image")
    model: Optional[str] = Field(default="flux-dev", description="Model to use for generation")
    n: int = Field(default=1, ge=1, le=4, description="Number of images to generate")
    size: Optional[str] = Field(default="1024x1024", description="Size of the generated images")
    quality: Optional[Literal["standard", "hd"]] = Field(default="standard", description="Quality of the image")
    style: Optional[Literal["natural", "vivid", "anime"]] = Field(default="natural", description="Style of the image")
    negative_prompt: Optional[str] = Field(default=None, description="What to avoid in the image")
    seed: Optional[int] = Field(default=None, description="Seed for reproducible results")


# Response models
class ImageGenerationResponse(BaseModel):
    created: bool
    job_id: str
    status: str


class ImageJobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None


class GeneratedImage(BaseModel):
    url: str
    revised_prompt: Optional[str] = None
    r2_key: str
    expires_at: datetime


# Model list response (OpenAI-compatible)
class ModelObject(BaseModel):
    id: str
    object: str = "model"
    created: int
    owned_by: str
    permission: List[dict] = []
    root: str
    parent: Optional[str] = None


class ModelListResponse(BaseModel):
    object: str = "list"
    data: List[ModelObject]


# Admin configuration
class BackendConfig(BaseModel):
    image_ttl_minutes: int = 60
    max_concurrent_jobs: int = 2
    rate_limit_rpm: int = 60
    rate_limit_rpd: int = 1000
    max_images_per_generation: int = 4
    max_image_size: int = 2048


# Job status enum
class JobStatus(str):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
