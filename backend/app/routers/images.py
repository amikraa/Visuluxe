from fastapi import APIRouter, Depends, HTTPException
from app.models.schemas import ImageGenerationRequest, ImageGenerationResponse, ImageJobStatusResponse
from app.security import get_authenticated_user
from app.services.queue import QueueService
from app.services.credit import CreditService

router = APIRouter()

@router.post("/generations", response_model=ImageGenerationResponse)
async def create_image_generation(request: ImageGenerationRequest, user: dict = Depends(get_authenticated_user)):
    user_id = user["user_id"]
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
    
    credit_check = await CreditService.check_and_reserve_credits(user_id=user_id, amount=request.n)
    if not credit_check["success"]:
        raise HTTPException(status_code=402, detail={"error": "Insufficient credits", "required": request.n})
    
    job_data = {"user_id": user_id, "prompt": request.prompt, "negative_prompt": request.negative_prompt, "model": request.model or "flux-dev", "size": request.size or "1024x1024", "n": request.n}
    job_id = await QueueService.enqueue_job(job_data)
    return ImageGenerationResponse(created=True, job_id=job_id, status="pending")

@router.get("/jobs/{job_id}", response_model=ImageJobStatusResponse)
async def get_job_status(job_id: str, user: dict = Depends(get_authenticated_user)):
    status = await QueueService.get_job_status(job_id)
    if status.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Job not found")
    return ImageJobStatusResponse(job_id=job_id, status=status["status"], result=status.get("result"), error=status.get("error"))