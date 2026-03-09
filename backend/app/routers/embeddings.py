"""
POST /v1/embeddings

OpenAI-compatible embeddings endpoint.
"""
import logging

from fastapi import APIRouter, Depends

from app.models.openai_schemas import EmbeddingRequest
from app.security import get_authenticated_user
from app.adapters.registry import get_adapter
from app.errors import ModelNotFoundError, ServerError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/embeddings")
async def create_embedding(
    body: EmbeddingRequest,
    user: dict = Depends(get_authenticated_user),
):
    """
    Create embeddings for the given input text(s).

    Compatible with the OpenAI Embeddings API.
    """
    adapter = get_adapter(body.model)
    if adapter is None:
        raise ModelNotFoundError(body.model)

    # Normalize input to list of strings
    if isinstance(body.input, str):
        input_texts = [body.input]
    else:
        input_texts = body.input

    try:
        result = await adapter.embeddings(
            model=body.model,
            input_texts=input_texts,
        )
        return result

    except NotImplementedError:
        raise ModelNotFoundError(body.model)
    except Exception as e:
        logger.error(f"Embedding error: {e}", exc_info=True)
        raise ServerError(f"Embedding creation failed: {str(e)}")
