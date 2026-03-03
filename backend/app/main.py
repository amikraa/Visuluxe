"""
Visuluxe Private Backend - Main Application
Secure FastAPI backend for image generation
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.routers import images, models, admin, auth

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management"""
    # Startup
    logger.info("=" * 50)
    logger.info("Starting Visuluxe Private Image Generation Backend")
    logger.info(f"Cloudflare Account: {settings.cloudflare_account_id}")
    logger.info(f"R2 Bucket: {settings.R2_BUCKET_NAME}")
    logger.info(f"Queue: {settings.cf_queue_name}")
    logger.info("=" * 50)
    
    # Initialize services
    from app.services.queue import QueueService
    QueueService.initialize()
    
    # Start image processing loop in background
    from app.services.processor import ImageProcessor
    import asyncio
    processing_task = asyncio.create_task(ImageProcessor.start_processing_loop())
    
    yield
    
    # Shutdown
    logger.info("Shutting down backend")
    processing_task.cancel()
    try:
        await processing_task
    except asyncio.CancelledError:
        pass


# Create FastAPI application
app = FastAPI(
    title="Visuluxe Image Generation API",
    description="""Private backend for secure image generation.
    
## Features
- **OpenAI-compatible endpoints** - Use standard OpenAI SDKs
- **Secure image storage** - Private R2 bucket with signed URLs
- **Job queue processing** - Cloudflare Queues for reliable processing
- **Credit management** - Automatic credit reservation and refunds
- **User isolation** - Strict user_id enforcement from JWT tokens

## Security
- Server-to-server communication uses X-Internal-Secret header
- User ID is always derived from JWT, never client body
- API keys are hashed and validated server-side
- Images stored in private bucket with short-lived signed URLs
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS - Only allow Supabase
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.supabase_url] if settings.supabase_url else ["*"],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Internal-Secret", "X-API-Key"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc) if settings.internal_secret else "Contact support"}
    )

# Include routers
app.include_router(auth.router, prefix="/v1/auth", tags=["Authentication"])
app.include_router(images.router, prefix="/v1/images", tags=["Image Generation"])
app.include_router(models.router, prefix="/v1/models", tags=["Models"])
app.include_router(admin.router, prefix="/v1/admin", tags=["Admin"])

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "visuluxe-backend",
        "version": "1.0.0"
    }

# Root endpoint
@app.get("/")
async def root():
    """API root"""
    return {
        "name": "Visuluxe Image Generation API",
        "version": "1.0.0",
        "docs": "/docs",
        "openapi": "/openapi.json"
    }
