"""
Centralized Configuration Service
Provides cached, runtime-accessible configuration management with fallback to environment variables
"""
import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, Optional, Union
from datetime import datetime, timedelta
from functools import lru_cache

from supabase.client import Client
from fastapi import HTTPException

from app.config import settings
from app.services.database import DatabaseService

logger = logging.getLogger(__name__)


class ConfigService:
    """Centralized configuration service with caching and fallback support"""
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl: Dict[str, datetime] = {}
        self._cache_timeout = 300  # 5 minutes default cache timeout
        self._lock = asyncio.Lock()
        
        # Configuration categories and their defaults
        self._config_defaults = {
            # Job Processing
            "job_concurrency_limit": {"default": 10, "type": "int", "category": "job_processing"},
            "max_concurrent_jobs_per_user": {"default": 2, "type": "int", "category": "job_processing"},
            "job_timeout_minutes": {"default": 30, "type": "int", "category": "job_processing"},
            "auto_retry_enabled": {"default": True, "type": "bool", "category": "job_processing"},
            "max_retry_attempts": {"default": 3, "type": "int", "category": "job_processing"},
            
            # Provider Health Monitoring
            "health_check_interval": {"default": 300, "type": "int", "category": "provider_health"},
            "health_check_timeout": {"default": 10, "type": "int", "category": "provider_health"},
            "failure_threshold": {"default": 3, "type": "int", "category": "provider_health"},
            "auto_disable_on_failure": {"default": True, "type": "bool", "category": "provider_health"},
            "response_time_threshold": {"default": 5000, "type": "int", "category": "provider_health"},
            
            # Storage Lifecycle
            "default_image_ttl_minutes": {"default": 60, "type": "int", "category": "storage"},
            "max_image_size_mb": {"default": 10, "type": "int", "category": "storage"},
            "cleanup_interval_hours": {"default": 1, "type": "int", "category": "storage"},
            "enable_long_term_storage": {"default": False, "type": "bool", "category": "storage"},
            "max_storage_days": {"default": 90, "type": "int", "category": "storage"},
            
            # Telegram Alerts
            "telegram_alerts_enabled": {"default": False, "type": "bool", "category": "notifications"},
            "telegram_alert_types": {"default": ["system_alerts", "security_events"], "type": "list", "category": "notifications"},
            "telegram_chat_id": {"default": "", "type": "str", "category": "notifications"},
            
            # Security Limits
            "rate_limit_rpm": {"default": 60, "type": "int", "category": "security"},
            "rate_limit_rpd": {"default": 1000, "type": "int", "category": "security"},
            "max_images_per_request": {"default": 4, "type": "int", "category": "security"},
            "max_prompt_length": {"default": 1000, "type": "int", "category": "security"},
            "allowed_domains": {"default": ["*"], "type": "list", "category": "security"},
            
            # System Behavior
            "maintenance_mode": {"default": False, "type": "bool", "category": "system"},
            "maintenance_message": {"default": "System is under maintenance. Please try again later.", "type": "str", "category": "system"},
            "enable_debug_logging": {"default": False, "type": "bool", "category": "system"},
            "api_version": {"default": "v1", "type": "str", "category": "system"},
        }
    
    async def initialize(self):
        """Initialize the configuration service"""
        try:
            # Load initial configuration
            await self._load_all_config()
            logger.info("Configuration service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize configuration service: {e}")
            raise
    
    async def get(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value with caching and fallback
        
        Args:
            key: Configuration key
            default: Default value if not found
            
        Returns:
            Configuration value with proper type conversion
        """
        # Check cache first
        if self._is_cached(key):
            return self._get_cached(key)
        
        # Fetch from database
        try:
            async with self._lock:
                value = await self._fetch_from_db(key)
                if value is not None:
                    self._cache_value(key, value)
                    return self._convert_type(key, value)
        except Exception as e:
            logger.error(f"Error fetching config {key} from database: {e}")
        
        # Fallback to environment variables
        env_value = self._get_from_env(key)
        if env_value is not None:
            self._cache_value(key, env_value)
            return self._convert_type(key, env_value)
        
        # Fallback to defaults
        default_value = self._get_default(key)
        if default_value is not None:
            self._cache_value(key, default_value)
            return default_value
        
        # Final fallback
        return default
    
    async def set(self, key: str, value: Any, description: str = "", updated_by: str = "system"):
        """
        Set a configuration value and update cache
        
        Args:
            key: Configuration key
            value: Configuration value
            description: Optional description
            updated_by: Who updated this setting
        """
        try:
            sb = DatabaseService.get_client()
            
            # Prepare the record
            record = {
                "key": key,
                "value": value,
                "description": description,
                "updated_by": updated_by,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Upsert the configuration
            response = sb.table("system_settings").upsert(record, on_conflict="key").execute()
            
            if response.data:
                # Update cache
                self._cache_value(key, value)
                logger.info(f"Configuration updated: {key} = {value}")
            else:
                logger.warning(f"Failed to update configuration: {key}")
                
        except Exception as e:
            logger.error(f"Error updating config {key}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update configuration: {key}")
    
    async def get_all(self) -> Dict[str, Any]:
        """Get all configuration values"""
        try:
            if not self._cache:
                await self._load_all_config()
            
            result = {}
            for key in self._config_defaults.keys():
                result[key] = await self.get(key)
            
            return result
        except Exception as e:
            logger.error(f"Error getting all config: {e}")
            return {}
    
    async def get_by_category(self, category: str) -> Dict[str, Any]:
        """Get all configuration values for a specific category"""
        try:
            result = {}
            for key, config_info in self._config_defaults.items():
                if config_info["category"] == category:
                    result[key] = await self.get(key)
            return result
        except Exception as e:
            logger.error(f"Error getting config by category {category}: {e}")
            return {}
    
    async def refresh(self, key: str = None):
        """Refresh configuration cache"""
        try:
            if key:
                # Refresh specific key
                await self._refresh_key(key)
            else:
                # Refresh all configuration
                await self._load_all_config()
            logger.info(f"Configuration cache refreshed{' for ' + key if key else ''}")
        except Exception as e:
            logger.error(f"Error refreshing config cache: {e}")
    
    def clear_cache(self):
        """Clear all cached configuration"""
        self._cache.clear()
        self._cache_ttl.clear()
        logger.info("Configuration cache cleared")
    
    # Private methods
    
    def _is_cached(self, key: str) -> bool:
        """Check if value is cached and not expired"""
        if key not in self._cache_ttl:
            return False
        
        return datetime.utcnow() < self._cache_ttl[key]
    
    def _get_cached(self, key: str) -> Any:
        """Get cached value"""
        return self._cache.get(key)
    
    def _cache_value(self, key: str, value: Any):
        """Cache a configuration value"""
        self._cache[key] = value
        self._cache_ttl[key] = datetime.utcnow() + timedelta(seconds=self._cache_timeout)
    
    async def _fetch_from_db(self, key: str) -> Optional[Any]:
        """Fetch configuration value from database"""
        sb = DatabaseService.get_client()
        response = sb.table("system_settings").select("value").eq("key", key).single().execute()
        return response.data["value"] if response.data else None
    
    def _get_from_env(self, key: str) -> Optional[Any]:
        """Get configuration value from environment variables"""
        env_key = key.upper().replace("_", "_")
        value = os.getenv(env_key)
        if value is not None:
            return self._convert_type(key, value)
        return None
    
    def _get_default(self, key: str) -> Optional[Any]:
        """Get default configuration value"""
        config_info = self._config_defaults.get(key)
        if config_info:
            return config_info["default"]
        return None
    
    def _convert_type(self, key: str, value: Any) -> Any:
        """Convert value to appropriate type based on configuration schema"""
        if value is None:
            return None
        
        config_info = self._config_defaults.get(key)
        if not config_info:
            return value
        
        value_type = config_info["type"]
        
        try:
            if value_type == "int":
                return int(value)
            elif value_type == "bool":
                if isinstance(value, bool):
                    return value
                return str(value).lower() in ('true', '1', 'yes', 'on')
            elif value_type == "list":
                if isinstance(value, list):
                    return value
                if isinstance(value, str):
                    # Parse comma-separated string
                    return [item.strip() for item in value.split(',') if item.strip()]
                return []
            elif value_type == "json":
                if isinstance(value, dict):
                    return value
                if isinstance(value, str):
                    return json.loads(value)
                return {}
            else:
                return str(value)
        except (ValueError, json.JSONDecodeError) as e:
            logger.warning(f"Failed to convert config value for {key}: {value} to {value_type}: {e}")
            return self._get_default(key)
    
    async def _load_all_config(self):
        """Load all configuration from database"""
        try:
            sb = DatabaseService.get_client()
            response = sb.table("system_settings").select("key, value").execute()
            
            if response.data:
                for record in response.data:
                    key = record["key"]
                    value = record["value"]
                    self._cache_value(key, value)
            
            logger.info(f"Loaded {len(response.data or [])} configuration values from database")
        except Exception as e:
            logger.error(f"Error loading all config: {e}")
    
    async def _refresh_key(self, key: str):
        """Refresh a specific configuration key"""
        try:
            value = await self._fetch_from_db(key)
            if value is not None:
                self._cache_value(key, value)
            else:
                # Remove from cache if not found in database
                self._cache.pop(key, None)
                self._cache_ttl.pop(key, None)
        except Exception as e:
            logger.error(f"Error refreshing config key {key}: {e}")


# Global instance
config_service = ConfigService()


# Convenience functions for easy access
async def get_config(key: str, default: Any = None) -> Any:
    """Get a configuration value"""
    return await config_service.get(key, default)


async def set_config(key: str, value: Any, description: str = "", updated_by: str = "system"):
    """Set a configuration value"""
    await config_service.set(key, value, description, updated_by)


async def get_all_config() -> Dict[str, Any]:
    """Get all configuration values"""
    return await config_service.get_all()


async def get_config_by_category(category: str) -> Dict[str, Any]:
    """Get all configuration values for a category"""
    return await config_service.get_by_category(category)


async def refresh_config(key: str = None):
    """Refresh configuration cache"""
    await config_service.refresh(key)


def clear_config_cache():
    """Clear configuration cache"""
    config_service.clear_cache()