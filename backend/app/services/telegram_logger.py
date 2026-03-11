"""
Telegram Logging Service
Handles sending important events to Telegram for platform monitoring
"""
import logging
import aiohttp
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class TelegramLogger:
    def __init__(self):
        from app.config import settings
        self.bot_token = settings.telegram_bot_token
        self.admin_chat_id = settings.telegram_admin_chat_id
        self.enabled = bool(self.bot_token and self.admin_chat_id)
        
        if not self.enabled:
            logger.warning("Telegram logging is disabled - missing bot token or chat ID")
    
    async def send_message(self, message: str, chat_id: Optional[str] = None) -> bool:
        """Send a message to Telegram"""
        if not self.enabled:
            return False
        
        target_chat_id = chat_id or self.admin_chat_id
        
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            payload = {
                "chat_id": target_chat_id,
                "text": message,
                "parse_mode": "HTML",
                "disable_web_page_preview": True
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status == 200:
                        logger.info(f"Telegram message sent successfully to {target_chat_id}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Failed to send Telegram message: {response.status} - {error_text}")
                        return False
        except Exception as e:
            logger.error(f"Error sending Telegram message: {e}")
            return False
    
    async def log_image_generation(self, 
                                  username: str,
                                  user_id: str,
                                  account_type: str,
                                  job_id: str,
                                  prompt: str,
                                  model_name: str,
                                  model_id: str,
                                  provider_name: str,
                                  provider_id: str,
                                  credits_used: float,
                                  status: str,
                                  image_url: Optional[str] = None,
                                  failure_reason: Optional[str] = None) -> bool:
        """Log image generation events to Telegram"""
        if not self.enabled:
            return False
        
        # Only log important events to avoid spam
        if status not in ["completed", "failed"]:
            return True
        
        emoji = "✅" if status == "completed" else "❌"
        status_text = "SUCCESS" if status == "completed" else "FAILED"
        
        message = f"""
{emoji} <b>Image Generation {status_text}</b>

👤 <b>User:</b> {username} ({user_id})
🎯 <b>Account:</b> {account_type.upper()}
🆔 <b>Job ID:</b> <code>{job_id}</code>

📝 <b>Prompt:</b>
{prompt[:200]}{'...' if len(prompt) > 200 else ''}

🤖 <b>Model:</b> {model_name} ({model_id})
🌐 <b>Provider:</b> {provider_name} ({provider_id})
💎 <b>Credits Used:</b> {credits_used}

{f"🖼️ <b>Image URL:</b> {image_url}" if image_url else ""}
{f"❌ <b>Failure Reason:</b> {failure_reason}" if failure_reason else ""}

🕒 <b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
        """.strip()
        
        return await self.send_message(message)
    
    async def log_security_event(self, event_type: str, details: Dict[str, Any]) -> bool:
        """Log security events to Telegram"""
        if not self.enabled:
            return False
        
        emoji_map = {
            "new_account": "🆕",
            "password_change": "🔐",
            "credit_added": "💰",
            "credit_deducted": "💸",
            "credit_refunded": "🔄",
            "mass_request_spike": "🚨",
            "unauthorized_api": "🚫",
            "mass_generation": "⚡"
        }
        
        emoji = emoji_map.get(event_type, "⚠️")
        event_text = event_type.replace("_", " ").title()
        
        message = f"""
{emoji} <b>Security Event: {event_text}</b>

{self._format_details(details)}

🕒 <b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
        """.strip()
        
        return await self.send_message(message)
    
    async def log_provider_health(self, provider_name: str, status: str, details: Dict[str, Any]) -> bool:
        """Log provider health changes to Telegram"""
        if not self.enabled:
            return False
        
        emoji = "✅" if status == "healthy" else "⚠️" if status == "unhealthy" else "🔧"
        status_text = status.upper()
        
        message = f"""
{emoji} <b>Provider Health Alert</b>

🌐 <b>Provider:</b> {provider_name}
📊 <b>Status:</b> {status_text}

{self._format_details(details)}

🕒 <b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
        """.strip()
        
        return await self.send_message(message)
    
    async def log_system_alert(self, alert_type: str, message: str, details: Optional[Dict[str, Any]] = None) -> bool:
        """Log system alerts to Telegram"""
        if not self.enabled:
            return False
        
        emoji_map = {
            "error": "❌",
            "warning": "⚠️",
            "info": "ℹ️",
            "maintenance": "🔧"
        }
        
        emoji = emoji_map.get(alert_type, "📢")
        alert_text = alert_type.upper()
        
        full_message = f"""
{emoji} <b>System Alert: {alert_text}</b>

📝 <b>Message:</b>
{message}

{self._format_details(details) if details else ""}

🕒 <b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
        """.strip()
        
        return await self.send_message(full_message)
    
    async def send_image_to_user(self, user_chat_id: str, image_url: str, caption: str) -> bool:
        """Send generated image to user's Telegram"""
        if not self.enabled or not user_chat_id:
            return False
        
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendPhoto"
            payload = {
                "chat_id": user_chat_id,
                "photo": image_url,
                "caption": caption[:1024],  # Telegram caption limit
                "parse_mode": "HTML"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status == 200:
                        logger.info(f"Image sent to user {user_chat_id}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Failed to send image to user: {response.status} - {error_text}")
                        return False
        except Exception as e:
            logger.error(f"Error sending image to user: {e}")
            return False
    
    def _format_details(self, details: Optional[Dict[str, Any]]) -> str:
        """Format details dictionary for Telegram message"""
        if not details:
            return ""
        
        lines = []
        for key, value in details.items():
            if isinstance(value, dict):
                value = str(value)
            elif isinstance(value, list):
                value = ", ".join(map(str, value))
            lines.append(f"• <b>{key.replace('_', ' ').title()}:</b> {value}")
        
        return "\n".join(lines) if lines else ""


# Global instance
telegram_logger = TelegramLogger()


async def initialize_telegram_logger():
    """Initialize the Telegram logger"""
    if telegram_logger.enabled:
        logger.info("Telegram logger initialized successfully")
        # Send a test message to verify setup
        await telegram_logger.log_system_alert("info", "Telegram logging system initialized")
    else:
        logger.warning("Telegram logging disabled - check configuration")


# Convenience functions for easy use throughout the application
async def log_image_generation_event(**kwargs):
    """Convenience function to log image generation events"""
    return await telegram_logger.log_image_generation(**kwargs)


async def log_security_event(event_type: str, details: Dict[str, Any]):
    """Convenience function to log security events"""
    return await telegram_logger.log_security_event(event_type, details)


async def log_provider_health_event(provider_name: str, status: str, details: Dict[str, Any]):
    """Convenience function to log provider health events"""
    return await telegram_logger.log_provider_health(provider_name, status, details)


async def log_system_alert(alert_type: str, message: str, details: Optional[Dict[str, Any]] = None):
    """Convenience function to log system alerts"""
    return await telegram_logger.log_system_alert(alert_type, message, details)


async def send_image_to_user_telegram(user_chat_id: str, image_url: str, caption: str):
    """Convenience function to send image to user's Telegram"""
    return await telegram_logger.send_image_to_user(user_chat_id, image_url, caption)