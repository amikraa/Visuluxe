from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, date, timedelta

from ..database import get_db
from ..models.schemas import (
    ModelResponse, ModelCreate, ModelUpdate, ModelStatusUpdate,
    ModelProviderResponse, ModelProviderCreate, ModelProviderUpdate,
    ModelAnalyticsResponse, ModelAnalyticsQuery
)
from ..models.models import Model, ModelProvider, ModelAnalytics, Provider
from ..security import get_current_user, get_current_admin
from ..models.schemas import User as UserModel

router = APIRouter(prefix="/admin/models", tags=["admin-models"])

# Admin endpoints for model management

@router.get("/", response_model=List[ModelResponse])
async def get_all_models(
    status: Optional[str] = Query(None, description="Filter by status"),
    tier: Optional[str] = Query(None, description="Filter by tier"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin)
):
    """Get all models for admin management"""
    query = db.query(Model)
    
    if status:
        query = query.filter(Model.status == status)
    
    if tier:
        query = query.filter(Model.tier == tier)
    
    models = query.all()
    
    # Get provider mappings for each model
    model_ids = [m.id for m in models]
    provider_mappings = db.query(ModelProvider).filter(
        ModelProvider.model_id.in_(model_ids)
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
                    model_data.providers.append(ModelProviderResponse(
                        id=mapping.id,
                        provider_id=provider.id,
                        provider_name=provider.name,
                        provider_model_id=mapping.provider_model_id,
                        provider_cost=mapping.provider_cost,
                        platform_price=mapping.platform_price,
                        max_images_supported=mapping.max_images_supported,
                        status=mapping.status
                    ))
        
        result.append(model_data)
    
    return result

@router.post("/", response_model=ModelResponse)
async def create_model(
    model_data: ModelCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin)
):
    """Create new model"""
    # Check if model_id already exists
    existing = db.query(Model).filter(Model.model_id == model_data.model_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Model ID already exists")
    
    model = Model(
        name=model_data.name,
        model_id=model_data.model_id,
        description=model_data.description,
        tier=model_data.tier,
        max_images=model_data.max_images,
        supports_i2i=model_data.supports_i2i,
        processing_type=model_data.processing_type,
        max_wait_time=model_data.max_wait_time,
        capabilities=model_data.capabilities,
        supported_sizes=model_data.supported_sizes
    )
    
    db.add(model)
    db.commit()
    db.refresh(model)
    
    return ModelResponse.from_orm(model)

@router.put("/{model_id}", response_model=ModelResponse)
async def update_model(
    model_id: str,
    model_data: ModelUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin)
):
    """Update model"""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Check if model_id is being changed and already exists
    if model_data.model_id and model_data.model_id != model.model_id:
        existing = db.query(Model).filter(Model.model_id == model_data.model_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Model ID already exists")
    
    update_data = model_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(model, field, value)
    
    db.commit()
    db.refresh(model)
    
    return ModelResponse.from_orm(model)

@router.delete("/{model_id}")
async def delete_model(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin)
):
    """Soft delete model (set status to disabled)"""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Check if model has any generation history
    from ..models.models import GenerationJob
    has_history = db.query(GenerationJob).filter(GenerationJob.model_id == model_id).first()
    
    if has_history:
        # Soft delete - set status to disabled
        model.status = 'disabled'
    else:
        # Hard delete - remove from database
        db.delete(model)
    
    db.commit()
    return {"message": "Model deleted successfully"}

@router.put("/{model_id}/status")
async def update_model_status(
    model_id: str,
    status_data: ModelStatusUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin)
):
    """Update model status"""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    if status_data.status not in ['active', 'maintenance', 'disabled']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    model.status = status_data.status
    db.commit()
    
    return {"message": f"Model status updated to {status_data.status}"}

# Model Provider Management

@router.get("/{model_id}/providers", response_model=List[ModelProviderResponse])
async def get_model_providers(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin)
):
    """Get all providers for a model"""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    provider_mappings = db.query(ModelProvider).filter(
        ModelProvider.model_id == model.id
    ).all()
    
    # Get provider details
    provider_ids = [m.provider_id for m in provider_mappings]
    providers = db.query(Provider).filter(Provider.id.in_(provider_ids)).all()
    provider_dict = {p.id: p for p in providers}
    
    result = []
    for mapping in provider_mappings:
        provider = provider_dict.get(mapping.provider_id)
        if provider:
            result.append(ModelProviderResponse(
                id=mapping.id,
                provider_id=provider.id,
                provider_name=provider.name,
                provider_model_id=mapping.provider_model_id,
                provider_cost=mapping.provider_cost,
                platform_price=mapping.platform_price,
                max_images_supported=mapping.max_images_supported,
                status=mapping.status
            ))
    
    return result

@router.post("/{model_id}/providers", response_model=ModelProviderResponse)
async def add_provider_to_model(
    model_id: str,
    provider_data: ModelProviderCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin)
):
    """Add provider to model"""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    provider = db.query(Provider).filter(Provider.id == provider_data.provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Check if provider already assigned to this model
    existing = db.query(ModelProvider).filter(
        ModelProvider.model_id == model.id,
        ModelProvider.provider_id == provider.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Provider already assigned to this model")
    
    mapping = ModelProvider(
        model_id=model.id,
        provider_id=provider.id,
        provider_model_id=provider_data.provider_model_id,
        provider_cost=provider_data.provider_cost,
        platform_price=provider_data.platform_price,
        max_images_supported=provider_data.max_images_supported
    )
    
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    
    return ModelProviderResponse(
        id=mapping.id,
        provider_id=provider.id,
        provider_name=provider.name,
        provider_model_id=mapping.provider_model_id,
        provider_cost=mapping.provider_cost,
        platform_price=mapping.platform_price,
        max_images_supported=mapping.max_images_supported,
        status=mapping.status
    )

@router.put("/{model_id}/providers/{provider_id}", response_model=ModelProviderResponse)
async def update_provider_mapping(
    model_id: str,
    provider_id: str,
    provider_data: ModelProviderUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin)
):
    """Update provider mapping for model"""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    mapping = db.query(ModelProvider).filter(
        ModelProvider.model_id == model.id,
        ModelProvider.provider_id == provider.id
    ).first()
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Provider mapping not found")
    
    update_data = provider_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(mapping, field, value)
    
    db.commit()
    db.refresh(mapping)
    
    return ModelProviderResponse(
        id=mapping.id,
        provider_id=provider.id,
        provider_name=provider.name,
        provider_model_id=mapping.provider_model_id,
        provider_cost=mapping.provider_cost,
        platform_price=mapping.platform_price,
        max_images_supported=mapping.max_images_supported,
        status=mapping.status
    )

@router.delete("/{model_id}/providers/{provider_id}")
async def remove_provider_from_model(
    model_id: str,
    provider_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin)
):
    """Remove provider from model"""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    mapping = db.query(ModelProvider).filter(
        ModelProvider.model_id == model.id,
        ModelProvider.provider_id == provider.id
    ).first()
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Provider mapping not found")
    
    db.delete(mapping)
    db.commit()
    
    return {"message": "Provider removed from model successfully"}

# Model Analytics

@router.get("/analytics/", response_model=List[ModelAnalyticsResponse])
async def get_model_analytics(
    query: ModelAnalyticsQuery = Depends(),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin)
):
    """Get model analytics"""
    query_filter = db.query(ModelAnalytics)
    
    if query.start_date:
        query_filter = query_filter.filter(ModelAnalytics.date >= query.start_date)
    
    if query.end_date:
        query_filter = query_filter.filter(ModelAnalytics.date <= query.end_date)
    
    if query.model_id:
        query_filter = query_filter.filter(ModelAnalytics.model_id == query.model_id)
    
    analytics = query_filter.all()
    
    # Get model details
    model_ids = [a.model_id for a in analytics]
    models = db.query(Model).filter(Model.id.in_(model_ids)).all()
    model_dict = {m.id: m for m in models}
    
    result = []
    for analytic in analytics:
        model = model_dict.get(analytic.model_id)
        if model:
            result.append(ModelAnalyticsResponse(
                model_id=model.model_id,
                model_name=model.name,
                date=analytic.date,
                total_generations=analytic.total_generations,
                total_revenue=analytic.total_revenue,
                total_provider_cost=analytic.total_provider_cost,
                profit=analytic.profit
            ))
    
    return result

@router.get("/analytics/{model_id}", response_model=ModelAnalyticsResponse)
async def get_model_analytics_details(
    model_id: str,
    query: ModelAnalyticsQuery = Depends(),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin)
):
    """Get detailed analytics for a specific model"""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    query_filter = db.query(ModelAnalytics).filter(ModelAnalytics.model_id == model.id)
    
    if query.start_date:
        query_filter = query_filter.filter(ModelAnalytics.date >= query.start_date)
    
    if query.end_date:
        query_filter = query_filter.filter(ModelAnalytics.date <= query.end_date)
    
    analytics = query_filter.first()
    
    if not analytics:
        return ModelAnalyticsResponse(
            model_id=model.model_id,
            model_name=model.name,
            date=date.today(),
            total_generations=0,
            total_revenue=0,
            total_provider_cost=0,
            profit=0
        )
    
    return ModelAnalyticsResponse(
        model_id=model.model_id,
        model_name=model.name,
        date=analytics.date.isoformat(),
        total_generations=analytics.total_generations,
        total_revenue=analytics.total_revenue,
        total_provider_cost=analytics.total_provider_cost,
        profit=analytics.profit
    )
