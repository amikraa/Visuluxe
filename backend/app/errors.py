"""
OpenAI-compatible error handling.

Provides a centralized exception hierarchy and a FastAPI exception handler
that formats all errors into the standard OpenAI error envelope:

    {
      "error": {
        "message": "...",
        "type": "...",
        "param": null,
        "code": null
      }
    }
"""
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom exception classes
# ---------------------------------------------------------------------------

class OpenAIAPIError(HTTPException):
    """Base class for OpenAI-formatted API errors."""

    def __init__(
        self,
        status_code: int,
        message: str,
        error_type: str = "invalid_request_error",
        param: str = None,
        code: str = None,
    ):
        self.error_type = error_type
        self.param = param
        self.error_code = code
        super().__init__(status_code=status_code, detail=message)


class AuthenticationError(OpenAIAPIError):
    def __init__(self, message: str = "Invalid API key or token"):
        super().__init__(401, message, error_type="authentication_error", code="invalid_api_key")


class PermissionError(OpenAIAPIError):
    def __init__(self, message: str = "You do not have access to this resource"):
        super().__init__(403, message, error_type="permission_error", code="insufficient_permissions")


class NotFoundError(OpenAIAPIError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(404, message, error_type="not_found_error", code="resource_not_found")


class RateLimitError(OpenAIAPIError):
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(429, message, error_type="rate_limit_error", code="rate_limit_exceeded")


class InsufficientCreditsError(OpenAIAPIError):
    def __init__(self, message: str = "Insufficient credits"):
        super().__init__(402, message, error_type="billing_error", code="insufficient_credits")


class ModelNotFoundError(OpenAIAPIError):
    def __init__(self, model: str):
        super().__init__(
            404,
            f"The model '{model}' does not exist or you do not have access to it.",
            error_type="invalid_request_error",
            param="model",
            code="model_not_found",
        )


class ServerError(OpenAIAPIError):
    def __init__(self, message: str = "Internal server error"):
        super().__init__(500, message, error_type="server_error", code="internal_error")


# ---------------------------------------------------------------------------
# FastAPI exception handlers
# ---------------------------------------------------------------------------

def _build_error_body(message: str, error_type: str, param=None, code=None) -> dict:
    return {
        "error": {
            "message": message,
            "type": error_type,
            "param": param,
            "code": code,
        }
    }


async def openai_http_exception_handler(request: Request, exc: HTTPException):
    """Convert any HTTPException into OpenAI error format."""
    if isinstance(exc, OpenAIAPIError):
        body = _build_error_body(exc.detail, exc.error_type, exc.param, exc.error_code)
    else:
        body = _build_error_body(
            str(exc.detail),
            "invalid_request_error",
            code=str(exc.status_code),
        )
    return JSONResponse(status_code=exc.status_code, content=body)


async def openai_validation_exception_handler(request: Request, exc: RequestValidationError):
    """Convert Pydantic validation errors into OpenAI error format."""
    errors = exc.errors()
    first = errors[0] if errors else {}
    loc = first.get("loc", [])
    param = ".".join(str(l) for l in loc) if loc else None
    message = first.get("msg", "Validation error")

    body = _build_error_body(message, "invalid_request_error", param=param, code="validation_error")
    return JSONResponse(status_code=400, content=body)


async def openai_generic_exception_handler(request: Request, exc: Exception):
    """Catch-all handler that returns OpenAI-formatted 500 errors."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    body = _build_error_body("Internal server error", "server_error", code="internal_error")
    return JSONResponse(status_code=500, content=body)
