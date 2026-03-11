"""
Provider Service
Handles model and provider routing
"""
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class ProviderService:
    @classmethod
    def get_client(cls):
        from app.security import get_supabase
        return get_supabase()
    
    @classmethod
    async def get_available_models(cls, user_id: str) -> List[Dict[str, Any]]:
        sb = cls.get_client()
        profile_response = sb.table("profiles").select("plan_type, account_type").eq("user_id", user_id).single().execute()
        account_type = profile_response.data.get("account_type", "normal") if profile_response.data else "normal"
        
        if account_type == "partner":
            response = sb.table("ai_models").select("*").eq("status", "active").execute()
        elif account_type == "admin":
            response = sb.table("ai_models").select("*").execute()
        else:
            response = sb.table("ai_models").select("*").eq("status", "active").eq("access_level", "public").execute()
        
        return response.data or []
    
    @classmethod
    async def get_model_info(cls, model_id: str) -> Optional[Dict[str, Any]]:
        sb = cls.get_client()
        response = sb.table("ai_models").select("*, providers(*)").eq("id", model_id).single().execute()
        return response.data
    
    @classmethod
    async def get_system_settings(cls) -> Dict[str, Any]:
        sb = cls.get_client()
        response = sb.table("system_settings").select("key, value").execute()
        settings = {}
        for item in response.data or []:
            key = item["key"]
            value = item["value"]
            if value in ("true", "false"):
                value = value == "true"
            elif isinstance(value, str) and value.isdigit():
                value = int(value)
            settings[key] = value
        return settings