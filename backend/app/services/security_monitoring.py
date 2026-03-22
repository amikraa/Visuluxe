"""
Security Monitoring Service
Handles suspicious activity detection and IP-based API key restrictions
"""
import logging
import asyncio
from typing import Optional, Dict, Any, List, Set
from datetime import datetime, timedelta
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


class SecurityMonitor:
    def __init__(self):
        # Rate limiting and abuse detection
        self.request_counts = defaultdict(lambda: defaultdict(int))  # user_id -> time_window -> count
        self.ip_request_counts = defaultdict(lambda: defaultdict(int))  # ip -> time_window -> count
        self.failed_auth_attempts = defaultdict(deque)  # ip -> deque of timestamps
        self.suspicious_ips: Set[str] = set()
        self.blocked_ips: Set[str] = set()
        
        # Monitoring configuration - will be loaded from config service
        self.rpm_threshold = 100  # Requests per minute (default)
        self.rpd_threshold = 1000  # Requests per day (default)
        self.failed_auth_threshold = 10  # Failed auth attempts (default)
        self.failed_auth_window = 300  # 5 minutes (default)
        self.mass_generation_threshold = 50  # Images per minute (default)
        self.mass_generation_window = 60  # 1 minute (default)
        
        # Cleanup intervals
        self.cleanup_interval = 3600  # 1 hour
        self.running = False
        self._initialized = False
    
    async def initialize(self):
        """Initialize the security monitor with runtime configuration"""
        if self._initialized:
            return
            
        from app.services.config_service import get_config
        
        # Load configuration from config service
        self.rpm_threshold = await get_config("rate_limit_rpm", 100)
        self.rpd_threshold = await get_config("rate_limit_rpd", 1000)
        self.failed_auth_threshold = await get_config("failed_auth_threshold", 10)
        self.failed_auth_window = await get_config("failed_auth_window", 300)
        self.mass_generation_threshold = await get_config("mass_generation_threshold", 50)
        self.mass_generation_window = await get_config("mass_generation_window", 60)
        
        self._initialized = True
        logger.info(f"Security monitor initialized with RPM: {self.rpm_threshold}, RPD: {self.rpd_threshold}")
    
    async def start_monitoring(self):
        """Start the security monitoring service"""
        if self.running:
            return
        
        self.running = True
        logger.info("Starting security monitoring service")
        asyncio.create_task(self._monitoring_loop())
        asyncio.create_task(self._cleanup_loop())
    
    async def stop_monitoring(self):
        """Stop the security monitoring service"""
        self.running = False
        logger.info("Stopping security monitoring service")
    
    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                await asyncio.sleep(60)  # Check every minute
                await self._check_suspicious_activity()
            except Exception as e:
                logger.error(f"Error in security monitoring loop: {e}")
                await asyncio.sleep(60)
    
    async def _cleanup_loop(self):
        """Cleanup old data"""
        while self.running:
            try:
                await asyncio.sleep(self.cleanup_interval)
                await self._cleanup_old_data()
            except Exception as e:
                logger.error(f"Error in security cleanup loop: {e}")
                await asyncio.sleep(300)
    
    async def _check_suspicious_activity(self):
        """Check for various types of suspicious activity"""
        current_time = datetime.utcnow()
        current_minute = current_time.replace(second=0, microsecond=0)
        current_hour = current_time.replace(minute=0, second=0, microsecond=0)
        current_day = current_time.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Check for mass generation attempts
        await self._check_mass_generation(current_minute)
        
        # Check for mass API requests
        await self._check_mass_requests(current_minute)
        
        # Check for unauthorized API access
        await self._check_unauthorized_access(current_minute)
        
        # Check for bot attacks
        await self._check_bot_attacks(current_minute)
    
    async def _check_mass_generation(self, current_time_window: datetime):
        """Check for mass image generation attempts"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Get recent generation jobs
            cutoff_time = current_time_window - timedelta(minutes=1)
            recent_jobs_response = sb.table("generation_jobs").select("*").gte("created_at", cutoff_time.isoformat()).execute()
            recent_jobs = recent_jobs_response.data or []
            
            # Group by user
            user_jobs = defaultdict(list)
            for job in recent_jobs:
                user_jobs[job["user_id"]].append(job)
            
            # Check for mass generation
            for user_id, jobs in user_jobs.items():
                if len(jobs) > self.mass_generation_threshold:
                    await self._log_security_event(
                        "mass_generation",
                        {
                            "user_id": user_id,
                            "job_count": len(jobs),
                            "time_window": "1 minute",
                            "threshold": self.mass_generation_threshold
                        }
                    )
                    
                    # Block the user's IP if we can identify it
                    # This would need to be enhanced with actual IP tracking
                    logger.warning(f"Mass generation detected for user {user_id}: {len(jobs)} jobs in 1 minute")
                    
        except Exception as e:
            logger.error(f"Error checking mass generation: {e}")
    
    async def _check_mass_requests(self, current_time_window: datetime):
        """Check for mass API requests"""
        try:
            # Check per-user request counts
            for user_id, time_windows in self.request_counts.items():
                recent_requests = sum(count for window, count in time_windows.items() 
                                    if window >= current_time_window - timedelta(minutes=1))
                
                if recent_requests > self.rpm_threshold:
                    await self._log_security_event(
                        "mass_request_spike",
                        {
                            "user_id": user_id,
                            "request_count": recent_requests,
                            "time_window": "1 minute",
                            "threshold": self.rpm_threshold
                        }
                    )
                    logger.warning(f"Mass request spike detected for user {user_id}: {recent_requests} requests/minute")
            
            # Check per-IP request counts
            for ip, time_windows in self.ip_request_counts.items():
                recent_requests = sum(count for window, count in time_windows.items() 
                                    if window >= current_time_window - timedelta(minutes=1))
                
                if recent_requests > self.rpm_threshold and ip not in self.blocked_ips:
                    self.suspicious_ips.add(ip)
                    await self._log_security_event(
                        "mass_request_spike",
                        {
                            "ip_address": ip,
                            "request_count": recent_requests,
                            "time_window": "1 minute",
                            "threshold": self.rpm_threshold
                        }
                    )
                    logger.warning(f"Mass request spike detected from IP {ip}: {recent_requests} requests/minute")
                    
        except Exception as e:
            logger.error(f"Error checking mass requests: {e}")
    
    async def _check_unauthorized_access(self, current_time_window: datetime):
        """Check for unauthorized API access attempts"""
        try:
            # Check failed authentication attempts
            for ip, failed_attempts in self.failed_auth_attempts.items():
                # Remove old attempts
                cutoff_time = current_time_window - timedelta(minutes=self.failed_auth_window)
                while failed_attempts and failed_attempts[0] < cutoff_time:
                    failed_attempts.popleft()
                
                if len(failed_attempts) > self.failed_auth_threshold:
                    self.blocked_ips.add(ip)
                    await self._log_security_event(
                        "unauthorized_api",
                        {
                            "ip_address": ip,
                            "failed_attempts": len(failed_attempts),
                            "time_window": f"{self.failed_auth_window} seconds",
                            "threshold": self.failed_auth_threshold
                        }
                    )
                    logger.error(f"Unauthorized API access detected from IP {ip}: {len(failed_attempts)} failed attempts")
                    
        except Exception as e:
            logger.error(f"Error checking unauthorized access: {e}")
    
    async def _check_bot_attacks(self, current_time_window: datetime):
        """Check for potential bot attacks"""
        try:
            # This is a simplified bot detection
            # In a real implementation, you'd check for patterns like:
            # - Rapid requests with similar patterns
            # - Requests without proper headers
            # - Requests from known bot IP ranges
            
            for ip in self.suspicious_ips:
                if ip not in self.blocked_ips:
                    # Check if this IP is still showing suspicious behavior
                    recent_requests = sum(count for window, count in self.ip_request_counts[ip].items() 
                                        if window >= current_time_window - timedelta(minutes=5))
                    
                    if recent_requests > self.rpm_threshold * 2:  # Much higher threshold for bot detection
                        self.blocked_ips.add(ip)
                        await self._log_security_event(
                            "bot_attack",
                            {
                                "ip_address": ip,
                                "request_count": recent_requests,
                                "time_window": "5 minutes",
                                "severity": "high"
                            }
                        )
                        logger.error(f"Bot attack detected from IP {ip}: {recent_requests} requests/5 minutes")
                        
        except Exception as e:
            logger.error(f"Error checking bot attacks: {e}")
    
    async def _cleanup_old_data(self):
        """Clean up old monitoring data"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            cutoff_minute = cutoff_time.replace(second=0, microsecond=0)
            cutoff_hour = cutoff_time.replace(minute=0, second=0, microsecond=0)
            cutoff_day = cutoff_time.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Clean up request counts
            for user_id in list(self.request_counts.keys()):
                for time_window in list(self.request_counts[user_id].keys()):
                    if time_window < cutoff_minute:
                        del self.request_counts[user_id][time_window]
                if not self.request_counts[user_id]:
                    del self.request_counts[user_id]
            
            for ip in list(self.ip_request_counts.keys()):
                for time_window in list(self.ip_request_counts[ip].keys()):
                    if time_window < cutoff_minute:
                        del self.ip_request_counts[ip][time_window]
                if not self.ip_request_counts[ip]:
                    del self.ip_request_counts[ip]
            
            # Clean up failed auth attempts
            for ip in list(self.failed_auth_attempts.keys()):
                failed_attempts = self.failed_auth_attempts[ip]
                while failed_attempts and failed_attempts[0] < cutoff_time:
                    failed_attempts.popleft()
                if not failed_attempts:
                    del self.failed_auth_attempts[ip]
            
            logger.info("Cleaned up old security monitoring data")
            
        except Exception as e:
            logger.error(f"Error cleaning up old data: {e}")
    
    async def _log_security_event(self, event_type: str, details: Dict[str, Any]):
        """Log security event to database and send Telegram notification"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Log to database
            security_event = {
                "event_type": event_type,
                "severity": self._get_severity(event_type),
                "details": details,
                "triggered_at": datetime.utcnow().isoformat()
            }
            
            sb.table("abuse_detection").insert(security_event).execute()
            logger.info(f"Logged security event: {event_type} - {details}")
            
            # Send Telegram notification for high-severity events
            if self._get_severity(event_type) in ["high", "critical"]:
                from app.services.telegram_logger import log_security_event
                await log_security_event(event_type, details)
                
        except Exception as e:
            logger.error(f"Error logging security event: {e}")
    
    def _get_severity(self, event_type: str) -> str:
        """Get severity level for an event type"""
        severity_map = {
            "mass_generation": "medium",
            "mass_request_spike": "medium",
            "unauthorized_api": "high",
            "bot_attack": "critical",
            "domain_abuse": "high"
        }
        return severity_map.get(event_type, "medium")
    
    # Public methods for API key IP restriction
    async def check_api_key_access(self, api_key_id: str, ip_address: str) -> bool:
        """Check if an API key can be accessed from the given IP address"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Get API key details
            api_key_response = sb.table("api_keys").select("*").eq("id", api_key_id).execute()
            if not api_key_response.data:
                logger.warning(f"API key {api_key_id} not found")
                return False
            
            api_key = api_key_response.data[0]
            allowed_ips = api_key.get("allowed_ips", [])
            
            # If allowed_ips is empty or contains "0.0.0.0", allow any IP
            if not allowed_ips or "0.0.0.0" in allowed_ips:
                return True
            
            # Check if the IP is in the allowed list
            if ip_address in allowed_ips:
                return True
            
            # Log unauthorized access attempt
            self.failed_auth_attempts[ip_address].append(datetime.utcnow())
            await self._log_security_event(
                "unauthorized_api",
                {
                    "api_key_id": api_key_id,
                    "ip_address": ip_address,
                    "allowed_ips": allowed_ips,
                    "event": "ip_restriction_violation"
                }
            )
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking API key access: {e}")
            return False
    
    async def update_api_key_allowed_ips(self, api_key_id: str, allowed_ips: List[str]) -> bool:
        """Update allowed IPs for an API key"""
        try:
            from app.services.database import DatabaseService
            sb = DatabaseService.get_client()
            
            # Validate IP addresses
            if not self._validate_ip_list(allowed_ips):
                logger.warning(f"Invalid IP list for API key {api_key_id}: {allowed_ips}")
                return False
            
            # Update API key
            sb.table("api_keys").update({"allowed_ips": allowed_ips}).eq("id", api_key_id).execute()
            logger.info(f"Updated allowed IPs for API key {api_key_id}: {allowed_ips}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating API key allowed IPs: {e}")
            return False
    
    def _validate_ip_list(self, ip_list: List[str]) -> bool:
        """Validate a list of IP addresses"""
        if not ip_list:
            return True  # Empty list is valid (no restrictions)
        
        for ip in ip_list:
            if ip == "0.0.0.0":  # Allow any IP
                continue
            # Basic IPv4 validation (could be enhanced with IPv6 support)
            parts = ip.split(".")
            if len(parts) != 4:
                return False
            try:
                for part in parts:
                    num = int(part)
                    if num < 0 or num > 255:
                        return False
            except ValueError:
                return False
        
        return True
    
    # Public methods for rate limiting
    async def check_rate_limit(self, user_id: str, ip_address: str) -> Dict[str, Any]:
        """Check if user/IP is within rate limits"""
        current_time = datetime.utcnow()
        current_minute = current_time.replace(second=0, microsecond=0)
        current_hour = current_time.replace(minute=0, second=0, microsecond=0)
        current_day = current_time.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Increment counters
        self.request_counts[user_id][current_minute] += 1
        self.ip_request_counts[ip_address][current_minute] += 1
        
        # Check limits
        minute_limit = self.request_counts[user_id][current_minute]
        day_limit = sum(self.request_counts[user_id][t] for t in self.request_counts[user_id] 
                       if t >= current_day)
        
        return {
            "user_id": user_id,
            "ip_address": ip_address,
            "within_limits": minute_limit <= self.rpm_threshold and day_limit <= self.rpd_threshold,
            "current_minute": minute_limit,
            "current_day": day_limit,
            "limits": {
                "rpm": self.rpm_threshold,
                "rpd": self.rpd_threshold
            }
        }
    
    # Public methods for getting security status
    async def get_security_status(self) -> Dict[str, Any]:
        """Get current security status"""
        return {
            "suspicious_ips": list(self.suspicious_ips),
            "blocked_ips": list(self.blocked_ips),
            "active_monitoring": self.running,
            "total_suspicious_ips": len(self.suspicious_ips),
            "total_blocked_ips": len(self.blocked_ips)
        }
    
    async def unblock_ip(self, ip_address: str, unblocked_by: str = "admin") -> bool:
        """Unblock an IP address"""
        try:
            if ip_address in self.blocked_ips:
                self.blocked_ips.remove(ip_address)
                if ip_address in self.suspicious_ips:
                    self.suspicious_ips.remove(ip_address)
                
                # Log the unblock event
                await self._log_security_event(
                    "ip_unblock",
                    {
                        "ip_address": ip_address,
                        "unblocked_by": unblocked_by,
                        "event": "manual_unblock"
                    }
                )
                
                logger.info(f"Unblocked IP address {ip_address} by {unblocked_by}")
                return True
            
            logger.warning(f"IP address {ip_address} was not blocked")
            return False
            
        except Exception as e:
            logger.error(f"Error unblocking IP {ip_address}: {e}")
            return False


# Global instance
security_monitor = SecurityMonitor()


async def initialize_security_monitoring():
    """Initialize the security monitoring service"""
    await security_monitor.start_monitoring()
    logger.info("Security monitoring service initialized and started")


# Convenience functions for easy use throughout the application
async def check_api_key_access(api_key_id: str, ip_address: str) -> bool:
    """Check if an API key can be accessed from the given IP address"""
    await security_monitor.initialize()
    return await security_monitor.check_api_key_access(api_key_id, ip_address)


async def update_api_key_allowed_ips(api_key_id: str, allowed_ips: List[str]) -> bool:
    """Update allowed IPs for an API key"""
    await security_monitor.initialize()
    return await security_monitor.update_api_key_allowed_ips(api_key_id, allowed_ips)


async def check_rate_limit(user_id: str, ip_address: str) -> Dict[str, Any]:
    """Check if user/IP is within rate limits"""
    await security_monitor.initialize()
    return await security_monitor.check_rate_limit(user_id, ip_address)


async def get_security_status() -> Dict[str, Any]:
    """Get current security status"""
    await security_monitor.initialize()
    return await security_monitor.get_security_status()


async def unblock_ip(ip_address: str, unblocked_by: str = "admin") -> bool:
    """Unblock an IP address"""
    await security_monitor.initialize()
    return await security_monitor.unblock_ip(ip_address, unblocked_by)
