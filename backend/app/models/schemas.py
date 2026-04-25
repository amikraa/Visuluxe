"""
Pydantic schemas for request/response models
OpenAI-compatible API schemas
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime


# Image Generation Request (OpenAI-compatible)
class ImageGenerationRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
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
    model_config = {"protected_namespaces": ()}
    created: bool
    job_id: str
    status: str


class ImageJobStatusResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    job_id: str
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None


class GeneratedImage(BaseModel):
    model_config = {"protected_namespaces": ()}
    url: str
    revised_prompt: Optional[str] = None
    r2_key: str
    expires_at: datetime


# Model list response (OpenAI-compatible)
class ModelObject(BaseModel):
    model_config = {"protected_namespaces": ()}
    id: str
    object: str = "model"
    created: int
    owned_by: str
    permission: List[dict] = []
    root: str
    parent: Optional[str] = None


class ModelListResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    object: str = "list"
    data: List[ModelObject]


# Admin configuration
class BackendConfig(BaseModel):
    model_config = {"protected_namespaces": ()}
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


# Model Registry Schemas

class ModelCreate(BaseModel):
    model_config = {"protected_namespaces": ()}
    name: str
    model_id: str
    description: Optional[str] = None
    tier: str = "Free"
    max_images: int = 1
    supports_i2i: bool = False
    processing_type: str = "Async"
    max_wait_time: str = "5 min"
    capabilities: dict = {}
    supported_sizes: list = []


class ModelUpdate(BaseModel):
    model_config = {"protected_namespaces": ()}
    name: Optional[str] = None
    model_id: Optional[str] = None
    description: Optional[str] = None
    tier: Optional[str] = None
    max_images: Optional[int] = None
    supports_i2i: Optional[bool] = None
    processing_type: Optional[str] = None
    max_wait_time: Optional[str] = None
    capabilities: Optional[dict] = None
    supported_sizes: Optional[list] = None


class ModelStatusUpdate(BaseModel):
    model_config = {"protected_namespaces": ()}
    status: str  # active, maintenance, disabled


class ModelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: str
    name: str
    model_id: str
    description: Optional[str] = None
    tier: str
    max_images: int
    supports_i2i: bool
    processing_type: str
    max_wait_time: str
    capabilities: dict
    supported_sizes: list
    status: str
    created_at: datetime
    updated_at: datetime

class ModelProviderCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    provider_id: str
    provider_model_id: str
    provider_cost: float
    platform_price: float
    max_images_supported: int = 1


class ModelProviderUpdate(BaseModel):
    model_config = {"protected_namespaces": ()}
    provider_model_id: Optional[str] = None
    provider_cost: Optional[float] = None
    platform_price: Optional[float] = None
    max_images_supported: Optional[int] = None
    status: Optional[str] = None  # active, maintenance, disabled


class ModelProviderResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    id: str
    provider_id: str
    provider_name: str
    provider_model_id: str
    provider_cost: float
    platform_price: float
    max_images_supported: int
    status: str


class ModelAnalyticsQuery(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None    # YYYY-MM-DD
    model_id: Optional[str] = None


class ModelAnalyticsResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_id: str
    model_name: str
    date: str  # YYYY-MM-DD
    total_provider_cost: float
    profit: float