# Routers package
from app.routers.auth import router as auth_router
from app.routers.images import router as images_router
from app.routers.models import router as models_router

__all__ = ["auth_router", "images_router", "models_router"]
