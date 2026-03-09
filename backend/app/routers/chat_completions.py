"""
POST /v1/chat/completions

OpenAI-compatible chat completions endpoint with full streaming (SSE) support,
tool calling, function calling, and all standard parameters.
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.models.openai_schemas import ChatCompletionRequest
from app.security import get_authenticated_user
from app.adapters.registry import get_adapter
from app.errors import ModelNotFoundError, ServerError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat/completions")
async def create_chat_completion(
    body: ChatCompletionRequest,
    user: dict = Depends(get_authenticated_user),
):
    """
    Create a chat completion.

    Compatible with the OpenAI Chat Completions API. Supports streaming,
    tool calling, function calling, and all standard parameters.
    """
    adapter = get_adapter(body.model)
    if adapter is None:
        raise ModelNotFoundError(body.model)

    # Build kwargs from the request
    messages = [m.model_dump(exclude_none=True) for m in body.messages]
    tools = [t.model_dump(exclude_none=True) for t in body.tools] if body.tools else None

    kwargs = {
        "model": body.model,
        "messages": messages,
        "temperature": body.temperature if body.temperature is not None else 1.0,
        "top_p": body.top_p if body.top_p is not None else 1.0,
        "max_tokens": body.max_tokens,
        "stop": body.stop,
        "tools": tools,
        "tool_choice": body.tool_choice,
    }

    # Handle deprecated function_call / functions fields
    if body.functions and not tools:
        kwargs["tools"] = [
            {"type": "function", "function": f.model_dump(exclude_none=True)}
            for f in body.functions
        ]
    if body.function_call and not body.tool_choice:
        kwargs["tool_choice"] = body.function_call

    if body.seed is not None:
        kwargs["seed"] = body.seed
    if body.response_format:
        kwargs["response_format"] = body.response_format.model_dump()

    try:
        if body.stream:
            return StreamingResponse(
                _stream_response(adapter, kwargs),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )
        else:
            result = await adapter.chat_completion(**kwargs)
            return result

    except NotImplementedError as e:
        raise ModelNotFoundError(body.model)
    except Exception as e:
        logger.error(f"Chat completion error: {e}", exc_info=True)
        raise ServerError(f"Chat completion failed: {str(e)}")


async def _stream_response(adapter, kwargs):
    """Wrap the adapter's stream generator to handle errors gracefully."""
    try:
        async for chunk in adapter.chat_completion_stream(**kwargs):
            yield chunk
    except NotImplementedError:
        # Send an error chunk
        error_chunk = {
            "error": {
                "message": f"Model does not support chat completions",
                "type": "invalid_request_error",
                "code": "model_not_supported",
            }
        }
        yield f"data: {json.dumps(error_chunk)}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.error(f"Stream error: {e}", exc_info=True)
        error_chunk = {
            "error": {
                "message": str(e),
                "type": "server_error",
                "code": "stream_error",
            }
        }
        yield f"data: {json.dumps(error_chunk)}\n\n"
        yield "data: [DONE]\n\n"
