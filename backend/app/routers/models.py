"""
GET /v1/models
GET /v1/models/{model_id}

OpenAI-compatible model listing endpoint. Returns models in the exact
format expected by OpenAI SDKs.
"""
import time
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.security import get_authenticated_user
from app.services.provider import ProviderService
from app.adapters.registry import list_supported_models
from app.errors import NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def list_models(user: dict = Depends(get_authenticated_user)):
    """
    List available models.

    Returns models from the database (provider-managed models) merged with
    locally registered adapter models, all in OpenAI-compatible format.
    """
    models = []
    seen_ids = set()

    # 1. Database-managed models (from ai_models table)
    try:
        db_models = await ProviderService.get_available_models(user.get("user_id"))
        for m in db_models:
            model_id = m.get("model_id") or m.get("id")
            if model_id and model_id not in seen_ids:
                seen_ids.add(model_id)
                models.append({
                    "id": model_id,
                    "object": "model",
                    "created": int(
                        time.mktime(
                            time.strptime(m["created_at"][:19], "%Y-%m-%dT%H:%M:%S")
                        )
                    ) if m.get("created_at") else 0,
                    "owned_by": m.get("provider_name", "visuluxe"),
                    "permission": [
                        {
                            "id": f"modelperm-{model_id}",
                            "object": "model_permission",
                            "created": 0,
                            "allow_create_engine": False,
                            "allow_sampling": True,
                            "allow_logprobs": False,
                            "allow_search_indices": False,
                            "allow_view": True,
                            "allow_fine_tuning": False,
                            "organization": "*",
                            "group": None,
                            "is_blocking": False,
                        }
                    ],
                    "root": model_id,
                    "parent": None,
                })
    except Exception as e:
        logger.warning(f"Failed to load database models: {e}")

    # 2. Locally registered adapter models (fill in any gaps)
    for model_id in list_supported_models():
        if model_id not in seen_ids:
            seen_ids.add(model_id)
            models.append({
                "id": model_id,
                "object": "model",
                "created": 0,
                "owned_by": "visuluxe",
                "permission": [],
                "root": model_id,
                "parent": None,
            })

    return {"object": "list", "data": models}


@router.get("/{model_id}")
async def get_model(model_id: str, user: dict = Depends(get_authenticated_user)):
    """
    Retrieve a single model by ID.

    Returns the model object in OpenAI-compatible format.
    """
    # Try database first
    try:
        model = await ProviderService.get_model_info(model_id)
        if model:
            mid = model.get("model_id") or model.get("id")
            return {
                "id": mid,
                "object": "model",
                "created": 0,
                "owned_by": model.get("provider_name", "visuluxe"),
                "permission": [],
                "root": mid,
                "parent": None,
            }
    except Exception:
        pass

    # Check adapter registry
    if model_id in list_supported_models():
        return {
            "id": model_id,
            "object": "model",
            "created": 0,
            "owned_by": "visuluxe",
            "permission": [],
            "root": model_id,
            "parent": None,
        }

    raise NotFoundError(f"The model '{model_id}' does not exist or you do not have access to it.")
