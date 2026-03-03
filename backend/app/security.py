"""
Security module - Authentication and authorization
"""
from fastapi import Header, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from app.config import settings
import logging
import hashlib

logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase: Client = None


def get_supabase() -> Client:
    global supabase
    if supabase is None:
        # Debug logging
        import os
        from dotenv import load_dotenv
        load_dotenv()
        
        # Try direct environment access first
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        logger.info(f"Direct env access - URL: {url}")
        logger.info(f"Direct env access - Key length: {len(key) if key else 0}")
        
        # Also try settings
        try:
            from app.config import settings
            logger.info(f"Settings access - URL: {settings.supabase_url}")
            logger.info(f"Settings access - Key length: {len(settings.supabase_service_key) if settings.supabase_service_key else 0}")
            
            # Use settings if they're populated, otherwise use direct env
            final_url = settings.supabase_url if settings.supabase_url else url
            final_key = settings.supabase_service_key if settings.supabase_service_key else key
        except Exception as e:
            logger.error(f"Error accessing settings: {e}")
            final_url = url
            final_key = key
        
        logger.info(f"Final values - URL: {final_url}")
        logger.info(f"Final values - Key length: {len(final_key) if final_key else 0}")
        
        if not final_url or not final_key:
            logger.error("Missing Supabase configuration!")
            raise ValueError("Supabase configuration missing")
        
        # Create client without proxy parameter that causes issues
        supabase = create_client(
            final_url,
            final_key
        )
    return supabase


async def verify_internal_secret(x_internal_secret: str = Header(...)) -> bool:
    """
    Verify the server-to-server secret header.
    This is used by Supabase Edge Functions to communicate with the backend.
    """
    if not settings.internal_secret:
        logger.warning("INTERNAL_SECRET not configured")
        raise HTTPException(status_code=500, detail="Server configuration error")
    
    if x_internal_secret != settings.internal_secret:
        logger.warning(f"Invalid internal secret attempt")
        raise HTTPException(status_code=401, detail="Invalid internal secret")
    return True


async def get_current_user(
    authorization: str = Header(None, description="Bearer JWT token")
) -> dict:
    """
    Extract and verify user from JWT token.
    Returns user_id and email - NEVER trust client-provided user_id.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        token = authorization.replace("Bearer ", "")
        sb = get_supabase()
        user_response = sb.auth.get_user(token)
        
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        user = user_response.user
        
        # Get profile to check ban status
        profile_response = sb.table("profiles").select("is_banned, ban_reason").eq("user_id", user.id).single()
        
        if profile_response.data and profile_response.data.get("is_banned"):
            raise HTTPException(
                status_code=403,
                detail=f"Account banned: {profile_response.data.get('ban_reason', 'Contact support')}"
            )
        
        return {
            "user_id": user.id,
            "email": user.email,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth verification failed: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")


async def verify_api_key(x_api_key: str = Header(None)) -> dict:
    """
    Verify API key from request header.
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    
    try:
        # Hash the API key
        key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
        key_prefix = x_api_key[:8]
        
        sb = get_supabase()
        
        # Query database for valid API key
        response = sb.table("api_keys").select("*").eq("key_prefix", key_prefix).execute()
        
        if not response.data:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        api_key = response.data[0]
        
        # Verify hash
        if api_key["key_hash"] != key_hash:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Check status
        if api_key["status"] != "active":
            raise HTTPException(status_code=403, detail=f"API key is {api_key['status']}")
        
        # Check expiry
        if api_key.get("expires_at") and api_key["expires_at"] < "now":
            raise HTTPException(status_code=403, detail="API key has expired")
        
        return {
            "user_id": api_key["user_id"],
            "api_key_id": api_key["id"],
            "custom_rpm": api_key.get("custom_rpm"),
            "custom_rpd": api_key.get("custom_rpd"),
            "allowed_models": api_key.get("allowed_models")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API key verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid API key")


async def get_authenticated_user(
    authorization: str = Header(None),
    x_api_key: str = Header(None),
    x_internal_secret: str = Header(None),
    x_user_id: str = Header(None),
    x_api_key_id: str = Header(None)
) -> dict:
    """
    Get authenticated user - supports JWT, API key, or internal secret.
    Priority order: Internal Secret > JWT Token > API Key
    """
    # Log all incoming headers for debugging
    logger.info(f"Auth headers received - Authorization: {'present' if authorization else 'missing'}, "
                f"X-API-Key: {'present' if x_api_key else 'missing'}, "
                f"X-Internal-Secret: {'present' if x_internal_secret else 'missing'}, "
                f"X-User-ID: {x_user_id or 'missing'}, "
                f"X-API-Key-ID: {x_api_key_id or 'missing'}")
    
    # Highest priority: Internal secret (server-to-server)
    if x_internal_secret:
        logger.info("Attempting internal secret authentication")
        try:
            await verify_internal_secret(x_internal_secret)
            # For internal requests, we trust the Edge Function has already authenticated
            # The Edge Function passes the authenticated user ID
            if not x_user_id:
                logger.error("Internal secret valid but missing user ID")
                raise HTTPException(status_code=400, detail="Missing user ID for internal request")
            logger.info(f"Internal authentication successful for user: {x_user_id}")
            return {
                "user_id": x_user_id,
                "api_key_id": x_api_key_id or None,
                "source": "edge_function"
            }
        except HTTPException:
            logger.error("Internal secret verification failed")
            raise
        except Exception as e:
            logger.error(f"Internal secret verification error: {e}")
            raise HTTPException(status_code=401, detail="Internal authentication failed")
    
    # Second priority: JWT Token
    if authorization:
        logger.info("Attempting JWT token authentication")
        try:
            result = get_current_user(authorization)
            logger.info(f"JWT authentication successful for user: {result.get('user_id')}")
            return result
        except HTTPException as e:
            logger.error(f"JWT authentication failed: {e.detail}")
            pass  # Fall through to API key check
        except Exception as e:
            logger.error(f"JWT authentication error: {e}")
            pass  # Fall through to API key check
    
    # Third priority: API Key
    if x_api_key:
        logger.info("Attempting API key authentication")
        try:
            result = verify_api_key(x_api_key)
            logger.info(f"API key authentication successful for user: {result.get('user_id')}")
            return result
        except HTTPException as e:
            logger.error(f"API key authentication failed: {e.detail}")
            pass  # Fall through to error
        except Exception as e:
            logger.error(f"API key authentication error: {e}")
            pass  # Fall through to error
    
    # If none work, reject
    logger.error("All authentication methods failed")
    raise HTTPException(status_code=401, detail="Authentication required")
