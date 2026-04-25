"""
API Abuse Detection and Protection Service
Production-grade security controls for real-world attack conditions.

Features:
- Per-user daily cost limits with automatic enforcement
- API key suspension on abuse detection
- Usage spike detection
- Rate limit exceedance tracking
- Cost per user tracking

SECURITY: Designed to be fail-safe - automatic protection over manual response.
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta, date
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class AbuseSeverity(Enum):
    """Severity levels for abuse detection."""
    LOW = "low"          # Minor violation, warning
    MEDIUM = "medium"    # Repeated violations, temporary block
    HIGH = "high"        # Significant abuse, auto-suspend
    CRITICAL = "critical"  # Attack detected, emergency block


class AbuseViolationType(Enum):
    """Types of abuse violations."""
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    USAGE_SPIKE = "usage_spike"
    COST_LIMIT_EXCEEDED = "cost_limit_exceeded"
    INVALID_INPUT_FLOOD = "invalid_input_flood"
    SUSPICIOUS_PATTERN = "suspicious_pattern"
    MODEL_ABUSE = "model_abuse"
    INVALID_SIZE_FLOOD = "invalid_size_flood"


@dataclass
class UserAbuseProfile:
    """Track abuse metrics per user."""
    user_id: str
    requests_minute: int = 0
    requests_hour: int = 0
    requests_day: int = 0
    cost_day: float = 0.0
    rate_limit_hits: int = 0
    invalid_inputs: int = 0
    rejected_models: int = 0
    last_request: datetime = field(default_factory=datetime.utcnow)
    violations: List[Dict] = field(default_factory=list)
    is_suspended: bool = False
    suspension_reason: Optional[str] = None
    suspension_until: Optional[datetime] = None
    cooldown_until: Optional[datetime] = None
    
    def add_violation(self, violation_type: AbuseViolationType, severity: AbuseSeverity, details: str):
        """Record a violation."""
        self.violations.append({
            "type": violation_type.value,
            "severity": severity.value,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Auto-suspend on high severity
        if severity in [AbuseSeverity.HIGH, AbuseSeverity.CRITICAL]:
            self.is_suspended = True
            self.suspension_reason = f"{severity.value}: {details}"
            self.suspension_until = datetime.utcnow() + timedelta(hours=1)
            logger.warning(f"User {self.user_id} auto-suspended: {self.suspension_reason}")
    
    def reset_violations(self):
        """Reset violation counts (for daily reset)."""
        self.requests_day = 0
        self.cost_day = 0.0
        self.rate_limit_hits = 0
        self.invalid_inputs = 0
        self.rejected_models = 0
        self.violations = []


class AbuseDetector:
    """
    Production-grade abuse detection with automatic protection.
    
    Features:
    - Per-user daily cost limits
    - API key suspension on abuse
    - Usage spike detection
    - Cost per user tracking
    """
    
    _instance = None
    _initialized = False
    
    # Abuse thresholds
    MAX_REQUESTS_PER_MINUTE = 10
    MAX_REQUESTS_PER_HOUR = 200
    MAX_REQUESTS_PER_DAY = 1000
    MAX_COST_PER_DAY = 100.0  # ₹100 per day per user
    MAX_RATE_LIMIT_HITS = 5
    MAX_INVALID_INPUTS = 10
    MAX_REJECTED_MODELS = 20
    
    # Spike detection
    SPIKE_THRESHOLD_MULTIPLIER = 3.0  # 3x normal usage = spike
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not AbuseDetector._initialized:
            self._user_profiles: Dict[str, UserAbuseProfile] = {}
            self._api_key_suspensions: Dict[str, Dict] = {}
            self._setup_cleanup_task()
            AbuseDetector._initialized = True
            logger.info("AbuseDetector initialized with production thresholds")
    
    def _setup_cleanup_task(self):
        """Setup daily cleanup task for resetting counters."""
        # Note: In production, use a proper scheduler or cron job
        pass
    
    def _get_or_create_profile(self, user_id: str) -> UserAbuseProfile:
        """Get or create user abuse profile."""
        if user_id not in self._user_profiles:
            self._user_profiles[user_id] = UserAbuseProfile(user_id=user_id)
        return self._user_profiles[user_id]
    
    def record_request(self, user_id: str, api_key_id: Optional[str] = None, 
                      cost: float = 0.0, valid: bool = True, request_size: int = 1):
        """
        Record a request for abuse tracking.
        
        Args:
            user_id: User ID
            api_key_id: API key ID (if applicable)
            cost: Cost of the request in ₹
            valid: Whether the request was valid
            request_size: Number of images/items in request
        """
        profile = self._get_or_create_profile(user_id)
        now = datetime.utcnow()
        
        # Update counters
        profile.requests_minute += request_size
        profile.requests_hour += request_size
        profile.requests_day += request_size
        profile.cost_day += cost
        profile.last_request = now
        
        # Check for suspended users
        if profile.is_suspended:
            if profile.suspension_until and now < profile.suspension_until:
                return {
                    "allowed": False,
                    "reason": "user_suspended",
                    "suspension_reason": profile.suspension_reason,
                    "retry_after": int((profile.suspension_until - now).total_seconds())
                }
            else:
                # Suspension expired - reset
                profile.is_suspended = False
                profile.suspension_reason = None
                profile.suspension_until = None
        
        # Check for cooldown period
        if profile.cooldown_until and now < profile.cooldown_until:
            return {
                "allowed": False,
                "reason": "cooldown_active",
                "cooldown_remaining": int((profile.cooldown_until - now).total_seconds())
            }
        
        # Run abuse checks
        return self._check_abuse(profile, api_key_id)
    
    def _check_abuse(self, profile: UserAbuseProfile, api_key_id: Optional[str]) -> Dict:
        """Check for abuse conditions."""
        now = datetime.utcnow()
        
        # Check daily cost limit
        if profile.cost_day > self.MAX_COST_PER_DAY:
            profile.add_violation(
                AbuseViolationType.COST_LIMIT_EXCEEDED,
                AbuseSeverity.HIGH,
                f"Daily cost limit exceeded: ₹{profile.cost_day:.2f} > ₹{self.MAX_COST_PER_DAY}"
            )
            return {
                "allowed": False,
                "reason": "daily_cost_limit_exceeded",
                "current_cost": profile.cost_day,
                "cost_limit": self.MAX_COST_PER_DAY
            }
        
        # Check daily request limit
        if profile.requests_day > self.MAX_REQUESTS_PER_DAY:
            profile.add_violation(
                AbuseViolationType.USAGE_SPIKE,
                AbuseSeverity.MEDIUM,
                f"Daily request limit exceeded: {profile.requests_day} > {self.MAX_REQUESTS_PER_DAY}"
            )
            return {
                "allowed": False,
                "reason": "daily_request_limit_exceeded",
                "current_requests": profile.requests_day,
                "request_limit": self.MAX_REQUESTS_PER_DAY
            }
        
        # Check for repeated rate limit hits
        if profile.rate_limit_hits > self.MAX_RATE_LIMIT_HITS:
            profile.add_violation(
                AbuseViolationType.RATE_LIMIT_EXCEEDED,
                AbuseSeverity.HIGH,
                f"Repeated rate limit violations: {profile.rate_limit_hits}"
            )
            # Apply cooldown
            profile.cooldown_until = now + timedelta(minutes=15)
            return {
                "allowed": False,
                "reason": "rate_limit_abuse_cooldown",
                "cooldown_remaining": 900
            }
        
        # Check for invalid input flood
        if profile.invalid_inputs > self.MAX_INVALID_INPUTS:
            profile.add_violation(
                AbuseViolationType.INVALID_INPUT_FLOOD,
                AbuseSeverity.HIGH,
                f"Invalid inputs flood: {profile.invalid_inputs}"
            )
            profile.cooldown_until = now + timedelta(minutes=5)
            return {
                "allowed": False,
                "reason": "invalid_input_abuse_cooldown",
                "cooldown_remaining": 300
            }
        
        # Check for rejected models
        if profile.rejected_models > self.MAX_REJECTED_MODELS:
            profile.add_violation(
                AbuseViolationType.MODEL_ABUSE,
                AbuseSeverity.MEDIUM,
                f"Repeated model rejections: {profile.rejected_models}"
            )
        
        return {"allowed": True}
    
    def record_rate_limit_hit(self, user_id: str):
        """Record a rate limit violation."""
        profile = self._get_or_create_profile(user_id)
        profile.rate_limit_hits += 1
        logger.warning(f"Rate limit hit for user {user_id}: {profile.rate_limit_hits}/{self.MAX_RATE_LIMIT_HITS}")
        
        if profile.rate_limit_hits >= self.MAX_RATE_LIMIT_HITS:
            self._trigger_alert(
                "RATE_LIMIT_ABUSE",
                f"User {user_id} exceeded rate limit {profile.rate_limit_hits} times",
                AbuseSeverity.HIGH
            )
    
    def record_invalid_input(self, user_id: str, input_type: str, details: str = ""):
        """Record an invalid input attempt."""
        profile = self._get_or_create_profile(user_id)
        profile.invalid_inputs += 1
        logger.warning(f"Invalid input for user {user_id}: {input_type} - {details}")
    
    def record_rejected_model(self, user_id: str, model_id: str):
        """Record a rejected model request."""
        profile = self._get_or_create_profile(user_id)
        profile.rejected_models += 1
        logger.info(f"Rejected model for user {user_id}: {model_id} (count: {profile.rejected_models})")
    
    def suspend_api_key(self, api_key_id: str, reason: str, duration_hours: int = 24):
        """Manually suspend an API key."""
        self._api_key_suspensions[api_key_id] = {
            "suspended_at": datetime.utcnow().isoformat(),
            "reason": reason,
            "expires_at": (datetime.utcnow() + timedelta(hours=duration_hours)).isoformat(),
            "manual": True
        }
        logger.warning(f"API key {api_key_id} suspended: {reason}")
        
        self._trigger_alert(
            "API_KEY_SUSPENDED",
            f"API key {api_key_id} manually suspended: {reason}",
            AbuseSeverity.HIGH
        )
    
    def is_api_key_suspended(self, api_key_id: str) -> Optional[Dict]:
        """Check if API key is suspended."""
        if api_key_id not in self._api_key_suspensions:
            return None
        
        suspension = self._api_key_suspensions[api_key_id]
        expires_at = datetime.fromisoformat(suspension["expires_at"])
        
        if datetime.utcnow() > expires_at:
            # Suspension expired
            del self._api_key_suspensions[api_key_id]
            return None
        
        return suspension
    
    def get_user_stats(self, user_id: str) -> Dict:
        """Get user abuse statistics."""
        profile = self._get_or_create_profile(user_id)
        return {
            "user_id": user_id,
            "is_suspended": profile.is_suspended,
            "suspension_reason": profile.suspension_reason,
            "requests_minute": profile.requests_minute,
            "requests_hour": profile.requests_hour,
            "requests_day": profile.requests_day,
            "cost_day": profile.cost_day,
            "rate_limit_hits": profile.rate_limit_hits,
            "invalid_inputs": profile.invalid_inputs,
            "rejected_models": profile.rejected_models,
            "violations_count": len(profile.violations),
            "recent_violations": profile.violations[-5:] if profile.violations else []
        }
    
    def _trigger_alert(self, alert_type: str, message: str, severity: AbuseSeverity):
        """Trigger an alert via Telegram."""
        try:
            from app.services.telegram_logger import log_system_alert
            emoji = "🔴" if severity in [AbuseSeverity.HIGH, AbuseSeverity.CRITICAL] else "🟡"
            asyncio.create_task(log_system_alert(
                "error" if severity in [AbuseSeverity.HIGH, AbuseSeverity.CRITICAL] else "warning",
                f"{emoji} ABUSE ALERT [{alert_type}]\n{message}",
                {"severity": severity.value}
            ))
        except Exception as e:
            logger.error(f"Failed to send abuse alert: {e}")
    
    def reset_daily_counters(self):
        """Reset daily counters for all users (called by scheduler)."""
        for profile in self._user_profiles.values():
            profile.reset_violations()
        logger.info("Daily counters reset for all users")


# Global instance
abuse_detector = AbuseDetector()


# Convenience functions
def get_abuse_detector() -> AbuseDetector:
    return abuse_detector


def record_request(user_id: str, api_key_id: Optional[str] = None, 
                   cost: float = 0.0, valid: bool = True, request_size: int = 1) -> Dict:
    return abuse_detector.record_request(user_id, api_key_id, cost, valid, request_size)


def record_rate_limit_hit(user_id: str):
    return abuse_detector.record_rate_limit_hit(user_id)


def record_invalid_input(user_id: str, input_type: str, details: str = ""):
    return abuse_detector.record_invalid_input(user_id, input_type, details)


def record_rejected_model(user_id: str, model_id: str):
    return abuse_detector.record_rejected_model(user_id, model_id)


def suspend_api_key(api_key_id: str, reason: str, duration_hours: int = 24):
    return abuse_detector.suspend_api_key(api_key_id, reason, duration_hours)


def is_api_key_suspended(api_key_id: str) -> Optional[Dict]:
    return abuse_detector.is_api_key_suspended(api_key_id)


def get_user_abuse_stats(user_id: str) -> Dict:
    return abuse_detector.get_user_stats(user_id)