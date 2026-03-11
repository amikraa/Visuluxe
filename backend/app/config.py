"""
Visuluxe Backend Configuration
Secure configuration management with Cloudflare credentials
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()


class Settings(BaseSettings):
    model_config = {
        "env_file": ".env",
        "extra": "allow",
        "env_file_encoding": "utf-8",
    }
    
    # Supabase Configuration
    supabase_url: str = ""
    supabase_service_key: str = ""
    
    # Internal Security - MUST be set for server-to-server communication
    internal_secret: str = ""
    
    # Cloudflare Configuration
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    
    # Cloudflare R2 Configuration
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_ENDPOINT: str = ""
    R2_PUBLIC_BASE_URL: str = ""
    
    # Cloudflare Queue Configuration
    cf_queue_name: str = ""
    cf_queue_binding: str = ""
    
    # Rate Limiting
    default_rpm: int = 60
    default_rpd: int = 1000
    max_concurrent_jobs_per_user: int = 2
    
    # Image Settings (Admin controlled via database)
    default_image_ttl_minutes: int = 60
    max_image_size: int = 2048
    max_images_per_generation: int = 4
    
    # Provider Settings
    flux_api_url: str = ""
    
    # Telegram Configuration
    telegram_bot_token: str = ""
    telegram_admin_chat_id: str = ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
