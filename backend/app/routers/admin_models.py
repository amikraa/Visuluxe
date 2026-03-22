from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from typing import List, Optional
from datetime import datetime, date, timedelta

from ..services.database import DatabaseService
from ..models.schemas import (
    ModelResponse, ModelCreate, ModelUpdate, ModelStatusUpdate,
    ModelProviderResponse, ModelProviderCreate, ModelProviderUpdate,
    ModelAnalyticsResponse, ModelAnalyticsQuery
)
from ..security import get_current_user, get_current_admin

router = APIRouter(prefix="/admin/models", tags=["admin-models"])

# Admin endpoints for model management

@router.get("/", response_model=List[ModelResponse])
async def get_all_models(
    status: Optional[str] = Query(None, description="Filter by status"),
    tier: Optional[str] = Query(None, description="Filter by tier"),
    current_user: dict = Depends(get_current_admin)
):
    """Get all models for admin management"""
    try:
        sb = DatabaseService.get_client()
        
        # Get all models
        query = sb.table("models").select("*")
        
        if status:
            query = query.eq("status", status)
        
        if tier:
            query = query.eq("tier", tier)
        
        models_response = query.execute()
        models = models_response.data or []
        
        if not models:
            return []
        
        # Get provider mappings for each model
        model_ids = [m["id"] for m in models]
        provider_mappings_response = sb.table("model_providers").select("*").in_("model_id", model_ids).execute()
        provider_mappings = provider_mappings_response.data or []
        
        # Group provider mappings by model
        provider_map = {}
        for mapping in provider_mappings:
            if mapping["model_id"] not in provider_map:
                provider_map[mapping["model_id"]] = []
            provider_map[mapping["model_id"]].append(mapping)
        
        # Get provider details
        provider_ids = list(set([m["provider_id"] for m in provider_mappings]))
        providers_response = sb.table("providers").select("*").in_("id", provider_ids).execute()
        providers = providers_response.data or []
        provider_dict = {p["id"]: p for p in providers}
        
        # Build response
        result = []
        for model in models:
            model_data = ModelResponse(
                id=str(model["id"]),
                name=model["name"],
                model_id=model["model_id"],
                description=model.get("description", ""),
                tier=model.get("tier", "Free"),
                max_images=model.get("max_images", 1),
                supports_i2i=model.get("supports_i2i", False),
                processing_type=model.get("processing_type", "Async"),
                max_wait_time=model.get("max_wait_time", "5 min"),
                capabilities=model.get("capabilities", {}),
                supported_sizes=model.get("supported_sizes", []),
                status=model.get("status", "active"),
                providers=[]
            )
            
            if model["id"] in provider_map:
                for mapping in provider_map[model["id"]]:
                    provider = provider_dict.get(mapping["provider_id"])
                    if provider:
                        model_data.providers.append(ModelProviderResponse(
                            id=str(mapping["id"]),
                            provider_id=str(provider["id"]),
                            provider_name=provider["name"],
                            provider_model_id=mapping["provider_model_id"],
                            provider_cost=float(mapping["provider_cost"]),
                            platform_price=float(mapping["platform_price"]),
                            max_images_supported=mapping["max_images_supported"],
                            status=mapping["status"]
                        ))
            
            result.append(model_data)
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch models: {str(e)}")

@router.post("/", response_model=ModelResponse)
async def create_model(
    model_data: ModelCreate,
    current_user: dict = Depends(get_current_admin)
):
    """Create new model"""
    try:
        sb = DatabaseService.get_client()
        
        # Check if model_id already exists
        existing_response = sb.table("models").select("*").eq("model_id", model_data.model_id).execute()
        if existing_response.data:
            raise HTTPException(status_code=400, detail="Model ID already exists")
        
        model = {
            "name": model_data.name,
            "model_id": model_data.model_id,
            "description": model_data.description,
            "tier": model_data.tier,
            "max_images": model_data.max_images,
            "supports_i2i": model_data.supports_i2i,
            "processing_type": model_data.processing_type,
            "max_wait_time": model_data.max_wait_time,
            "capabilities": model_data.capabilities,
            "supported_sizes": model_data.supported_sizes
        }
        
        response = sb.table("models").insert(model).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create model")
        
        created_model = response.data[0]
        
        return ModelResponse(
            id=str(created_model["id"]),
            name=created_model["name"],
            model_id=created_model["model_id"],
            description=created_model.get("description", ""),
            tier=created_model.get("tier", "Free"),
            max_images=created_model.get("max_images", 1),
            supports_i2i=created_model.get("supports_i2i", False),
            processing_type=created_model.get("processing_type", "Async"),
            max_wait_time=created_model.get("max_wait_time", "5 min"),
            capabilities=created_model.get("capabilities", {}),
            supported_sizes=created_model.get("supported_sizes", []),
            status=created_model.get("status", "active"),
            providers=[]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create model: {str(e)}")

@router.put("/{model_id}", response_model=ModelResponse)
async def update_model(
    model_id: str,
    model_data: ModelUpdate,
    current_user: dict = Depends(get_current_admin)
):
    """Update model"""
    try:
        sb = DatabaseService.get_client()
        
        # Check if model exists
        model_response = sb.table("models").select("*").eq("model_id", model_id).execute()
        if not model_response.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        model = model_response.data[0]
        
        # Check if model_id is being changed and already exists
        if model_data.model_id and model_data.model_id != model_id:
            existing_response = sb.table("models").select("*").eq("model_id", model_data.model_id).execute()
            if existing_response.data:
                raise HTTPException(status_code=400, detail="Model ID already exists")
        
        update_data = {}
        if model_data.name is not None:
            update_data["name"] = model_data.name
        if model_data.model_id is not None:
            update_data["model_id"] = model_data.model_id
        if model_data.description is not None:
            update_data["description"] = model_data.description
        if model_data.tier is not None:
            update_data["tier"] = model_data.tier
        if model_data.max_images is not None:
            update_data["max_images"] = model_data.max_images
        if model_data.supports_i2i is not None:
            update_data["supports_i2i"] = model_data.supports_i2i
        if model_data.processing_type is not None:
            update_data["processing_type"] = model_data.processing_type
        if model_data.max_wait_time is not None:
            update_data["max_wait_time"] = model_data.max_wait_time
        if model_data.capabilities is not None:
            update_data["capabilities"] = model_data.capabilities
        if model_data.supported_sizes is not None:
            update_data["supported_sizes"] = model_data.supported_sizes
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        response = sb.table("models").update(update_data).eq("model_id", model_id).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update model")
        
        updated_model = response.data[0]
        
        return ModelResponse(
            id=str(updated_model["id"]),
            name=updated_model["name"],
            model_id=updated_model["model_id"],
            description=updated_model.get("description", ""),
            tier=updated_model.get("tier", "Free"),
            max_images=updated_model.get("max_images", 1),
            supports_i2i=updated_model.get("supports_i2i", False),
            processing_type=updated_model.get("processing_type", "Async"),
            max_wait_time=updated_model.get("max_wait_time", "5 min"),
            capabilities=updated_model.get("capabilities", {}),
            supported_sizes=updated_model.get("supported_sizes", []),
            status=updated_model.get("status", "active"),
            providers=[]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update model: {str(e)}")

@router.delete("/{model_id}")
async def delete_model(
    model_id: str,
    current_user: dict = Depends(get_current_admin)
):
    """Soft delete model (set status to disabled)"""
    try:
        sb = DatabaseService.get_client()
        
        # Check if model exists
        model_response = sb.table("models").select("*").eq("model_id", model_id).execute()
        if not model_response.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        model = model_response.data[0]
        
        # Check if model has any generation history
        job_response = sb.table("generation_jobs").select("*").eq("model_name", model_id).limit(1).execute()
        
        if job_response.data:
            # Soft delete - set status to disabled
            sb.table("models").update({"status": "disabled"}).eq("model_id", model_id).execute()
        else:
            # Hard delete - remove from database
            sb.table("models").delete().eq("model_id", model_id).execute()
        
        return {"message": "Model deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete model: {str(e)}")

@router.put("/{model_id}/status")
async def update_model_status(
    model_id: str,
    status_data: ModelStatusUpdate,
    current_user: dict = Depends(get_current_admin)
):
    """Update model status"""
    try:
        sb = DatabaseService.get_client()
        
        # Check if model exists
        model_response = sb.table("models").select("*").eq("model_id", model_id).execute()
        if not model_response.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        if status_data.status not in ['active', 'maintenance', 'disabled']:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        sb.table("models").update({"status": status_data.status}).eq("model_id", model_id).execute()
        
        return {"message": f"Model status updated to {status_data.status}"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update model status: {str(e)}")

# Model Provider Management

@router.get("/{model_id}/providers", response_model=List[ModelProviderResponse])
async def get_model_providers(
    model_id: str,
    current_user: dict = Depends(get_current_admin)
):
    """Get all providers for a model"""
    try:
        sb = DatabaseService.get_client()
        
        # Check if model exists
        model_response = sb.table("models").select("*").eq("model_id", model_id).execute()
        if not model_response.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        model = model_response.data[0]
        
        # Get provider mappings
        provider_mappings_response = sb.table("model_providers").select("*").eq("model_id", model["id"]).execute()
        provider_mappings = provider_mappings_response.data or []
        
        # Get provider details
        provider_ids = [m["provider_id"] for m in provider_mappings]
        providers_response = sb.table("providers").select("*").in_("id", provider_ids).execute()
        providers = providers_response.data or []
        provider_dict = {p["id"]: p for p in providers}
        
        result = []
        for mapping in provider_mappings:
            provider = provider_dict.get(mapping["provider_id"])
            if provider:
                result.append(ModelProviderResponse(
                    id=str(mapping["id"]),
                    provider_id=str(provider["id"]),
                    provider_name=provider["name"],
                    provider_model_id=mapping["provider_model_id"],
                    provider_cost=float(mapping["provider_cost"]),
                    platform_price=float(mapping["platform_price"]),
                    max_images_supported=mapping["max_images_supported"],
                    status=mapping["status"]
                ))
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch model providers: {str(e)}")

@router.post("/{model_id}/providers", response_model=ModelProviderResponse)
async def add_provider_to_model(
    model_id: str,
    provider_data: ModelProviderCreate,
    current_user: dict = Depends(get_current_admin)
):
    """Add provider to model"""
    try:
        sb = DatabaseService.get_client()
        
        # Check if model exists
        model_response = sb.table("models").select("*").eq("model_id", model_id).execute()
        if not model_response.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        model = model_response.data[0]
        
        # Check if provider exists
        provider_response = sb.table("providers").select("*").eq("id", provider_data.provider_id).execute()
        if not provider_response.data:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        provider = provider_response.data[0]
        
        # Check if provider already assigned to this model
        existing_response = sb.table("model_providers").select("*").eq("model_id", model["id"]).eq("provider_id", provider["id"]).execute()
        if existing_response.data:
            raise HTTPException(status_code=400, detail="Provider already assigned to this model")
        
        mapping = {
            "model_id": model["id"],
            "provider_id": provider["id"],
            "provider_model_id": provider_data.provider_model_id,
            "provider_cost": float(provider_data.provider_cost),
            "platform_price": float(provider_data.platform_price),
            "max_images_supported": provider_data.max_images_supported
        }
        
        response = sb.table("model_providers").insert(mapping).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to add provider to model")
        
        created_mapping = response.data[0]
        
        return ModelProviderResponse(
            id=str(created_mapping["id"]),
            provider_id=str(provider["id"]),
            provider_name=provider["name"],
            provider_model_id=created_mapping["provider_model_id"],
            provider_cost=float(created_mapping["provider_cost"]),
            platform_price=float(created_mapping["platform_price"]),
            max_images_supported=created_mapping["max_images_supported"],
            status=created_mapping["status"]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add provider to model: {str(e)}")

@router.put("/{model_id}/providers/{provider_id}", response_model=ModelProviderResponse)
async def update_provider_mapping(
    model_id: str,
    provider_id: str,
    provider_data: ModelProviderUpdate,
    current_user: dict = Depends(get_current_admin)
):
    """Update provider mapping for model"""
    try:
        sb = DatabaseService.get_client()
        
        # Check if model exists
        model_response = sb.table("models").select("*").eq("model_id", model_id).execute()
        if not model_response.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        model = model_response.data[0]
        
        # Check if provider exists
        provider_response = sb.table("providers").select("*").eq("id", provider_id).execute()
        if not provider_response.data:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        provider = provider_response.data[0]
        
        # Check if mapping exists
        mapping_response = sb.table("model_providers").select("*").eq("model_id", model["id"]).eq("provider_id", provider["id"]).execute()
        if not mapping_response.data:
            raise HTTPException(status_code=404, detail="Provider mapping not found")
        
        mapping = mapping_response.data[0]
        
        update_data = {}
        if provider_data.provider_model_id is not None:
            update_data["provider_model_id"] = provider_data.provider_model_id
        if provider_data.provider_cost is not None:
            update_data["provider_cost"] = float(provider_data.provider_cost)
        if provider_data.platform_price is not None:
            update_data["platform_price"] = float(provider_data.platform_price)
        if provider_data.max_images_supported is not None:
            update_data["max_images_supported"] = provider_data.max_images_supported
        if provider_data.status is not None:
            update_data["status"] = provider_data.status
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        response = sb.table("model_providers").update(update_data).eq("id", mapping["id"]).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update provider mapping")
        
        updated_mapping = response.data[0]
        
        return ModelProviderResponse(
            id=str(updated_mapping["id"]),
            provider_id=str(provider["id"]),
            provider_name=provider["name"],
            provider_model_id=updated_mapping["provider_model_id"],
            provider_cost=float(updated_mapping["provider_cost"]),
            platform_price=float(updated_mapping["platform_price"]),
            max_images_supported=updated_mapping["max_images_supported"],
            status=updated_mapping["status"]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update provider mapping: {str(e)}")

@router.delete("/{model_id}/providers/{provider_id}")
async def remove_provider_from_model(
    model_id: str,
    provider_id: str,
    current_user: dict = Depends(get_current_admin)
):
    """Remove provider from model"""
    try:
        sb = DatabaseService.get_client()
        
        # Check if model exists
        model_response = sb.table("models").select("*").eq("model_id", model_id).execute()
        if not model_response.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        model = model_response.data[0]
        
        # Check if provider exists
        provider_response = sb.table("providers").select("*").eq("id", provider_id).execute()
        if not provider_response.data:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        provider = provider_response.data[0]
        
        # Check if mapping exists
        mapping_response = sb.table("model_providers").select("*").eq("model_id", model["id"]).eq("provider_id", provider["id"]).execute()
        if not mapping_response.data:
            raise HTTPException(status_code=404, detail="Provider mapping not found")
        
        mapping = mapping_response.data[0]
        
        sb.table("model_providers").delete().eq("id", mapping["id"]).execute()
        
        return {"message": "Provider removed from model successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove provider from model: {str(e)}")

# Model Analytics

@router.get("/analytics/", response_model=List[ModelAnalyticsResponse])
async def get_model_analytics(
    query: ModelAnalyticsQuery = Depends(),
    current_user: dict = Depends(get_current_admin)
):
    """Get model analytics"""
    try:
        sb = DatabaseService.get_client()
        
        query_filter = sb.table("model_analytics").select("*")
        
        if query.start_date:
            query_filter = query_filter.gte("date", query.start_date)
        
        if query.end_date:
            query_filter = query_filter.lte("date", query.end_date)
        
        if query.model_id:
            # Get model UUID from model_id
            model_response = sb.table("models").select("id").eq("model_id", query.model_id).execute()
            if model_response.data:
                model_uuid = model_response.data[0]["id"]
                query_filter = query_filter.eq("model_id", model_uuid)
        
        analytics_response = query_filter.execute()
        analytics = analytics_response.data or []
        
        if not analytics:
            return []
        
        # Get model details
        model_ids = [a["model_id"] for a in analytics]
        models_response = sb.table("models").select("id, name, model_id").in_("id", model_ids).execute()
        models = models_response.data or []
        model_dict = {m["id"]: m for m in models}
        
        result = []
        for analytic in analytics:
            model = model_dict.get(analytic["model_id"])
            if model:
                result.append(ModelAnalyticsResponse(
                    model_id=model["model_id"],
                    model_name=model["name"],
                    date=analytic["date"],
                    total_generations=analytic["total_generations"],
                    total_revenue=float(analytic["total_revenue"]),
                    total_provider_cost=float(analytic["total_provider_cost"]),
                    profit=float(analytic["profit"])
                ))
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch model analytics: {str(e)}")

@router.get("/analytics/{model_id}", response_model=ModelAnalyticsResponse)
async def get_model_analytics_details(
    model_id: str,
    query: ModelAnalyticsQuery = Depends(),
    current_user: dict = Depends(get_current_admin)
):
    """Get detailed analytics for a specific model"""
    try:
        sb = DatabaseService.get_client()
        
        # Check if model exists
        model_response = sb.table("models").select("*").eq("model_id", model_id).execute()
        if not model_response.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        model = model_response.data[0]
        
        query_filter = sb.table("model_analytics").select("*").eq("model_id", model["id"])
        
        if query.start_date:
            query_filter = query_filter.gte("date", query.start_date)
        
        if query.end_date:
            query_filter = query_filter.lte("date", query.end_date)
        
        analytics_response = query_filter.execute()
        analytics = analytics_response.data or []
        
        if not analytics:
            return ModelAnalyticsResponse(
                model_id=model["model_id"],
                model_name=model["name"],
                date=date.today().isoformat(),
                total_generations=0,
                total_revenue=0,
                total_provider_cost=0,
                profit=0
            )
        
        # Get the most recent analytics
        latest_analytics = analytics[0]
        
        return ModelAnalyticsResponse(
            model_id=model["model_id"],
            model_name=model["name"],
            date=latest_analytics["date"],
            total_generations=latest_analytics["total_generations"],
            total_revenue=float(latest_analytics["total_revenue"]),
            total_provider_cost=float(latest_analytics["total_provider_cost"]),
            profit=float(latest_analytics["profit"])
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch model analytics details: {str(e)}")