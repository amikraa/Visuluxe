"""
Security module - Authentication and authorization.

Supports three authentication methods (in priority order):
1. Internal secret (X-Internal-Secret header) - server-to-server
2. JWT token (Authorization: Bearer <jwt>) - Supabase user tokens
3. API key (Authorization: Bearer sk-xxx or X-API-Key header) - programmatic access
"""
from fastapi import Header, HTTPException
from supabase.client import create_client, Client
from app.config import settings
from app.services.null_supabase import NullSupabase
import logging
import hashlib
import hmac
import time

logger = logging.getLogger(__name__)

MAX_REQUEST_AGE_SECONDS = 300

# Throttle repeated warnings in degraded mode - log once at startup, not every request
_degraded_warning_logged = False

def _log_degraded_once(message: str):
    """Log a message only once to avoid log spam in degraded mode."""
    global _degraded_warning_logged
    if not _degraded_warning_logged:
        logger.warning(f"DEGRADED MODE: {message}")
        _degraded_warning_logged = True

supabase: Client | None = None


def get_supabase() -> Client:
    """Get or create the Supabase client singleton."""
    global supabase
    if supabase is None:
        url = settings.supabase_url
        key = settings.supabase_service_role_key
        if not url or not key:
            _log_degraded_once(
                "Supabase not configured. Using NullSupabase (all DB ops return empty results). "
                "Authentication will fail. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to fix."
            )
            return NullSupabase()
        supabase = create_client(url, key)
    return supabase


async def verify_internal_secret(x_internal_secret: str) -> bool:
    """Verify the server-to-server secret header."""
    if not settings.internal_secret:
        raise HTTPException(status_code=500, detail="Server configuration error")
    if x_internal_secret != settings.internal_secret:
        raise HTTPException(status_code=401, detail="Invalid internal secret")
    return True


async def get_current_user(authorization: str) -> dict:
    """Extract and verify user from a Supabase JWT token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.replace("Bearer ", "")
    try:
        sb = get_supabase()
        if sb is None:
            logger.error("Supabase not configured - cannot verify JWT")
            raise HTTPException(status_code=503, detail="Authentication service unavailable")
        user_response = sb.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        user = user_response.user
        profile_response = sb.table("profiles").select("is_banned, ban_reason").eq("user_id", user.id).single().execute()
        if profile_response.data and profile_response.data.get("is_banned"):
            raise HTTPException(
                status_code=403,
                detail="Account banned: " + profile_response.data.get("ban_reason", "Contact support")
            )
        return {"user_id": user.id, "email": user.email}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("JWT verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Authentication failed")


async def verify_api_key(api_key: str, request_timestamp: str = None) -> dict:
    """Verify an API key (e.g. sk-xxx or vx-xxx)."""
    if request_timestamp:
        try:
            request_time = int(request_timestamp)
            current_time = int(time.time())
            if abs(current_time - request_time) > MAX_REQUEST_AGE_SECONDS:
                raise HTTPException(status_code=401, detail="Request timestamp expired or invalid")
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid request timestamp format")
    try:
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        key_prefix = api_key[:8]
        sb = get_supabase()
        if sb is None:
            logger.error("Supabase not configured - cannot verify API key")
            raise HTTPException(status_code=503, detail="Authentication service unavailable")
        response = sb.table("api_keys").select("*").eq("key_prefix", key_prefix).execute()
        if not response.data:
            raise HTTPException(status_code=401, detail="Invalid API key")
        record = response.data[0]
        if not hmac.compare_digest(record["key_hash"], key_hash):
            raise HTTPException(status_code=401, detail="Invalid API key")
        if record["status"] != "active":
            raise HTTPException(status_code=403, detail="API key is " + record["status"])
        if record.get("expires_at"):
            from datetime import datetime, timezone
            expires_at = record["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if expires_at < datetime.now(timezone.utc):
                raise HTTPException(status_code=403, detail="API key has expired")
        return {
            "user_id": record["user_id"],
            "api_key_id": record["id"],
            "custom_rpm": record.get("custom_rpm"),
            "custom_rpd": record.get("custom_rpd"),
            "allowed_models": record.get("allowed_models"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("API key verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid API key")


def _is_api_key(token: str) -> bool:
    """Heuristic: tokens starting with sk- or vx- are API keys."""
    return token.startswith("sk-") or token.startswith("vx-")


async def get_authenticated_user(
    authorization: str = Header(None),
    x_api_key: str = Header(None),
    x_internal_secret: str = Header(None),
    x_user_id: str = Header(None),
    x_api_key_id: str = Header(None),
) -> dict:
    """Unified authentication dependency."""
    if x_internal_secret:
        try:
            await verify_internal_secret(x_internal_secret)
            if not x_user_id:
                raise HTTPException(status_code=400, detail="Missing user ID for internal request")
            return {"user_id": x_user_id, "api_key_id": x_api_key_id or None, "source": "edge_function"}
        except HTTPException:
            raise
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        if _is_api_key(token):
            try:
                return await verify_api_key(token)
            except HTTPException:
                raise
        else:
            try:
                return await get_current_user(authorization)
            except HTTPException:
                raise
    if x_api_key:
        try:
            return await verify_api_key(x_api_key)
        except HTTPException:
            raise
    raise HTTPException(
        status_code=401,
        detail="Authentication required. Provide an API key via Authorization: Bearer <key> or X-API-Key header.",
    )


async def get_current_admin(
    authorization: str = Header(None),
    x_api_key: str = Header(None),
    x_internal_secret: str = Header(None),
    x_user_id: str = Header(None),
    x_api_key_id: str = Header(None),
) -> dict:
    """Admin authentication dependency."""
    user = await get_authenticated_user(
        authorization=authorization,
        x_api_key=x_api_key,
        x_internal_secret=x_internal_secret,
        x_user_id=x_user_id,
        x_api_key_id=x_api_key_id
    )
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Authentication service unavailable")
    response = sb.table("user_roles").select("role").eq("user_id", user["user_id"]).in_("role", ["admin", "super_admin"]).execute()
    if not response.data:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def verify_admin(
    authorization: str = Header(None),
    x_api_key: str = Header(None),
    x_internal_secret: str = Header(None),
    x_user_id: str = Header(None),
    x_api_key_id: str = Header(None),
) -> bool:
    """Verify if the current user is an admin. Returns True if admin, False otherwise."""
    try:
        user = await get_authenticated_user(
            authorization=authorization,
            x_api_key=x_api_key,
            x_internal_secret=x_internal_secret,
            x_user_id=x_user_id,
            x_api_key_id=x_api_key_id
        )
        sb = get_supabase()
        if sb is None:
            return False
        response = sb.table("user_roles").select("role").eq("user_id", user["user_id"]).in_("role", ["admin", "super_admin"]).execute()
        return bool(response.data)
    except Exception:
        return False
