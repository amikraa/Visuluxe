"""
Visuluxe Private Backend - Main Application

Fully OpenAI API-compatible backend for image generation, chat completions,
text completions, and embeddings. Designed to work as a drop-in replacement
with any OpenAI SDK.
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.routers import images, models, admin, auth, chat_completions, completions, embeddings, public_models, admin_models
from app.errors import (
    openai_http_exception_handler,
    openai_validation_exception_handler,
    openai_generic_exception_handler,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    # Startup
    logger.info("=" * 60)
    logger.info("Starting Visuluxe Backend (OpenAI-compatible API)")
    logger.info(f"  Cloudflare Account: {settings.cloudflare_account_id}")
    logger.info(f"  R2 Bucket:          {settings.R2_BUCKET_NAME}")
    logger.info(f"  Queue:              {settings.cf_queue_name}")
    logger.info("=" * 60)

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
    title="Visuluxe API",
    description="""
OpenAI-compatible API for AI image generation and more.

## Compatibility

This API is fully compatible with the OpenAI API specification. You can use
any OpenAI SDK (Python, Node.js, etc.) by simply changing the `base_url` to
point to this server.

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /v1/models` | List available models |
| `POST /v1/chat/completions` | Chat completions (streaming supported) |
| `POST /v1/completions` | Text completions (legacy) |
| `POST /v1/embeddings` | Create embeddings |
| `POST /v1/images/generations` | Generate images |

## Authentication

Pass your API key via the `Authorization: Bearer <key>` header, or use
`X-API-Key: <key>`, or a Supabase JWT token.
    """,
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.supabase_url] if settings.supabase_url else ["*"],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS", "DELETE", "PUT", "PATCH"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Internal-Secret",
        "X-API-Key",
        "X-User-ID",
        "X-API-Key-ID",
    ],
)

# ---- OpenAI-compatible error handlers ----
app.add_exception_handler(HTTPException, openai_http_exception_handler)
app.add_exception_handler(RequestValidationError, openai_validation_exception_handler)
app.add_exception_handler(Exception, openai_generic_exception_handler)

# ---- Routers ----
# OpenAI-compatible endpoints (all under /v1)
app.include_router(models.router, prefix="/v1/models", tags=["Models"])
app.include_router(chat_completions.router, prefix="/v1", tags=["Chat Completions"])
app.include_router(completions.router, prefix="/v1", tags=["Completions"])
app.include_router(embeddings.router, prefix="/v1", tags=["Embeddings"])
app.include_router(images.router, prefix="/v1/images", tags=["Images"])

# Internal / Visuluxe-specific endpoints
app.include_router(auth.router, prefix="/v1/auth", tags=["Authentication"])
app.include_router(admin.router, prefix="/v1/admin", tags=["Admin"])


# ---- Health & root endpoints ----


@app.get("/health")
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    return {
        "status": "healthy",
        "service": "visuluxe-backend",
        "version": "2.0.0",
    }


@app.get("/")
async def root():
    """API root -- returns basic service info and documentation links."""
    return {
        "name": "Visuluxe API",
        "version": "2.0.0",
        "openai_compatible": True,
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json",
        "endpoints": {
            "models": "/v1/models",
            "chat_completions": "/v1/chat/completions",
            "completions": "/v1/completions",
            "embeddings": "/v1/embeddings",
            "images": "/v1/images/generations",
        },
    }
