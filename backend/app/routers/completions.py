"""
POST /v1/completions

OpenAI-compatible legacy text completions endpoint.
"""
import logging

from fastapi import APIRouter, Depends

from app.models.openai_schemas import CompletionRequest
from app.security import get_authenticated_user
from app.adapters.registry import get_adapter
from app.errors import ModelNotFoundError, ServerError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/completions")
async def create_completion(
    body: CompletionRequest,
    user: dict = Depends(get_authenticated_user),
):
    """
    Create a text completion (legacy endpoint).

    Compatible with the OpenAI Completions API.
    """
    adapter = get_adapter(body.model)
    if adapter is None:
        raise ModelNotFoundError(body.model)

    # Normalize prompt to a single string
    prompt = body.prompt if isinstance(body.prompt, str) else " ".join(body.prompt)

    try:
        result = await adapter.completion(
            model=body.model,
            prompt=prompt,
            temperature=body.temperature if body.temperature is not None else 1.0,
            top_p=body.top_p if body.top_p is not None else 1.0,
            max_tokens=body.max_tokens,
            stop=body.stop,
            stream=body.stream or False,
        )
        return result

    except NotImplementedError:
        raise ModelNotFoundError(body.model)
    except Exception as e:
        logger.error(f"Completion error: {e}", exc_info=True)
        raise ServerError(f"Completion failed: {str(e)}")
