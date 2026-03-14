"""
GET /v1/models
GET /v1/models/{model_id}

OpenAI-compatible model listing endpoint. Returns models in the exact
format expected by OpenAI SDKs, using the new dynamic model registry.
"""
import time
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.security import get_authenticated_user
from app.adapters.registry import list_supported_models
from app.models.models import Model, ModelProvider, Provider
from app.database import get_db
from app.errors import NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def list_models(
    user: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
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
        # Get active models with their providers
        db_models = db.query(Model).filter(Model.status == 'active').all()
        
        for model in db_models:
            if model.model_id not in seen_ids:
                seen_ids.add(model.model_id)
                
                # Get active providers for this model
                providers = db.query(ModelProvider).filter(
                    and_(
                        ModelProvider.model_id == model.id,
                        ModelProvider.status == 'active'
                    )
                ).all()
                
                # Get provider details
                provider_details = []
                for mp in providers:
                    provider = db.query(Provider).filter(Provider.id == mp.provider_id).first()
                    if provider:
                        provider_details.append({
                            "provider_id": str(provider.id),
                            "provider_name": provider.name,
                            "provider_model_id": mp.provider_model_id,
                            "provider_cost": float(mp.provider_cost),
                            "platform_price": float(mp.platform_price),
                            "max_images_supported": mp.max_images_supported,
                            "status": mp.status
                        })

                models.append({
                    "id": model.model_id,
                    "object": "model",
                    "created": int(time.mktime(model.created_at.timetuple())) if model.created_at else 0,
                    "owned_by": "visuluxe",
                    "permission": [
                        {
                            "id": f"modelperm-{model.model_id}",
                            "object": "model_permission",
                            "created": int(time.mktime(model.created_at.timetuple())) if model.created_at else 0,
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
                    "root": model.model_id,
                    "parent": None,
                    # Additional fields for the new model registry
                    "name": model.name,
                    "description": model.description,
                    "tier": model.tier,
                    "max_images": model.max_images,
                    "supports_i2i": model.supports_i2i,
                    "processing_type": model.processing_type,
                    "max_wait_time": model.max_wait_time,
                    "capabilities": model.capabilities or {},
                    "supported_sizes": model.supported_sizes or [],
                    "status": model.status,
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
    user: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve a single model by ID.

    Returns the model object in OpenAI-compatible format with full model registry details.
    """
    # Try new model registry first
    try:
        model = db.query(Model).filter(
            and_(
                Model.model_id == model_id,
                Model.status == 'active'
            )
        ).first()
        
        if model:
            # Get active providers for this model
            providers = db.query(ModelProvider).filter(
                and_(
                    ModelProvider.model_id == model.id,
                    ModelProvider.status == 'active'
                )
            ).all()
            
            # Get provider details
            provider_details = []
            for mp in providers:
                provider = db.query(Provider).filter(Provider.id == mp.provider_id).first()
                if provider:
                    provider_details.append({
                        "provider_id": str(provider.id),
                        "provider_name": provider.name,
                        "provider_model_id": mp.provider_model_id,
                        "provider_cost": float(mp.provider_cost),
                        "platform_price": float(mp.platform_price),
                        "max_images_supported": mp.max_images_supported,
                        "status": mp.status
                    })

            return {
                "id": model.model_id,
                "object": "model",
                "created": int(time.mktime(model.created_at.timetuple())) if model.created_at else 0,
                "owned_by": "visuluxe",
                "permission": [
                    {
                        "id": f"modelperm-{model.model_id}",
                        "object": "model_permission",
                        "created": int(time.mktime(model.created_at.timetuple())) if model.created_at else 0,
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
                "root": model.model_id,
                "parent": None,
                # Additional fields for the new model registry
                "name": model.name,
                "description": model.description,
                "tier": model.tier,
                "max_images": model.max_images,
                "supports_i2i": model.supports_i2i,
                "processing_type": model.processing_type,
                "max_wait_time": model.max_wait_time,
                "capabilities": model.capabilities or {},
                "supported_sizes": model.supported_sizes or [],
                "status": model.status,
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
