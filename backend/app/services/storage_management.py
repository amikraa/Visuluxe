"""
Cloudflare R2 Storage Management Service
Handles user-configurable image expiration and storage lifecycle
"""
import logging
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class StorageManagementService:
    def __init__(self):
        from app.config import settings
        self.cleanup_interval = 3600  # 1 hour
        self.running = False
    
    async def initialize(self):
        """Initialize storage management service"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Ensure default storage settings for all users
            await self._ensure_default_storage_settings()
            logger.info("Storage management service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize storage management: {e}")
    
    async def _ensure_default_storage_settings(self):
        """Ensure all users have default storage settings"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Get all users without storage settings
            users_response = sb.table("profiles").select("user_id, account_type").execute()
            users = users_response.data or []
            
            for user in users:
                user_id = user["user_id"]
                plan_type = user.get("plan_type", "free")
                
                # Set default storage settings based on plan type
                storage_settings = self._get_default_storage_settings(plan_type)
                storage_settings["user_id"] = user_id
                
                sb.table("user_storage_settings").insert(storage_settings).execute()
                logger.info(f"Created default storage settings for user {user_id} (plan: {plan_type})")
                
        except Exception as e:
            logger.error(f"Failed to ensure default storage settings: {e}")
    
    def _get_default_storage_settings(self, account_type: str) -> Dict[str, Any]:
        """Get default storage settings based on account type"""
        defaults = {
            "free": {
                "auto_delete_after_days": 30,
                "storage_tier": "basic",
                "max_storage_days": 90,
                "enable_long_term_storage": False
            },
            "pro": {
                "auto_delete_after_days": 90,
                "storage_tier": "premium",
                "max_storage_days": 365,
                "enable_long_term_storage": True
            },
            "enterprise": {
                "auto_delete_after_days": 365,
                "storage_tier": "enterprise",
                "max_storage_days": 2555,  # 7 years
                "enable_long_term_storage": True
            }
        }
        return defaults.get(account_type, defaults["free"])
    
    async def start_cleanup_service(self):
        """Start the automatic cleanup service"""
        if self.running:
            return
        
        self.running = True
        logger.info("Starting storage cleanup service")
        asyncio.create_task(self._cleanup_loop())
    
    async def stop_cleanup_service(self):
        """Stop the automatic cleanup service"""
        self.running = False
        logger.info("Stopping storage cleanup service")
    
    async def _cleanup_loop(self):
        """Main cleanup loop"""
        while self.running:
            try:
                await self._perform_cleanup()
                await asyncio.sleep(self.cleanup_interval)
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(300)  # Wait 5 minutes before retrying
    
    async def _perform_cleanup(self):
        """Perform cleanup of expired images"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Get images that should be expired
            cutoff_date = datetime.utcnow() - timedelta(days=365)  # Cleanup images older than 1 year
            
            # Get images with expiration dates that have passed
            expired_images_response = sb.table("images").select("*").lt("created_at", cutoff_date.isoformat()).execute()
            expired_images = expired_images_response.data or []
            
            if not expired_images:
                logger.info("No expired images found for cleanup")
                return
            
            # Process expired images
            deleted_count = 0
            for image in expired_images:
                try:
                    # Delete from R2 storage
                    from app.services.storage import StorageService
                    if image.get("metadata", {}).get("r2_key"):
                        await StorageService.delete_image(image["metadata"]["r2_key"])
                    
                    # Delete from database
                    sb.table("images").delete().eq("id", image["id"]).execute()
                    deleted_count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to delete expired image {image['id']}: {e}")
            
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} expired images")
                
                # Send Telegram notification for large cleanup operations
                if deleted_count > 100:
                    from app.services.telegram_logger import log_system_alert
                    await log_system_alert(
                        "info",
                        f"Storage cleanup completed: {deleted_count} expired images removed",
                        {"deleted_count": deleted_count, "cleanup_date": datetime.utcnow().isoformat()}
                    )
                    
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    async def update_user_storage_settings(self, user_id: str, settings: Dict[str, Any]) -> bool:
        """Update user's storage settings"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Validate settings
            if not self._validate_storage_settings(settings):
                logger.warning(f"Invalid storage settings for user {user_id}: {settings}")
                return False
            
            # Update settings
            update_data = {
                "auto_delete_after_days": settings.get("auto_delete_after_days"),
                "storage_tier": settings.get("storage_tier"),
                "max_storage_days": settings.get("max_storage_days"),
                "enable_long_term_storage": settings.get("enable_long_term_storage"),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            sb.table("user_storage_settings").update(update_data).eq("user_id", user_id).execute()
            logger.info(f"Updated storage settings for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update storage settings for user {user_id}: {e}")
            return False
    
    def _validate_storage_settings(self, settings: Dict[str, Any]) -> bool:
        """Validate storage settings"""
        auto_delete_days = settings.get("auto_delete_after_days")
        max_storage_days = settings.get("max_storage_days")
        storage_tier = settings.get("storage_tier")
        enable_long_term = settings.get("enable_long_term_storage", False)
        
        # Validate auto_delete_after_days
        if auto_delete_days is not None and (auto_delete_days < 7 or auto_delete_days > 2555):
            return False
        
        # Validate max_storage_days
        if max_storage_days is not None and (max_storage_days < 7 or max_storage_days > 2555):
            return False
        
        # Validate storage_tier
        valid_tiers = ["basic", "premium", "enterprise"]
        if storage_tier and storage_tier not in valid_tiers:
            return False
        
        # Validate consistency between settings
        if auto_delete_days and max_storage_days and auto_delete_days > max_storage_days:
            return False
        
        return True
    
    async def get_user_storage_settings(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's storage settings"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            response = sb.table("user_storage_settings").select("*").eq("user_id", user_id).execute()
            if response.data:
                return response.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to get storage settings for user {user_id}: {e}")
            return None
    
    async def extend_image_storage(self, image_id: str, user_id: str, days: int) -> bool:
        """Extend storage duration for a specific image"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Get image and user settings
            image_response = sb.table("images").select("*").eq("id", image_id).execute()
            if not image_response.data:
                logger.warning(f"Image {image_id} not found")
                return False
            
            image = image_response.data[0]
            if image["user_id"] != user_id:
                logger.warning(f"User {user_id} does not own image {image_id}")
                return False
            
            user_settings = await self.get_user_storage_settings(user_id)
            if not user_settings:
                logger.warning(f"No storage settings found for user {user_id}")
                return False
            
            # Validate extension request
            if not user_settings.get("enable_long_term_storage"):
                logger.warning(f"User {user_id} does not have long-term storage enabled")
                return False
            
            if days < 1 or days > user_settings["max_storage_days"]:
                logger.warning(f"Invalid extension period for user {user_id}: {days} days")
                return False
            
            # Extend image storage
            current_expires_at = image.get("metadata", {}).get("expires_at")
            if current_expires_at:
                current_date = datetime.fromisoformat(current_expires_at.replace('Z', '+00:00'))
            else:
                current_date = datetime.utcnow()
            
            new_expires_at = current_date + timedelta(days=days)
            
            # Update image metadata
            metadata = image.get("metadata", {})
            metadata["expires_at"] = new_expires_at.isoformat()
            metadata["storage_extended"] = True
            metadata["extension_date"] = datetime.utcnow().isoformat()
            metadata["extension_days"] = days
            
            sb.table("images").update({"metadata": metadata}).eq("id", image_id).execute()
            logger.info(f"Extended storage for image {image_id} by {days} days")
            return True
            
        except Exception as e:
            logger.error(f"Failed to extend storage for image {image_id}: {e}")
            return False
    
    async def delete_user_image(self, image_id: str, user_id: str) -> bool:
        """Delete a specific image from user's storage"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Get image and verify ownership
            image_response = sb.table("images").select("*").eq("id", image_id).execute()
            if not image_response.data:
                logger.warning(f"Image {image_id} not found")
                return False
            
            image = image_response.data[0]
            if image["user_id"] != user_id:
                logger.warning(f"User {user_id} does not own image {image_id}")
                return False
            
            # Delete from R2 storage
            from app.services.storage import StorageService
            if image.get("metadata", {}).get("r2_key"):
                await StorageService.delete_image(image["metadata"]["r2_key"])
            
            # Delete from database
            sb.table("images").delete().eq("id", image_id).execute()
            logger.info(f"Deleted image {image_id} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete image {image_id}: {e}")
            return False
    
    async def get_user_storage_usage(self, user_id: str) -> Dict[str, Any]:
        """Get user's current storage usage and statistics"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Get user settings
            user_settings = await self.get_user_storage_settings(user_id)
            if not user_settings:
                return {"error": "No storage settings found"}
            
            # Get image count and storage statistics
            images_response = sb.table("images").select("*").eq("user_id", user_id).execute()
            images = images_response.data or []
            
            # Calculate storage statistics
            total_images = len(images)
            expired_images = len([img for img in images if img.get("metadata", {}).get("expires_at") and datetime.fromisoformat(img["metadata"]["expires_at"].replace('Z', '+00:00')) < datetime.utcnow()])
            soon_to_expire = len([img for img in images if img.get("metadata", {}).get("expires_at") and datetime.fromisoformat(img["metadata"]["expires_at"].replace('Z', '+00:00')) < datetime.utcnow() + timedelta(days=7)])
            
            return {
                "user_id": user_id,
                "storage_tier": user_settings["storage_tier"],
                "auto_delete_after_days": user_settings["auto_delete_after_days"],
                "max_storage_days": user_settings["max_storage_days"],
                "enable_long_term_storage": user_settings["enable_long_term_storage"],
                "total_images": total_images,
                "expired_images": expired_images,
                "soon_to_expire": soon_to_expire,
                "storage_usage_percent": min((total_images / (user_settings["max_storage_days"] * 10)) * 100, 100)  # Rough estimate
            }
            
        except Exception as e:
            logger.error(f"Failed to get storage usage for user {user_id}: {e}")
            return {"error": str(e)}


# Global instance
storage_management_service = StorageManagementService()


async def initialize_storage_management():
    """Initialize the storage management service"""
    await storage_management_service.initialize()
    await storage_management_service.start_cleanup_service()
    logger.info("Storage management service initialized and started")


# Convenience functions for easy use throughout the application
async def update_user_storage_settings(user_id: str, settings: Dict[str, Any]) -> bool:
    """Update user's storage settings"""
    return await storage_management_service.update_user_storage_settings(user_id, settings)


async def get_user_storage_settings(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user's storage settings"""
    return await storage_management_service.get_user_storage_settings(user_id)


async def extend_image_storage(image_id: str, user_id: str, days: int) -> bool:
    """Extend storage duration for a specific image"""
    return await storage_management_service.extend_image_storage(image_id, user_id, days)


async def delete_user_image(image_id: str, user_id: str) -> bool:
    """Delete a specific image from user's storage"""
    return await storage_management_service.delete_user_image(image_id, user_id)


async def get_user_storage_usage(user_id: str) -> Dict[str, Any]:
    """Get user's current storage usage and statistics"""
    return await storage_management_service.get_user_storage_usage(user_id)