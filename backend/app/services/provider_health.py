"""
Provider Health Monitoring Service
Handles automatic provider health checks and status management
"""
import logging
import asyncio
import aiohttp
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from app.services.config_service import get_config

logger = logging.getLogger(__name__)


class ProviderHealthMonitor:
    def __init__(self):
        self.health_check_tasks = {}
        self.running = False
        
        # Provider-specific health check endpoints
        self.provider_endpoints = {
            "flux": {
                "url": "https://api.flux.ai/health",
                "method": "GET",
                "timeout": 30
            },
            "openai": {
                "url": "https://api.openai.com/v1/models",
                "method": "GET",
                "timeout": 30
            },
            "stability": {
                "url": "https://api.stability.ai/v1/engines/list",
                "method": "GET",
                "timeout": 30
            }
        }
    
    async def initialize(self):
        """Initialize the health monitor with provider configurations"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Get runtime configuration
            default_check_interval = await get_config("health_check_interval", 300)
            default_failure_threshold = await get_config("failure_threshold", 3)
            default_auto_disable = await get_config("auto_disable_on_failure", True)
            
            # Get provider configurations
            response = sb.table("provider_configurations").select("*").execute()
            providers = response.data or []
            
            for provider in providers:
                provider_id = provider["provider_id"]
                self.health_check_tasks[provider_id] = {
                    "enabled": True,
                    "interval": provider.get("health_check_interval", default_check_interval),
                    "failure_threshold": provider.get("failure_threshold", default_failure_threshold),
                    "auto_disable": provider.get("auto_disable_on_failure", default_auto_disable),
                    "last_check": None,
                    "consecutive_failures": 0,
                    "status": "unknown"
                }
            
            logger.info(f"Initialized health monitoring for {len(providers)} providers")
        except Exception as e:
            logger.error(f"Failed to initialize health monitor: {e}")
    
    async def start_monitoring(self):
        """Start the health monitoring loop"""
        if self.running:
            return
        
        self.running = True
        logger.info("Starting provider health monitoring")
        
        # Start monitoring tasks for each provider
        for provider_id in self.health_check_tasks:
            asyncio.create_task(self._monitor_provider(provider_id))
    
    async def stop_monitoring(self):
        """Stop the health monitoring loop"""
        self.running = False
        logger.info("Stopping provider health monitoring")
    
    async def _monitor_provider(self, provider_id: str):
        """Monitor a specific provider's health"""
        config = self.health_check_tasks.get(provider_id)
        if not config:
            return
        
        while self.running:
            try:
                await asyncio.sleep(config["interval"])
                await self._check_provider_health(provider_id)
            except Exception as e:
                logger.error(f"Error monitoring provider {provider_id}: {e}")
                await asyncio.sleep(60)  # Wait 1 minute before retrying
    
    async def _check_provider_health(self, provider_id: str):
        """Check the health of a specific provider"""
        config = self.health_check_tasks.get(provider_id)
        if not config or not config["enabled"]:
            return
        
        endpoint = self.provider_endpoints.get(provider_id)
        if not endpoint:
            logger.warning(f"No health check endpoint configured for provider {provider_id}")
            return
        
        try:
            start_time = datetime.utcnow()
            async with aiohttp.ClientSession() as session:
                if endpoint["method"] == "GET":
                    async with session.get(
                        endpoint["url"],
                        timeout=aiohttp.ClientTimeout(total=endpoint["timeout"])
                    ) as response:
                        response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                        
                        if response.status == 200:
                            await self._handle_health_check_success(provider_id, response_time)
                        else:
                            await self._handle_health_check_failure(provider_id, f"HTTP {response.status}")
                else:
                    logger.warning(f"Unsupported HTTP method {endpoint['method']} for provider {provider_id}")
                    await self._handle_health_check_failure(provider_id, "Unsupported HTTP method")
                    
        except asyncio.TimeoutError:
            await self._handle_health_check_failure(provider_id, "Request timeout")
        except Exception as e:
            await self._handle_health_check_failure(provider_id, str(e))
    
    async def _handle_health_check_success(self, provider_id: str, response_time: float):
        """Handle successful health check"""
        config = self.health_check_tasks[provider_id]
        config["consecutive_failures"] = 0
        config["last_check"] = datetime.utcnow()
        config["status"] = "healthy"
        config["response_time"] = response_time
        
        # Update database
        await self._update_provider_health_status(provider_id, "healthy", response_time, None)
        
        logger.info(f"Provider {provider_id} health check passed (response time: {response_time:.2f}ms)")
    
    async def _handle_health_check_failure(self, provider_id: str, error_message: str):
        """Handle failed health check"""
        config = self.health_check_tasks[provider_id]
        config["consecutive_failures"] += 1
        config["last_check"] = datetime.utcnow()
        config["status"] = "unhealthy"
        config["error_message"] = error_message
        
        # Update database
        await self._update_provider_health_status(provider_id, "unhealthy", None, error_message)
        
        logger.warning(f"Provider {provider_id} health check failed ({config['consecutive_failures']}/{config['failure_threshold']}) - {error_message}")
        
        # Auto-disable provider if threshold reached
        if config["consecutive_failures"] >= config["failure_threshold"] and config["auto_disable"]:
            await self._disable_provider(provider_id, error_message)
    
    async def _update_provider_health_status(self, provider_id: str, status: str, response_time: Optional[float], error_message: Optional[str]):
        """Update provider health status in database"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Update or insert health check record
            health_data = {
                "provider_id": provider_id,
                "provider_name": provider_id.title(),
                "status": status,
                "response_time_ms": int(response_time) if response_time else None,
                "error_message": error_message,
                "consecutive_failures": self.health_check_tasks[provider_id]["consecutive_failures"],
                "last_check_at": datetime.utcnow().isoformat(),
                "next_check_at": (datetime.utcnow() + timedelta(seconds=self.health_check_tasks[provider_id]["interval"])).isoformat()
            }
            
            # Try to update existing record first
            existing_response = sb.table("provider_health_checks").select("*").eq("provider_id", provider_id).execute()
            if existing_response.data:
                sb.table("provider_health_checks").update(health_data).eq("provider_id", provider_id).execute()
            else:
                sb.table("provider_health_checks").insert(health_data).execute()
            
            # Send Telegram notification for status changes
            from app.services.telegram_logger import log_provider_health_event
            await log_provider_health_event(
                provider_name=provider_id.title(),
                status=status,
                details={
                    "response_time_ms": response_time,
                    "error_message": error_message,
                    "consecutive_failures": self.health_check_tasks[provider_id]["consecutive_failures"],
                    "auto_disabled": status == "unhealthy" and self.health_check_tasks[provider_id]["consecutive_failures"] >= self.health_check_tasks[provider_id]["failure_threshold"]
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to update health status for provider {provider_id}: {e}")
    
    async def _disable_provider(self, provider_id: str, error_message: str):
        """Disable a provider due to health check failures"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Update provider status to disabled
            sb.table("provider_health_checks").update({
                "status": "unhealthy",
                "auto_disabled": True,
                "disabled_at": datetime.utcnow().isoformat(),
                "disabled_by": "health_monitor",
                "error_message": f"Auto-disabled due to {self.health_check_tasks[provider_id]['consecutive_failures']} consecutive failures: {error_message}"
            }).eq("provider_id", provider_id).execute()
            
            self.health_check_tasks[provider_id]["enabled"] = False
            self.health_check_tasks[provider_id]["status"] = "disabled"
            
            logger.error(f"Provider {provider_id} has been auto-disabled due to health check failures")
            
            # Send Telegram alert
            from app.services.telegram_logger import log_system_alert
            await log_system_alert(
                "error",
                f"Provider {provider_id} auto-disabled due to {self.health_check_tasks[provider_id]['consecutive_failures']} consecutive health check failures",
                {"provider_id": provider_id, "error_message": error_message}
            )
            
        except Exception as e:
            logger.error(f"Failed to disable provider {provider_id}: {e}")
    
    async def enable_provider(self, provider_id: str, enabled_by: str = "admin"):
        """Manually enable a disabled provider"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Update provider status to healthy
            sb.table("provider_health_checks").update({
                "status": "healthy",
                "auto_disabled": False,
                "disabled_at": None,
                "disabled_by": None,
                "error_message": None,
                "consecutive_failures": 0,
                "last_check_at": datetime.utcnow().isoformat()
            }).eq("provider_id", provider_id).execute()
            
            if provider_id in self.health_check_tasks:
                self.health_check_tasks[provider_id]["enabled"] = True
                self.health_check_tasks[provider_id]["status"] = "healthy"
                self.health_check_tasks[provider_id]["consecutive_failures"] = 0
            
            logger.info(f"Provider {provider_id} manually enabled by {enabled_by}")
            
            # Send Telegram notification
            from app.services.telegram_logger import log_system_alert
            await log_system_alert(
                "info",
                f"Provider {provider_id} manually enabled by {enabled_by}",
                {"provider_id": provider_id, "enabled_by": enabled_by}
            )
            
        except Exception as e:
            logger.error(f"Failed to enable provider {provider_id}: {e}")
    
    def get_provider_status(self, provider_id: str) -> Dict[str, Any]:
        """Get current status of a provider"""
        config = self.health_check_tasks.get(provider_id)
        if not config:
            return {"status": "unknown", "provider_id": provider_id}
        
        return {
            "provider_id": provider_id,
            "status": config["status"],
            "enabled": config["enabled"],
            "consecutive_failures": config["consecutive_failures"],
            "last_check": config["last_check"],
            "response_time": config.get("response_time"),
            "error_message": config.get("error_message")
        }
    
    def get_all_provider_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all providers"""
        return {provider_id: self.get_provider_status(provider_id) for provider_id in self.health_check_tasks}


# Global instance
provider_health_monitor = ProviderHealthMonitor()


async def initialize_provider_health_monitor():
    """Initialize the provider health monitor"""
    await provider_health_monitor.initialize()
    await provider_health_monitor.start_monitoring()
    logger.info("Provider health monitor initialized and started")


# Convenience functions for easy use throughout the application
async def get_provider_status(provider_id: str) -> Dict[str, Any]:
    """Get current status of a provider"""
    return provider_health_monitor.get_provider_status(provider_id)


async def get_all_provider_status() -> Dict[str, Dict[str, Any]]:
    """Get status of all providers"""
    return provider_health_monitor.get_all_provider_status()


async def enable_provider(provider_id: str, enabled_by: str = "admin"):
    """Manually enable a disabled provider"""
    return await provider_health_monitor.enable_provider(provider_id, enabled_by)


async def disable_provider(provider_id: str, disabled_by: str = "admin"):
    """Manually disable a provider"""
    # This would be implemented if manual disabling is needed
    pass