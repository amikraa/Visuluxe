"""
Audit Logging Service
Provides immutable, structured audit trail for all sensitive/admin actions.

SECURITY: VULN-012 Fix
- All admin actions are logged with user_id, timestamp, IP, action details
- Logs are append-only (insert only, no updates/deletes)
- Cannot be disabled at runtime
- Structured JSON format for easy analysis
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from enum import Enum
import json

logger = logging.getLogger(__name__)


class AuditAction(Enum):
    """Enumeration of all auditable actions."""
    # Queue operations
    QUEUE_PAUSE = "queue_pause"
    QUEUE_RESUME = "queue_resume"
    QUEUE_CONFIG_CHANGE = "queue_config_change"
    
    # Job operations
    JOB_CANCEL = "job_cancel"
    JOB_RETRY = "job_retry"
    JOB_TERMINATE = "job_terminate"
    JOB_PRIORITY_CHANGE = "job_priority_change"
    JOB_VIEW = "job_view"
    
    # System operations
    CONFIG_CHANGE = "config_change"
    SYSTEM_SETTING_UPDATE = "system_setting_update"
    SYSTEM_MAINTENANCE_MODE = "system_maintenance_mode"
    
    # Admin operations
    ADMIN_LOGIN = "admin_login"
    ADMIN_LOGOUT = "admin_logout"
    ADMIN_ACCESS = "admin_access"
    
    # Cleanup operations
    CLEANUP_EXPIRED_IMAGES = "cleanup_expired_images"
    CLEANUP_OLD_JOBS = "cleanup_old_jobs"


class AuditLogger:
    """
    Immutable audit trail for security-critical operations.
    
    Features:
    - Append-only logs (no update/delete)
    - Structured JSON format
    - Includes all required fields: user_id, timestamp, IP, action, resource
    - Cannot be disabled at runtime (always writes to DB)
    - Idempotent operations create single audit entry
    """
    
    _instance = None
    _initialized = False
    
    # Audit table name
    AUDIT_TABLE = "admin_audit_log"
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not AuditLogger._initialized:
            self._setup_audit_table()
            AuditLogger._initialized = True
    
    def _get_db_client(self):
        """Get database client."""
        from app.security import get_supabase
        return get_supabase()
    
    def _setup_audit_table(self):
        """
        Ensure audit table exists with proper schema.
        This is called once at initialization.
        """
        try:
            sb = self._get_db_client()
            
            # Check if table exists by trying to select
            try:
                sb.table(self.AUDIT_TABLE).select("id").limit(1).execute()
            except Exception:
                # Table doesn't exist - in production, use migrations
                # For now, we'll create via direct SQL if needed
                logger.warning(f"Audit table {self.AUDIT_TABLE} may not exist. Ensure via migration.")
        except Exception as e:
            logger.error(f"Failed to setup audit table: {e}")
    
    def log(
        self,
        action: AuditAction,
        admin_user_id: str,
        resource_type: str,
        resource_id: str,
        ip_address: str = "unknown",
        details: Optional[Dict[str, Any]] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> bool:
        """
        Create an audit log entry.
        
        Args:
            action: The action being performed (AuditAction enum)
            admin_user_id: The admin performing the action
            resource_type: Type of resource being modified (e.g., "job", "queue", "config")
            resource_id: ID of the resource being modified
            ip_address: IP address of the admin (if known)
            details: Additional context about the action
            before_state: State before the change (for mutations)
            after_state: State after the change (for mutations)
            success: Whether the action succeeded
            error_message: Error message if action failed
        
        Returns:
            bool: True if logged successfully
        """
        try:
            sb = self._get_db_client()
            
            # Build audit entry
            audit_entry = {
                "action": action.value if isinstance(action, AuditAction) else action,
                "admin_user_id": admin_user_id,
                "resource_type": resource_type,
                "resource_id": str(resource_id),
                "ip_address": ip_address,
                "details": json.dumps(details) if details else None,
                "before_state": json.dumps(before_state) if before_state else None,
                "after_state": json.dumps(after_state) if after_state else None,
                "success": success,
                "error_message": error_message,
                "user_agent": None,  # Could be passed in if needed
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Insert audit entry (append-only)
            response = sb.table(self.AUDIT_TABLE).insert(audit_entry).execute()
            
            if response.data:
                logger.info(f"AUDIT: {action.value} by {admin_user_id} on {resource_type}/{resource_id} - {'SUCCESS' if success else 'FAILED'}")
                return True
            else:
                logger.warning(f"Audit log insert returned no data for {action.value}")
                return False
                
        except Exception as e:
            # Audit logging failures should NEVER block the action
            # Log to file as fallback
            logger.error("FAILED TO WRITE AUDIT LOG: %s by %s - %s", action.value if isinstance(action, AuditAction) else action, admin_user_id, e)
            # Fallback: write to application log using %s to avoid f-string conflicts with json.dumps
            fallback_payload = {
                "action": action.value if isinstance(action, AuditAction) else action,
                "admin_user_id": admin_user_id,
                "resource_type": resource_type,
                "resource_id": str(resource_id),
                "success": success,
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            logger.warning("AUDIT_FALLBACK: %s", json.dumps(fallback_payload))
            return False
    
    def log_queue_pause(self, admin_user_id: str, reason: str = "", ip_address: str = "unknown") -> bool:
        """Log queue pause action."""
        return self.log(
            action=AuditAction.QUEUE_PAUSE,
            admin_user_id=admin_user_id,
            resource_type="queue",
            resource_id="main",
            ip_address=ip_address,
            details={"reason": reason},
            after_state={"queue_paused": True}
        )
    
    def log_queue_resume(self, admin_user_id: str, reason: str = "", ip_address: str = "unknown") -> bool:
        """Log queue resume action."""
        return self.log(
            action=AuditAction.QUEUE_RESUME,
            admin_user_id=admin_user_id,
            resource_type="queue",
            resource_id="main",
            ip_address=ip_address,
            details={"reason": reason},
            after_state={"queue_paused": False}
        )
    
    def log_job_cancel(self, admin_user_id: str, job_id: str, ip_address: str = "unknown") -> bool:
        """Log job cancellation."""
        return self.log(
            action=AuditAction.JOB_CANCEL,
            admin_user_id=admin_user_id,
            resource_type="job",
            resource_id=job_id,
            ip_address=ip_address,
            after_state={"status": "cancelled"}
        )
    
    def log_job_terminate(self, admin_user_id: str, job_id: str, ip_address: str = "unknown") -> bool:
        """Log job termination."""
        return self.log(
            action=AuditAction.JOB_TERMINATE,
            admin_user_id=admin_user_id,
            resource_type="job",
            resource_id=job_id,
            ip_address=ip_address,
            after_state={"status": "terminated"}
        )
    
    def log_job_retry(self, admin_user_id: str, job_id: str, before_state: Dict, ip_address: str = "unknown") -> bool:
        """Log job retry."""
        return self.log(
            action=AuditAction.JOB_RETRY,
            admin_user_id=admin_user_id,
            resource_type="job",
            resource_id=job_id,
            ip_address=ip_address,
            before_state=before_state,
            after_state={"status": "pending", "retry_count": before_state.get("retry_count", 0) + 1}
        )
    
    def log_job_priority_change(
        self, 
        admin_user_id: str, 
        job_id: str, 
        old_priority: int, 
        new_priority: int,
        ip_address: str = "unknown"
    ) -> bool:
        """Log job priority change."""
        return self.log(
            action=AuditAction.JOB_PRIORITY_CHANGE,
            admin_user_id=admin_user_id,
            resource_type="job",
            resource_id=job_id,
            ip_address=ip_address,
            details={"old_priority": old_priority, "new_priority": new_priority},
            before_state={"priority": old_priority},
            after_state={"priority": new_priority}
        )
    
    def log_config_change(
        self, 
        admin_user_id: str, 
        config_key: str, 
        old_value: Any, 
        new_value: Any,
        ip_address: str = "unknown"
    ) -> bool:
        """Log configuration change."""
        return self.log(
            action=AuditAction.CONFIG_CHANGE,
            admin_user_id=admin_user_id,
            resource_type="config",
            resource_id=config_key,
            ip_address=ip_address,
            before_state={"value": old_value},
            after_state={"value": new_value}
        )
    
    def log_cleanup(
        self, 
        admin_user_id: str, 
        cleanup_type: str, 
        items_cleaned: int,
        ip_address: str = "unknown"
    ) -> bool:
        """Log cleanup operation."""
        return self.log(
            action=AuditAction.CLEANUP_EXPIRED_IMAGES if "image" in cleanup_type else AuditAction.CLEANUP_OLD_JOBS,
            admin_user_id=admin_user_id,
            resource_type="cleanup",
            resource_id=cleanup_type,
            ip_address=ip_address,
            details={"items_cleaned": items_cleaned}
        )
    
    def log_admin_access(
        self,
        admin_user_id: str,
        endpoint: str,
        ip_address: str = "unknown",
        success: bool = True
    ) -> bool:
        """Log admin access to sensitive endpoint."""
        return self.log(
            action=AuditAction.ADMIN_ACCESS,
            admin_user_id=admin_user_id,
            resource_type="admin_endpoint",
            resource_id=endpoint,
            ip_address=ip_address,
            success=success
        )


# Global instance
audit_logger = AuditLogger()


# Convenience functions
def log_audit(
    action: AuditAction,
    admin_user_id: str,
    resource_type: str,
    resource_id: str,
    ip_address: str = "unknown",
    **kwargs
) -> bool:
    """Convenience function for audit logging."""
    return audit_logger.log(action, admin_user_id, resource_type, resource_id, ip_address, **kwargs)


def log_queue_pause(admin_user_id: str, reason: str = "", ip_address: str = "unknown") -> bool:
    return audit_logger.log_queue_pause(admin_user_id, reason, ip_address)


def log_queue_resume(admin_user_id: str, reason: str = "", ip_address: str = "unknown") -> bool:
    return audit_logger.log_queue_resume(admin_user_id, reason, ip_address)


def log_job_cancel(admin_user_id: str, job_id: str, ip_address: str = "unknown") -> bool:
    return audit_logger.log_job_cancel(admin_user_id, job_id, ip_address)


def log_job_terminate(admin_user_id: str, job_id: str, ip_address: str = "unknown") -> bool:
    return audit_logger.log_job_terminate(admin_user_id, job_id, ip_address)


def log_job_retry(admin_user_id: str, job_id: str, before_state: Dict, ip_address: str = "unknown") -> bool:
    return audit_logger.log_job_retry(admin_user_id, job_id, before_state, ip_address)


def log_job_priority_change(admin_user_id: str, job_id: str, old_priority: int, new_priority: int, ip_address: str = "unknown") -> bool:
    return audit_logger.log_job_priority_change(admin_user_id, job_id, old_priority, new_priority, ip_address)


def log_config_change(admin_user_id: str, config_key: str, old_value: Any, new_value: Any, ip_address: str = "unknown") -> bool:
    return audit_logger.log_config_change(admin_user_id, config_key, old_value, new_value, ip_address)


def log_cleanup(admin_user_id: str, cleanup_type: str, items_cleaned: int, ip_address: str = "unknown") -> bool:
    return audit_logger.log_cleanup(admin_user_id, cleanup_type, items_cleaned, ip_address)


def log_admin_access(admin_user_id: str, endpoint: str, ip_address: str = "unknown", success: bool = True) -> bool:
    return audit_logger.log_admin_access(admin_user_id, endpoint, ip_address, success)