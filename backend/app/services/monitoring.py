"""
Real-Time Monitoring and Alerting Service
Production-grade observability for security and operational metrics.

Features:
- Request volume tracking per user
- Error rate monitoring (4xx, 5xx)
- Rate limit hit tracking
- Rejected model requests
- Invalid size attempts
- Anomaly detection
- Alert aggregation and throttling

SECURITY: Designed to detect attacks in real-time and trigger automated protection.
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum
import json

logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Types of metrics to track."""
    REQUEST_COUNT = "request_count"
    ERROR_RATE = "error_rate"
    RATE_LIMIT_HITS = "rate_limit_hits"
    REJECTED_MODELS = "rejected_models"
    INVALID_SIZES = "invalid_sizes"
    ADMIN_ACTIONS = "admin_actions"
    AUTH_FAILURES = "auth_failures"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"


class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class MetricSnapshot:
    """A point-in-time metric value."""
    timestamp: datetime
    metric_type: MetricType
    value: float
    user_id: Optional[str] = None
    details: Optional[Dict] = None


@dataclass
class Alert:
    """An alert that has been triggered."""
    alert_id: str
    alert_type: str
    severity: AlertSeverity
    message: str
    timestamp: datetime
    user_id: Optional[str] = None
    metadata: Optional[Dict] = None
    acknowledged: bool = False


class AnomalyThresholds:
    """Thresholds for anomaly detection."""
    # Traffic spikes
    TRAFFIC_SPIKE_MULTIPLIER = 5.0  # 5x normal = spike
    TRAFFIC_SPIKE_WINDOW_MINUTES = 5
    
    # Error rates
    ERROR_RATE_THRESHOLD = 0.1  # 10% error rate = anomaly
    ERROR_RATE_WINDOW_MINUTES = 5
    
    # Rate limit violations
    RATE_LIMIT_VIOLATION_THRESHOLD = 10  # 10 violations in window
    RATE_LIMIT_VIOLATION_WINDOW_MINUTES = 10
    
    # Invalid inputs
    INVALID_INPUT_THRESHOLD = 20  # 20 invalid inputs
    INVALID_INPUT_WINDOW_MINUTES = 15
    
    # Admin action rate
    ADMIN_ACTION_THRESHOLD = 5  # 5 admin actions
    ADMIN_ACTION_WINDOW_MINUTES = 30


class MonitoringService:
    """
    Real-time monitoring service with automated alerting.
    
    Tracks:
    - Request volume per user
    - Error rates (4xx, 5xx)
    - Rate limit hits
    - Rejected model requests
    - Invalid size attempts
    - Admin actions
    - Anomaly detection
    
    Features:
    - Sliding window metrics
    - Anomaly detection
    - Alert aggregation/throttling
    - Automated notifications
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not MonitoringService._initialized:
            self._metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
            self._user_metrics: Dict[str, Dict[str, deque]] = defaultdict(lambda: defaultdict(lambda: deque(maxlen=500)))
            self._alerts: deque = deque(maxlen=100)
            self._alert_handlers: List[Callable] = []
            self._alert_cooldowns: Dict[str, datetime] = {}
            self._alert_cooldown_seconds = 300  # 5 min between same alerts
            self._thresholds = AnomalyThresholds()
            MonitoringService._initialized = True
            logger.info("MonitoringService initialized")
    
    def record_metric(self, metric_type: MetricType, value: float = 1.0, 
                      user_id: Optional[str] = None, details: Optional[Dict] = None):
        """Record a metric value."""
        timestamp = datetime.utcnow()
        snapshot = MetricSnapshot(
            timestamp=timestamp,
            metric_type=metric_type,
            value=value,
            user_id=user_id,
            details=details
        )
        
        # Global metrics
        self._metrics[metric_type.value].append(snapshot)
        
        # User-specific metrics
        if user_id:
            self._user_metrics[user_id][metric_type.value].append(snapshot)
    
    def record_request(self, user_id: str, endpoint: str, method: str, 
                       status_code: int, response_time_ms: float = 0):
        """Record an API request."""
        self.record_metric(
            MetricType.REQUEST_COUNT,
            value=1.0,
            user_id=user_id,
            details={
                "endpoint": endpoint,
                "method": method,
                "status_code": status_code,
                "response_time_ms": response_time_ms
            }
        )
        
        # Track errors
        if status_code >= 400:
            is_rate_limit = status_code == 429
            self.record_metric(
                MetricType.ERROR_RATE,
                value=1.0,
                user_id=user_id,
                details={
                    "status_code": status_code,
                    "endpoint": endpoint
                }
            )
            
            if is_rate_limit:
                self.record_metric(
                    MetricType.RATE_LIMIT_HITS,
                    value=1.0,
                    user_id=user_id
                )
    
    def record_rejected_model(self, user_id: str, model_id: str, reason: str):
        """Record a rejected model request."""
        self.record_metric(
            MetricType.REJECTED_MODELS,
            value=1.0,
            user_id=user_id,
            details={"model_id": model_id, "reason": reason}
        )
    
    def record_invalid_size(self, user_id: str, size: str, reason: str):
        """Record an invalid size attempt."""
        self.record_metric(
            MetricType.INVALID_SIZES,
            value=1.0,
            user_id=user_id,
            details={"size": size, "reason": reason}
        )
    
    def record_admin_action(self, admin_user_id: str, action: str, resource_id: str = "", details: Optional[Dict] = None):
        """Record an admin action."""
        self.record_metric(
            MetricType.ADMIN_ACTIONS,
            value=1.0,
            user_id=admin_user_id,
            details={
                "action": action,
                "resource_id": resource_id,
                **(details or {})
            }
        )
    
    def record_auth_failure(self, user_id: str = None, reason: str = ""):
        """Record an authentication failure."""
        self.record_metric(
            MetricType.AUTH_FAILURES,
            value=1.0,
            user_id=user_id,
            details={"reason": reason}
        )
    
    def record_suspicious_activity(self, user_id: str, activity_type: str, details: Dict):
        """Record suspicious activity."""
        self.record_metric(
            MetricType.SUSPICIOUS_ACTIVITY,
            value=1.0,
            user_id=user_id,
            details={"activity_type": activity_type, **details}
        )
    
    def get_user_metrics(self, user_id: str, metric_type: MetricType, 
                        window_minutes: int = 60) -> List[MetricSnapshot]:
        """Get user metrics for a specific metric type within a time window."""
        cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
        snapshots = self._user_metrics.get(user_id, {}).get(metric_type.value, [])
        return [s for s in snapshots if s.timestamp >= cutoff]
    
    def get_global_metrics(self, metric_type: MetricType,
                          window_minutes: int = 60) -> List[MetricSnapshot]:
        """Get global metrics for a specific metric type within a time window."""
        cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
        snapshots = self._metrics.get(metric_type.value, [])
        return [s for s in snapshots if s.timestamp >= cutoff]
    
    def get_user_request_count(self, user_id: str, window_minutes: int = 60) -> int:
        """Get request count for user in time window."""
        snapshots = self.get_user_metrics(user_id, MetricType.REQUEST_COUNT, window_minutes)
        return sum(s.value for s in snapshots)
    
    def get_user_error_count(self, user_id: str, window_minutes: int = 60) -> int:
        """Get error count for user in time window."""
        snapshots = self.get_user_metrics(user_id, MetricType.ERROR_RATE, window_minutes)
        return sum(s.value for s in snapshots)
    
    def get_user_error_rate(self, user_id: str, window_minutes: int = 60) -> float:
        """Get error rate for user in time window."""
        total_requests = self.get_user_request_count(user_id, window_minutes)
        if total_requests == 0:
            return 0.0
        error_count = self.get_user_error_count(user_id, window_minutes)
        return error_count / total_requests
    
    def get_user_rate_limit_hits(self, user_id: str, window_minutes: int = 60) -> int:
        """Get rate limit hits for user in time window."""
        snapshots = self.get_user_metrics(user_id, MetricType.RATE_LIMIT_HITS, window_minutes)
        return sum(s.value for s in snapshots)
    
    def check_anomalies(self, user_id: str = None) -> List[Alert]:
        """Check for anomalies and return alerts."""
        alerts = []
        now = datetime.utcnow()
        
        # Check traffic spikes
        if user_id:
            requests_5min = self.get_user_request_count(user_id, 5)
            requests_60min = self.get_user_request_count(user_id, 60)
            avg_per_5min = requests_60min / 12 if requests_60min > 0 else 0
            
            if avg_per_5min > 0 and requests_5min > avg_per_5min * self._thresholds.TRAFFIC_SPIKE_MULTIPLIER:
                alert = self._create_alert(
                    "TRAFFIC_SPIKE",
                    AlertSeverity.WARNING,
                    f"Traffic spike detected for user {user_id}: {requests_5min} requests in 5 min (avg: {avg_per_5min:.1f})",
                    user_id
                )
                alerts.append(alert)
            
            # Check high error rate
            error_rate = self.get_user_error_rate(user_id, 5)
            if error_rate > self._thresholds.ERROR_RATE_THRESHOLD:
                alert = self._create_alert(
                    "HIGH_ERROR_RATE",
                    AlertSeverity.ERROR,
                    f"High error rate for user {user_id}: {error_rate*100:.1f}%",
                    user_id
                )
                alerts.append(alert)
            
            # Check rate limit abuse
            rate_limit_hits = self.get_user_rate_limit_hits(user_id, 10)
            if rate_limit_hits > self._thresholds.RATE_LIMIT_VIOLATION_THRESHOLD:
                alert = self._create_alert(
                    "RATE_LIMIT_ABUSE",
                    AlertSeverity.WARNING,
                    f"Rate limit abuse by user {user_id}: {rate_limit_hits} violations",
                    user_id
                )
                alerts.append(alert)
        
        # Global anomaly checks
        global_rate_hits = sum(s.value for s in self.get_global_metrics(MetricType.RATE_LIMIT_HITS, 5))
        if global_rate_hits > 50:
            alert = self._create_alert(
                "GLOBAL_RATE_LIMIT_STORM",
                AlertSeverity.CRITICAL,
                f"Global rate limit storm: {global_rate_hits} hits in 5 minutes",
                user_id=None
            )
            alerts.append(alert)
        
        return alerts
    
    def _create_alert(self, alert_type: str, severity: AlertSeverity, 
                     message: str, user_id: Optional[str] = None) -> Alert:
        """Create an alert with cooldown checking."""
        alert_id = f"{alert_type}_{user_id or 'global'}_{int(datetime.utcnow().timestamp())}"
        
        # Check cooldown
        cooldown_key = f"{alert_type}_{user_id}"
        if cooldown_key in self._alert_cooldowns:
            last_alert = self._alert_cooldowns[cooldown_key]
            if datetime.utcnow() - last_alert < timedelta(seconds=self._alert_cooldown_seconds):
                return None  # Skip due to cooldown
        
        alert = Alert(
            alert_id=alert_id,
            alert_type=alert_type,
            severity=severity,
            message=message,
            timestamp=datetime.utcnow(),
            user_id=user_id
        )
        
        self._alerts.append(alert)
        self._alert_cooldowns[cooldown_key] = datetime.utcnow()
        
        # Trigger alert handlers
        self._trigger_alert_handlers(alert)
        
        return alert
    
    def _trigger_alert_handlers(self, alert: Alert):
        """Trigger registered alert handlers."""
        for handler in self._alert_handlers:
            try:
                handler(alert)
            except Exception as e:
                logger.error(f"Alert handler error: {e}")
    
    def register_alert_handler(self, handler: Callable[[Alert], None]):
        """Register an alert handler (e.g., Telegram notifier)."""
        self._alert_handlers.append(handler)
    
    def get_recent_alerts(self, count: int = 50, severity: Optional[AlertSeverity] = None) -> List[Alert]:
        """Get recent alerts, optionally filtered by severity."""
        alerts = list(self._alerts)[-count:]
        if severity:
            alerts = [a for a in alerts if a.severity == severity]
        return alerts
    
    def acknowledge_alert(self, alert_id: str) -> bool:
        """Acknowledge an alert."""
        for alert in self._alerts:
            if alert.alert_id == alert_id:
                alert.acknowledged = True
                return True
        return False
    
    def get_system_health(self) -> Dict:
        """Get system health metrics."""
        now = datetime.utcnow()
        
        # Global request rate (last 5 min)
        requests_5min = sum(s.value for s in self.get_global_metrics(MetricType.REQUEST_COUNT, 5))
        
        # Global error rate (last 5 min)
        total_requests = sum(s.value for s in self.get_global_metrics(MetricType.REQUEST_COUNT, 5))
        total_errors = sum(s.value for s in self.get_global_metrics(MetricType.ERROR_RATE, 5))
        error_rate = total_errors / total_requests if total_requests > 0 else 0
        
        # Rate limit hits (last 5 min)
        rate_limit_hits = sum(s.value for s in self.get_global_metrics(MetricType.RATE_LIMIT_HITS, 5))
        
        # Active users (requests in last 5 min)
        active_users = len(self._user_metrics)
        
        return {
            "status": "healthy" if error_rate < 0.05 else "degraded",
            "requests_per_minute": requests_5min / 5,
            "error_rate": error_rate,
            "rate_limit_hits_5min": rate_limit_hits,
            "active_users": active_users,
            "alerts_pending": len([a for a in self._alerts if not a.acknowledged]),
            "checked_at": now.isoformat()
        }
    
    def get_user_health(self, user_id: str) -> Dict:
        """Get health metrics for a specific user."""
        return {
            "user_id": user_id,
            "requests_1h": self.get_user_request_count(user_id, 60),
            "requests_24h": self.get_user_request_count(user_id, 1440),
            "error_rate_1h": self.get_user_error_rate(user_id, 60),
            "rate_limit_hits_1h": self.get_user_rate_limit_hits(user_id, 60),
            "rejected_models_24h": sum(s.value for s in self.get_user_metrics(user_id, MetricType.REJECTED_MODELS, 1440)),
            "invalid_sizes_24h": sum(s.value for s in self.get_user_metrics(user_id, MetricType.INVALID_SIZES, 1440))
        }


# Global instance
monitoring_service = MonitoringService()


# Convenience functions
def get_monitoring_service() -> MonitoringService:
    return monitoring_service


def record_request(user_id: str, endpoint: str, method: str, 
                   status_code: int, response_time_ms: float = 0):
    return monitoring_service.record_request(user_id, endpoint, method, status_code, response_time_ms)


def record_rejected_model(user_id: str, model_id: str, reason: str):
    return monitoring_service.record_rejected_model(user_id, model_id, reason)


def record_invalid_size(user_id: str, size: str, reason: str):
    return monitoring_service.record_invalid_size(user_id, size, reason)


def record_admin_action(admin_user_id: str, action: str, resource_id: str = "", details: Optional[Dict] = None):
    return monitoring_service.record_admin_action(admin_user_id, action, resource_id, details)


def record_auth_failure(user_id: str = None, reason: str = ""):
    return monitoring_service.record_auth_failure(user_id, reason)


def record_suspicious_activity(user_id: str, activity_type: str, details: Dict):
    return monitoring_service.record_suspicious_activity(user_id, activity_type, details)


def get_user_health(user_id: str) -> Dict:
    return monitoring_service.get_user_health(user_id)


def get_system_health() -> Dict:
    return monitoring_service.get_system_health()


def check_anomalies(user_id: str = None) -> List[Alert]:
    return monitoring_service.check_anomalies(user_id)


def register_alert_handler(handler: Callable[[Alert], None]):
    return monitoring_service.register_alert_handler(handler)


def get_recent_alerts(count: int = 50, severity: Optional[AlertSeverity] = None) -> List[Alert]:
    return monitoring_service.get_recent_alerts(count, severity)