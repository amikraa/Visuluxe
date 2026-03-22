from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from ..services.database import DatabaseService
from ..models.schemas import ModelResponse

router = APIRouter(prefix="/models", tags=["models"])

# Public endpoints

@router.get("/", response_model=List[ModelResponse])
async def get_public_models(
    tier: Optional[str] = Query(None, description="Filter by tier"),
    status: Optional[str] = Query(None, description="Filter by status")
):
    """Get active models for public catalog"""
    try:
        sb = DatabaseService.get_client()
        
        # Get active models
        query = sb.table("models").select("*").eq("status", "active")
        
        if tier:
            query = query.eq("tier", tier)
        
        if status:
            query = query.eq("status", status)
        
        models_response = query.execute()
        models = models_response.data or []
        
        if not models:
            return []
        
        # Get provider mappings for each model
        model_ids = [m["id"] for m in models]
        provider_mappings_response = sb.table("model_providers").select("*").in_("model_id", model_ids).eq("status", "active").execute()
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
                        model_data.providers.append({
                            "id": str(mapping["id"]),
                            "provider_id": str(provider["id"]),
                            "provider_name": provider["name"],
                            "provider_model_id": mapping["provider_model_id"],
                            "provider_cost": float(mapping["provider_cost"]),
                            "platform_price": float(mapping["platform_price"]),
                            "max_images_supported": mapping["max_images_supported"],
                            "status": mapping["status"]
                        })
            
            result.append(model_data)
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch models: {str(e)}")

@router.get("/{model_id}", response_model=ModelResponse)
async def get_model_details(model_id: str):
    """Get model details with provider availability"""
    try:
        sb = DatabaseService.get_client()
        
        # Get model
        model_response = sb.table("models").select("*").eq("model_id", model_id).execute()
        
        if not model_response.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        model = model_response.data[0]
        
        if model["status"] != "active":
            raise HTTPException(status_code=400, detail="Model is not available")
        
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
        
        # Get active provider mappings
        provider_mappings_response = sb.table("model_providers").select("*").eq("model_id", model["id"]).eq("status", "active").execute()
        provider_mappings = provider_mappings_response.data or []
        
        # Get provider details
        provider_ids = [m["provider_id"] for m in provider_mappings]
        providers_response = sb.table("providers").select("*").in_("id", provider_ids).execute()
        providers = providers_response.data or []
        provider_dict = {p["id"]: p for p in providers}
        
        for mapping in provider_mappings:
            provider = provider_dict.get(mapping["provider_id"])
            if provider:
                model_data.providers.append({
                    "id": str(mapping["id"]),
                    "provider_id": str(provider["id"]),
                    "provider_name": provider["name"],
                    "provider_model_id": mapping["provider_model_id"],
                    "provider_cost": float(mapping["provider_cost"]),
                    "platform_price": float(mapping["platform_price"]),
                    "max_images_supported": mapping["max_images_supported"],
                    "status": mapping["status"]
                })
        
        return model_data
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch model details: {str(e)}")
