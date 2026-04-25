"""
Security Headers Middleware
Production-grade security headers for all HTTP responses.

Headers implemented:
- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Strict-Transport-Security (HSTS)
- Referrer-Policy
- Permissions-Policy

SECURITY: Designed to protect against common web vulnerabilities.
"""

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import logging

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.
    
    Headers added:
    - Content-Security-Policy: Prevents XSS, injection, etc.
    - X-Frame-Options: Prevents clickjacking
    - X-Content-Type-Options: Prevents MIME sniffing
    - X-XSS-Protection: Legacy XSS protection (deprecated but still useful)
    - Strict-Transport-Security: Enforces HTTPS
    - Referrer-Policy: Controls referrer information
    - Permissions-Policy: Controls browser features
    """
    
    # Content Security Policy
    # Allows resources from same origin and trusted CDNs only
    CSP = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://esm.sh; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "img-src 'self' data: https: blob:; "
        "font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self' https://*.supabase.co https://*.supabase.io wss:; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "base-uri 'self'; "
        "object-src 'none'; "
        "upgrade-insecure-requests"
    )
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response: Response = await call_next(request)
        
        # Only add security headers to HTML/JSON responses
        content_type = response.headers.get("content-type", "")
        
        # Skip for streaming responses
        if hasattr(response, 'body_iterator'):
            return response
        
        # Add security headers
        response.headers["Content-Security-Policy"] = self.CSP
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), "
            "camera=(), "
            "geolocation=(), "
            "gyroscope=(), "
            "magnetometer=(), "
            "microphone=(), "
            "payment=(), "
            "usb=()"
        )
        
        # Remove server header (hide server version)
        if "server" in response.headers:
            del response.headers["server"]
        
        return response


class CORSCustomizationMiddleware(BaseHTTPMiddleware):
    """
    Additional CORS validation at middleware level.
    
    Provides defense-in-depth beyond FastAPI's CORS middleware.
    """
    
    TRUSTED_ORIGINS = [
        "https://amikra.zo.space",
        "https://visuluxe.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check origin header for additional validation
        origin = request.headers.get("origin")
        
        if origin and origin not in self.TRUSTED_ORIGINS:
            # Log suspicious origin attempt
            logger.warning(f"Untrusted origin blocked: {origin} from {request.client.host if request.client else 'unknown'}")
            
            # For API routes, return 403
            if request.url.path.startswith("/v1/"):
                return JSONResponse(
                    status_code=403,
                    content={"error": "CORS policy violation"}
                )
        
        response = await call_next(request)
        return response


# Security headers for different response types
API_SECURITY_HEADERS = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "accelerometer=(),camera=(),geolocation=(),gyroscope=()",
}


def add_security_headers(response: Response):
    """Add security headers to a response object."""
    for header, value in API_SECURITY_HEADERS.items():
        response.headers[header] = value
    return response


def create_csp_for_api() -> str:
    """
    Create a stricter CSP for API responses.
    APIs don't need many browser features.
    """
    return (
        "default-src 'none'; "
        "script-src 'none'; "
        "style-src 'none'; "
        "img-src 'self' data: https:; "
        "font-src 'none'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "base-uri 'self'; "
        "object-src 'none'"
    )
