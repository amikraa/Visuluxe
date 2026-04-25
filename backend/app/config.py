"""
Visuluxe Backend Configuration
Secure configuration management with Cloudflare credentials and environment mode.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """Application settings with env var support and environment mode detection."""

    model_config = {
        "env_file": ".env",
        "extra": "allow",
        "env_file_encoding": "utf-8",
        "protected_namespaces": (),  # Fix pydantic v2 'model' namespace conflict
    }

    env: str = "development"

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    internal_secret: str = ""

    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_ENDPOINT: str = ""
    R2_PUBLIC_BASE_URL: str = ""
    cf_queue_name: str = ""
    cf_queue_binding: str = ""

    default_rpm: int = 60
    default_rpd: int = 1000
    max_concurrent_jobs_per_user: int = 2
    default_image_ttl_minutes: int = 60
    max_image_size: int = 2048
    max_images_per_generation: int = 4
    flux_api_url: str = ""
    telegram_bot_token: str = ""
    telegram_admin_chat_id: str = ""


def is_degraded() -> bool:
    """True when Supabase is not configured (degraded mode)."""
    return not bool(settings.supabase_url and settings.supabase_service_role_key)


def is_production() -> bool:
    """True when running in production mode."""
    return settings.env == "production"


def is_development() -> bool:
    """True when running in development mode."""
    return settings.env == "development"


def check_production_safety() -> None:
    """Raise RuntimeError if Supabase is missing in production mode."""
    if is_production() and is_degraded():
        raise RuntimeError(
            "CRITICAL: Cannot start in production without Supabase. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables."
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


DEGRADED_MODE = is_degraded()
ENV = settings.env
IS_PRODUCTION = is_production()
IS_DEVELOPMENT = is_development()
