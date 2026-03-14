from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from ..models.schemas import ModelResponse
from ..models.models import Model, ModelProvider, Provider

router = APIRouter(prefix="/models", tags=["models"])

# Public endpoints

@router.get("/", response_model=List[ModelResponse])
async def get_public_models(
    tier: Optional[str] = Query(None, description="Filter by tier"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db)
):
    """Get active models for public catalog"""
    query = db.query(Model).filter(Model.status == 'active')
    
    if tier:
        query = query.filter(Model.tier == tier)
    
    if status:
        query = query.filter(Model.status == status)
    
    models = query.all()
    
    # Get provider mappings for each model
    model_ids = [m.id for m in models]
    provider_mappings = db.query(ModelProvider).filter(
        ModelProvider.model_id.in_(model_ids),
        ModelProvider.status == 'active'
    ).all()
    
    # Group provider mappings by model
    provider_map = {}
    for mapping in provider_mappings:
        if mapping.model_id not in provider_map:
            provider_map[mapping.model_id] = []
        provider_map[mapping.model_id].append(mapping)
    
    # Get provider details
    provider_ids = list(set([m.provider_id for m in provider_mappings]))
    providers = db.query(Provider).filter(Provider.id.in_(provider_ids)).all()
    provider_dict = {p.id: p for p in providers}
    
    # Build response
    result = []
    for model in models:
        model_data = ModelResponse.from_orm(model)
        model_data.providers = []
        
        if model.id in provider_map:
            for mapping in provider_map[model.id]:
                provider = provider_dict.get(mapping.provider_id)
                if provider:
                    model_data.providers.append({
                        "id": str(mapping.id),
                        "provider_id": str(provider.id),
                        "provider_name": provider.name,
                        "provider_model_id": mapping.provider_model_id,
                        "provider_cost": float(mapping.provider_cost),
                        "platform_price": float(mapping.platform_price),
                        "max_images_supported": mapping.max_images_supported,
                        "status": mapping.status
                    })
        
        result.append(model_data)
    
    return result

@router.get("/{model_id}", response_model=ModelResponse)
async def get_model_details(
    model_id: str,
    db: Session = Depends(get_db)
):
    """Get model details with provider availability"""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    if model.status != 'active':
        raise HTTPException(status_code=400, detail="Model is not available")
    
    model_data = ModelResponse.from_orm(model)
    model_data.providers = []
    
    # Get active provider mappings
    provider_mappings = db.query(ModelProvider).filter(
        ModelProvider.model_id == model.id,
        ModelProvider.status == 'active'
    ).all()
    
    # Get provider details
    provider_ids = [m.provider_id for m in provider_mappings]
    providers = db.query(Provider).filter(Provider.id.in_(provider_ids)).all()
    provider_dict = {p.id: p for p in providers}
    
    for mapping in provider_mappings:
        provider = provider_dict.get(mapping.provider_id)
        if provider:
            model_data.providers.append({
                "id": str(mapping.id),
                "provider_id": str(provider.id),
                "provider_name": provider.name,
                "provider_model_id": mapping.provider_model_id,
                "provider_cost": float(mapping.provider_cost),
                "platform_price": float(mapping.platform_price),
                "max_images_supported": mapping.max_images_supported,
                "status": mapping.status
            })
    
    return model_data