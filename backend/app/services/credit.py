"""
Credit Service
Handles credit checking, reservation, and refunds
"""
import logging
from typing import Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class CreditService:
    @classmethod
    def get_client(cls):
        from app.security import get_supabase
        return get_supabase()
    
    @classmethod
    async def check_and_reserve_credits(cls, user_id: str, amount: int) -> Dict[str, Any]:
        sb = cls.get_client()
        response = sb.table("user_credits").select("*").eq("user_id", user_id).execute()
        
        if not response.data:
            return {"success": False, "available": 0, "error": "No credits found"}
        
        user_credits = response.data[0]
        balance = user_credits.get("balance", 0)
        daily_credits = user_credits.get("daily_credits", 0)
        total_available = balance + daily_credits
        
        if total_available < amount:
            return {"success": False, "available": total_available, "required": amount, "error": "Insufficient credits"}
        
        deducted_daily = min(daily_credits, amount)
        deducted_balance = amount - deducted_daily
        new_balance = balance - deducted_balance
        new_daily = daily_credits - deducted_daily
        
        sb.table("user_credits").update({"daily_credits": new_daily, "balance": new_balance, "updated_at": datetime.utcnow().isoformat()}).eq("user_id", user_id).execute()
        
        sb.table("credits_transactions").insert({"user_id": user_id, "amount": -amount, "type": "generation", "reason": "Reserved for image generation"}).execute()
        
        logger.info(f"Reserved {amount} credits for user {user_id}")
        return {"success": True, "reserved": amount, "new_balance": new_balance, "new_daily": new_daily}
    
    @classmethod
    async def refund_credits(cls, user_id: str, amount: int, reason: str = "Generation failed"):
        sb = cls.get_client()
        response = sb.table("user_credits").select("*").eq("user_id", user_id).execute()
        
        if not response.data:
            logger.warning(f"Cannot refund - no credits found for user {user_id}")
            return
        
        user_credits = response.data[0]
        new_balance = user_credits["balance"] + amount
        
        sb.table("user_credits").update({"balance": new_balance, "updated_at": datetime.utcnow().isoformat()}).eq("user_id", user_id).execute()
        sb.table("credits_transactions").insert({"user_id": user_id, "amount": amount, "type": "refund", "reason": reason}).execute()
        
        logger.info(f"Refunded {amount} credits to user {user_id}")
    
    @classmethod
    async def get_user_credits(cls, user_id: str) -> Dict[str, Any]:
        sb = cls.get_client()
        response = sb.table("user_credits").select("*").eq("user_id", user_id).execute()
        
        if not response.data:
            return {"balance": 0, "daily_credits": 0, "total": 0}
        
        credits = response.data[0]
        return {"balance": credits.get("balance", 0), "daily_credits": credits.get("daily_credits", 0), "total": credits.get("balance", 0) + credits.get("daily_credits", 0)}