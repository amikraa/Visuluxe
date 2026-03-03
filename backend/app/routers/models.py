from fastapi import APIRouter, Depends, HTTPException
from app.security import get_current_user
from app.services.provider import ProviderService

router = APIRouter()

@router.get("/")
async def list_models(user: dict = Depends(get_current_user)):
    models = await ProviderService.get_available_models(user.get("user_id"))
    return {"object": "list", "data": [{"id": m["id"], "object": "model", "created": 0, "owned_by": "visuluxe", "root": m["id"]} for m in models]}

@router.get("/{model_id}")
async def get_model(model_id: str, user: dict = Depends(get_current_user)):
    model = await ProviderService.get_model_info(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"id": model["id"], "name": model["name"], "description": model.get("description")}