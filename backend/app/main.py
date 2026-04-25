"""
Visuluxe Private Backend - FastAPI application entry point.
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import logging

from app.config import settings, DEGRADED_MODE, ENV
from app.routers import (images, models, admin, auth, chat_completions,
                         completions, embeddings, public_models, admin_models, admin_settings)
from app.errors import (openai_http_exception_handler,
                       openai_validation_exception_handler,
                       openai_generic_exception_handler)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info("=" * 60)
    logger.info("Visuluxe Backend v2.0.0 starting...")

    if DEGRADED_MODE:
        logger.warning("⚠️  DEGRADED MODE - Supabase not configured")
        logger.warning("   All database operations return safe empty results.")
        logger.warning("   Authentication will fail with 503.")
        logger.warning("   Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to restore full functionality.")
        logger.info("=" * 60)
    else:
        logger.info(f"Environment:    {ENV}")
        logger.info(f"Supabase:       CONNECTED")
        logger.info("=" * 60)

    # Block production startup without database
    if settings.env == "production" and DEGRADED_MODE:
        logger.critical("BLOCKED: Production mode requires Supabase. Fix env vars first.")
        raise RuntimeError(
            "CRITICAL: Cannot start in production without Supabase. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )

    # Initialize services
    from app.services.queue import QueueService
    QueueService.initialize()

    from app.services.processor import ImageProcessor
    import asyncio
    processing_task = asyncio.create_task(ImageProcessor.start_processing_loop())

    yield

    logger.info("Shutting down backend...")
    processing_task.cancel()
    try:
        await processing_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Visuluxe API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS - trusted origins only (no wildcard)
_trusted = [
    "https://amikra.zo.space",
    "https://visuluxe.app",
    "http://localhost:3000",
    "http://localhost:5173",
]
if settings.supabase_url and settings.supabase_url not in _trusted:
    _trusted.append(settings.supabase_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_trusted,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Request-Timestamp"],
)

app.add_exception_handler(HTTPException, openai_http_exception_handler)
app.add_exception_handler(RequestValidationError, openai_validation_exception_handler)
app.add_exception_handler(Exception, openai_generic_exception_handler)

# Routers
app.include_router(models.router, prefix="/v1/models", tags=["Models"])
app.include_router(chat_completions.router, prefix="/v1", tags=["Chat Completions"])
app.include_router(completions.router, prefix="/v1", tags=["Completions"])
app.include_router(embeddings.router, prefix="/v1", tags=["Embeddings"])
app.include_router(images.router, prefix="/v1/images", tags=["Images"])
app.include_router(auth.router, prefix="/v1/auth", tags=["Authentication"])
app.include_router(admin.router, prefix="/v1/admin", tags=["Admin"])
app.include_router(admin_settings.router, prefix="/v1/admin", tags=["Admin Settings"])


@app.get("/health")
async def health_check():
    return {
        "status": "degraded" if DEGRADED_MODE else "ok",
        "service": "visuluxe-backend",
        "version": "2.0.0",
        "environment": ENV,
        "database": "degraded" if DEGRADED_MODE else "connected",
    }


@app.get("/")
async def root():
    return {
        "name": "Visuluxe API",
        "version": "2.0.0",
        "environment": ENV,
        "degraded_mode": DEGRADED_MODE,
        "openai_compatible": True,
        "docs": "/docs",
    }
