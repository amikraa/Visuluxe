"""
GET /v1/models
GET /v1/models/{model_id}

OpenAI-compatible model listing endpoint. Returns models in the exact
format expected by OpenAI SDKs, using the new dynamic model registry.
"""
import time
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.security import get_authenticated_user, get_current_admin
from app.adapters.registry import list_supported_models
from app.services.database import DatabaseService
from app.errors import NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def list_models(
    user: dict = Depends(get_authenticated_user)
):
    """
    List available models.

    Returns models from the new dynamic model registry, filtered by active status,
    all in OpenAI-compatible format.
    """
    models = []
    seen_ids = set()

    # 1. Database-managed models from new model registry (only active models)
    try:
        sb = DatabaseService.get_client()
        
        # Get active models with their providers
        models_response = sb.table("models").select("*").eq("status", "active").execute()
        db_models = models_response.data or []
        
        for model in db_models:
            if model["model_id"] not in seen_ids:
                seen_ids.add(model["model_id"])
                
                # Get active providers for this model
                providers_response = sb.table("model_providers").select("*").eq("model_id", model["id"]).eq("status", "active").execute()
                providers = providers_response.data or []
                
                # Get provider details
                provider_details = []
                if providers:
                    provider_ids = [p["provider_id"] for p in providers]
                    provider_response = sb.table("providers").select("*").in_("id", provider_ids).execute()
                    provider_dict = {p["id"]: p for p in provider_response.data or []}
                    
                    for mp in providers:
                        provider = provider_dict.get(mp["provider_id"])
                        if provider:
                            provider_details.append({
                                "provider_id": str(provider["id"]),
                                "provider_name": provider["name"],
                                "provider_model_id": mp["provider_model_id"],
                                "provider_cost": float(mp["provider_cost"]),
                                "platform_price": float(mp["platform_price"]),
                                "max_images_supported": mp["max_images_supported"],
                                "status": mp["status"]
                            })

                models.append({
                    "id": model["model_id"],
                    "object": "model",
                    "created": int(time.mktime(datetime.fromisoformat(model["created_at"]).timetuple())) if model.get("created_at") else 0,
                    "owned_by": "visuluxe",
                    "permission": [
                        {
                            "id": f"modelperm-{model['model_id']}",
                            "object": "model_permission",
                            "created": int(time.mktime(datetime.fromisoformat(model["created_at"]).timetuple())) if model.get("created_at") else 0,
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
                    "root": model["model_id"],
                    "parent": None,
                    # Additional fields for the new model registry
                    "name": model.get("name", ""),
                    "description": model.get("description", ""),
                    "tier": model.get("tier", "Free"),
                    "max_images": model.get("max_images", 1),
                    "supports_i2i": model.get("supports_i2i", False),
                    "processing_type": model.get("processing_type", "Async"),
                    "max_wait_time": model.get("max_wait_time", "5 min"),
                    "capabilities": model.get("capabilities", {}),
                    "supported_sizes": model.get("supported_sizes", []),
                    "status": model.get("status", "active"),
                    "providers": provider_details
                })
    except Exception as e:
        logger.warning(f"Failed to load dynamic model registry models: {e}")

    # 2. Locally registered adapter models (fill in any gaps for backward compatibility)
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
async def get_model(
    model_id: str, 
    user: dict = Depends(get_authenticated_user)
):
    """
    Retrieve a single model by ID.

    Returns the model object in OpenAI-compatible format with full model registry details.
    """
    # Try new model registry first
    try:
        sb = DatabaseService.get_client()
        
        # Get model from database
        model_response = sb.table("models").select("*").eq("model_id", model_id).eq("status", "active").single().execute()
        model = model_response.data if model_response.data else None
        
        if model:
            # Get active providers for this model
            providers_response = sb.table("model_providers").select("*").eq("model_id", model["id"]).eq("status", "active").execute()
            providers = providers_response.data or []
            
            # Get provider details
            provider_details = []
            if providers:
                provider_ids = [p["provider_id"] for p in providers]
                provider_response = sb.table("providers").select("*").in_("id", provider_ids).execute()
                provider_dict = {p["id"]: p for p in provider_response.data or []}
                
                for mp in providers:
                    provider = provider_dict.get(mp["provider_id"])
                    if provider:
                        provider_details.append({
                            "provider_id": str(provider["id"]),
                            "provider_name": provider["name"],
                            "provider_model_id": mp["provider_model_id"],
                            "provider_cost": float(mp["provider_cost"]),
                            "platform_price": float(mp["platform_price"]),
                            "max_images_supported": mp["max_images_supported"],
                            "status": mp["status"]
                        })

            return {
                "id": model["model_id"],
                "object": "model",
                "created": int(time.mktime(datetime.fromisoformat(model["created_at"]).timetuple())) if model.get("created_at") else 0,
                "owned_by": "visuluxe",
                "permission": [
                    {
                        "id": f"modelperm-{model['model_id']}",
                        "object": "model_permission",
                        "created": int(time.mktime(datetime.fromisoformat(model["created_at"]).timetuple())) if model.get("created_at") else 0,
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
                "root": model["model_id"],
                "parent": None,
                # Additional fields for the new model registry
                "name": model.get("name", ""),
                "description": model.get("description", ""),
                "tier": model.get("tier", "Free"),
                "max_images": model.get("max_images", 1),
                "supports_i2i": model.get("supports_i2i", False),
                "processing_type": model.get("processing_type", "Async"),
                "max_wait_time": model.get("max_wait_time", "5 min"),
                "capabilities": model.get("capabilities", {}),
                "supported_sizes": model.get("supported_sizes", []),
                "status": model.get("status", "active"),
                "providers": provider_details
            }
    except Exception as e:
        logger.warning(f"Failed to load model from dynamic registry: {e}")

    # Check adapter registry for backward compatibility
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
