"""
Admin System Settings API
Provides endpoints for managing system configuration through the centralized config service
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.routers.auth import verify_admin
from app.services.config_service import (
    get_config, set_config, get_all_config, get_config_by_category, 
    refresh_config, clear_config_cache, invalidate_config_cache
)

router = APIRouter(
    prefix="/admin/system-settings",
    tags=["Admin Settings"],
    dependencies=[Depends(verify_admin)]
)


class SettingUpdate(BaseModel):
    """Model for updating a system setting"""
    value: Any
    description: Optional[str] = None
    updated_by: Optional[str] = "admin"


class SettingResponse(BaseModel):
    """Model for setting response"""
    key: str
    value: Any
    description: Optional[str] = None
    updated_by: Optional[str] = None
    updated_at: Optional[str] = None


class BulkSettingsResponse(BaseModel):
    """Model for bulk settings response"""
    settings: Dict[str, Any]
    categories: List[str]


@router.get("/", response_model=BulkSettingsResponse)
async def get_all_system_settings(
    category: Optional[str] = Query(None, description="Filter by category")
):
    """
    Get all system settings
    
    Args:
        category: Optional category filter (job_processing, provider_health, storage, notifications, security, system)
    
    Returns:
        All system settings with available categories
    """
    try:
        if category:
            settings = await get_config_by_category(category)
        else:
            settings = await get_all_config()
        
        # Get all available categories
        categories = [
            "job_processing", "provider_health", "storage", 
            "notifications", "security", "system"
        ]
        
        return BulkSettingsResponse(
            settings=settings,
            categories=categories
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve system settings: {str(e)}")


@router.get("/{key}", response_model=SettingResponse)
async def get_system_setting(key: str):
    """
    Get a specific system setting
    
    Args:
        key: The configuration key
    
    Returns:
        The setting value and metadata
    """
    try:
        value = await get_config(key)
        
        # Try to get additional metadata from database
        from app.services.database import DatabaseService
        sb = DatabaseService.get_client()
        response = sb.table("system_settings").select("description, updated_by, updated_at").eq("key", key).single().execute()
        
        metadata = response.data if response.data else {}
        
        return SettingResponse(
            key=key,
            value=value,
            description=metadata.get("description"),
            updated_by=metadata.get("updated_by"),
            updated_at=metadata.get("updated_at")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve setting {key}: {str(e)}")


@router.put("/{key}")
async def update_system_setting(key: str, setting: SettingUpdate):
    """
    Update a system setting
    
    Args:
        key: The configuration key
        setting: The new setting value and metadata
    
    Returns:
        Success message
    """
    try:
        await set_config(
            key=key,
            value=setting.value,
            description=setting.description or f"Updated via admin API",
            updated_by=setting.updated_by or "admin"
        )
        await invalidate_config_cache(key=key, reload=True)
        
        return {"message": f"Setting {key} updated successfully", "key": key, "value": setting.value}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update setting {key}: {str(e)}")


@router.post("/bulk")
async def update_bulk_settings(settings: Dict[str, Any]):
    """
    Update multiple system settings at once
    
    Args:
        settings: Dictionary of key-value pairs to update
    
    Returns:
        Success message with updated settings
    """
    try:
        updated_settings = {}
        
        for key, value in settings.items():
            await set_config(key, value, f"Bulk update via admin API")
            updated_settings[key] = value

        await invalidate_config_cache(reload=True)
        
        return {
            "message": f"Updated {len(updated_settings)} settings successfully",
            "updated_settings": updated_settings
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")


@router.post("/refresh")
async def refresh_settings_cache(key: Optional[str] = Query(None, description="Specific key to refresh")):
    """
    Refresh the configuration cache
    
    Args:
        key: Optional specific key to refresh (if not provided, refreshes all)
    
    Returns:
        Success message
    """
    try:
        if key:
            await refresh_config(key)
            return {"message": f"Configuration cache refreshed for key: {key}"}
        else:
            await refresh_config()
            return {"message": "Configuration cache refreshed for all settings"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh cache: {str(e)}")


@router.post("/clear-cache")
async def clear_settings_cache():
    """
    Clear all configuration cache
    
    Returns:
        Success message
    """
    try:
        clear_config_cache()
        return {"message": "Configuration cache cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")


@router.get("/categories/{category}", response_model=Dict[str, Any])
async def get_settings_by_category(category: str):
    """
    Get all settings for a specific category
    
    Args:
        category: The category name
    
    Returns:
        Settings for the specified category
    """
    try:
        settings = await get_config_by_category(category)
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve settings for category {category}: {str(e)}")


@router.post("/defaults/reset")
async def reset_to_defaults():
    """
    Reset all settings to their default values
    
    Returns:
        Success message
    """
    try:
        from app.services.config_service import config_service
        
        # Get all default values
        defaults = {}
        for key, config_info in config_service._config_defaults.items():
            defaults[key] = config_info["default"]
        
        # Update all settings to defaults
        for key, value in defaults.items():
            await set_config(key, value, "Reset to default values via admin API")

        await invalidate_config_cache(reload=True)
        
        return {
            "message": f"Reset {len(defaults)} settings to default values",
            "reset_settings": list(defaults.keys())
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset to defaults: {str(e)}")


@router.get("/health/status")
async def get_config_health():
    """
    Get configuration service health status
    
    Returns:
        Health status including cache information
    """
    try:
        from app.services.config_service import config_service
        
        health_status = {
            "service_status": "healthy",
            "cache_size": len(config_service._cache),
            "cached_keys": list(config_service._cache.keys()),
            "cache_expirations": {
                key: config_service._cache_ttl[key].isoformat() 
                for key in config_service._cache_ttl.keys()
            },
            "total_configurations": len(config_service._config_defaults),
            "available_categories": list(set(info["category"] for info in config_service._config_defaults.values()))
        }
        
        return health_status
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get config health: {str(e)}")


# Configuration validation endpoints
@router.post("/validate")
async def validate_settings(settings: Dict[str, Any]):
    """
    Validate settings without applying them
    
    Args:
        settings: Dictionary of key-value pairs to validate
    
    Returns:
        Validation results
    """
    try:
        from app.services.config_service import config_service
        
        validation_results = []
        
        for key, value in settings.items():
            config_info = config_service._config_defaults.get(key)
            
            if not config_info:
                validation_results.append({
                    "key": key,
                    "valid": False,
                    "error": f"Unknown configuration key: {key}"
                })
                continue
            
            try:
                # Try to convert the value
                converted_value = config_service._convert_type(key, value)
                
                validation_results.append({
                    "key": key,
                    "valid": True,
                    "original_value": value,
                    "converted_value": converted_value,
                    "expected_type": config_info["type"],
                    "category": config_info["category"]
                })
            except Exception as e:
                validation_results.append({
                    "key": key,
                    "valid": False,
                    "error": f"Type conversion failed: {str(e)}",
                    "expected_type": config_info["type"]
                })
        
        return {
            "validation_results": validation_results,
            "valid_count": sum(1 for result in validation_results if result["valid"]),
            "invalid_count": sum(1 for result in validation_results if not result["valid"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate settings: {str(e)}")
