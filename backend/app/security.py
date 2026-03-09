"""
Security module - Authentication and authorization.

Supports three authentication methods (in priority order):
1. Internal secret (X-Internal-Secret header) - server-to-server
2. JWT token (Authorization: Bearer <jwt>) - Supabase user tokens
3. API key (Authorization: Bearer sk-xxx or X-API-Key header) - programmatic access

The Bearer token format is auto-detected: if the token starts with "sk-" or
"vx-" it is treated as an API key; otherwise it is treated as a JWT.
This makes the API compatible with OpenAI SDKs that always send
`Authorization: Bearer <key>`.
"""
from fastapi import Header, HTTPException
from supabase import create_client, Client
from app.config import settings
import logging
import hashlib
import os
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Supabase client singleton
supabase: Client = None


def get_supabase() -> Client:
    """Get or create the Supabase client singleton."""
    global supabase
    if supabase is None:
        load_dotenv()

        url = os.getenv("SUPABASE_URL") or settings.supabase_url
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or settings.supabase_service_key

        if not url or not key:
            logger.error("Missing Supabase configuration!")
            raise ValueError("Supabase configuration missing")

        supabase = create_client(url, key)
    return supabase


# ---------------------------------------------------------------------------
# Internal secret verification
# ---------------------------------------------------------------------------

async def verify_internal_secret(x_internal_secret: str) -> bool:
    """Verify the server-to-server secret header."""
    if not settings.internal_secret:
        raise HTTPException(status_code=500, detail="Server configuration error")
    if x_internal_secret != settings.internal_secret:
        raise HTTPException(status_code=401, detail="Invalid internal secret")
    return True


# ---------------------------------------------------------------------------
# JWT verification
# ---------------------------------------------------------------------------

async def get_current_user(authorization: str) -> dict:
    """
    Extract and verify user from a Supabase JWT token.
    Returns user_id and email.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization.replace("Bearer ", "")
    try:
        sb = get_supabase()
        user_response = sb.auth.get_user(token)

        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user = user_response.user

        # Check ban status
        profile_response = (
            sb.table("profiles")
            .select("is_banned, ban_reason")
            .eq("user_id", user.id)
            .single()
        )

        if profile_response.data and profile_response.data.get("is_banned"):
            raise HTTPException(
                status_code=403,
                detail=f"Account banned: {profile_response.data.get('ban_reason', 'Contact support')}",
            )

        return {"user_id": user.id, "email": user.email}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"JWT verification failed: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")


# ---------------------------------------------------------------------------
# API key verification
# ---------------------------------------------------------------------------

async def verify_api_key(api_key: str) -> dict:
    """
    Verify an API key (e.g. sk-xxx or vx-xxx).
    Returns user_id and metadata from the api_keys table.
    """
    try:
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        key_prefix = api_key[:8]

        sb = get_supabase()
        response = sb.table("api_keys").select("*").eq("key_prefix", key_prefix).execute()

        if not response.data:
            raise HTTPException(status_code=401, detail="Invalid API key")

        record = response.data[0]

        if record["key_hash"] != key_hash:
            raise HTTPException(status_code=401, detail="Invalid API key")

        if record["status"] != "active":
            raise HTTPException(status_code=403, detail=f"API key is {record['status']}")

        if record.get("expires_at") and record["expires_at"] < "now":
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
        logger.error(f"API key verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid API key")


# ---------------------------------------------------------------------------
# Unified authentication dependency
# ---------------------------------------------------------------------------

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
    """
    Unified authentication dependency.

    Supports:
    - X-Internal-Secret header (server-to-server, highest priority)
    - Authorization: Bearer <jwt> (Supabase JWT)
    - Authorization: Bearer sk-xxx (API key via OpenAI SDK convention)
    - X-API-Key header (explicit API key)
    """
    # 1. Internal secret (server-to-server)
    if x_internal_secret:
        try:
            await verify_internal_secret(x_internal_secret)
            if not x_user_id:
                raise HTTPException(status_code=400, detail="Missing user ID for internal request")
            return {
                "user_id": x_user_id,
                "api_key_id": x_api_key_id or None,
                "source": "edge_function",
            }
        except HTTPException:
            raise

    # 2. Authorization header (JWT or API key -- auto-detected)
    if authorization:
        token = authorization.replace("Bearer ", "").strip()

        if _is_api_key(token):
            # Treat as API key (OpenAI SDK sends keys this way)
            try:
                return await verify_api_key(token)
            except HTTPException:
                raise
        else:
            # Treat as Supabase JWT
            try:
                return await get_current_user(authorization)
            except HTTPException:
                # If JWT fails, don't fall through -- raise immediately
                raise

    # 3. Explicit X-API-Key header
    if x_api_key:
        try:
            return await verify_api_key(x_api_key)
        except HTTPException:
            raise

    # Nothing provided
    raise HTTPException(
        status_code=401,
        detail="Authentication required. Provide an API key via Authorization: Bearer <key> or X-API-Key header.",
    )
