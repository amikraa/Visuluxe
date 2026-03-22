"""
Cloudflare R2 Storage Service
Private bucket storage with signed URLs
"""
import boto3
from botocore.config import Config
from datetime import datetime, timedelta
import uuid
import logging
import aiohttp
import io
from typing import Optional, Dict, Any, Tuple
from PIL import Image

logger = logging.getLogger(__name__)

_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        from app.config import settings
        logger.info(f"R2 access key length: {len(settings.R2_ACCESS_KEY_ID)}")
        _s3_client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"}
            )
        )
        logger.info(f"R2 client initialized with bucket: {settings.R2_BUCKET_NAME}")
    return _s3_client


class StorageService:
    @classmethod
    async def upload_image(cls, image_bytes: bytes, user_id: str, job_id: str, content_type: str = "image/png") -> str:
        s3 = get_s3_client()
        from app.services.config_service import get_config
        
        # Get R2 bucket name from configuration service
        r2_bucket_name = await get_config("r2_bucket_name", "visuluxe-images")
        r2_key = f"images/{user_id}/{job_id}/{uuid.uuid4()}.png"
        s3.put_object(Bucket=r2_bucket_name, Key=r2_key, Body=image_bytes, ContentType=content_type)
        logger.info(f"Uploaded image to R2: {r2_key}")
        
        # Debug logging to confirm objects are present in R2
        try:
            list_response = s3.list_objects_v2(Bucket=r2_bucket_name)
            logger.info(f"R2 bucket contents after upload: {list_response.get('Contents', [])}")
        except Exception as e:
            logger.warning(f"Failed to list R2 bucket contents for verification: {e}")
        
        return r2_key
    
    @classmethod
    def _detect_image_format(cls, image_data: bytes) -> tuple[str, str]:
        """
        Detect image format from binary data using Pillow
        Returns (format_name, file_extension)
        """
        try:
            # Create BytesIO object from image data
            image_buffer = io.BytesIO(image_data)
            
            # Open image with Pillow to detect format
            img = Image.open(image_buffer)
            format_name = img.format.lower()
            
            # Map format to file extension
            extension_map = {
                'jpeg': 'jpg',
                'jpg': 'jpg',
                'png': 'png',
                'gif': 'gif',
                'webp': 'webp',
                'bmp': 'bmp',
                'tiff': 'tiff',
                'ico': 'ico'
            }
            
            file_extension = extension_map.get(format_name, 'png')  # default to png
            logger.info(f"Detected image format: {format_name} -> .{file_extension}")
            
            return format_name, file_extension
            
        except Exception as e:
            logger.warning(f"Failed to detect image format, defaulting to PNG: {e}")
            return 'png', 'png'
    
    @classmethod
    def _get_content_type(cls, format_name: str) -> str:
        """Get proper Content-Type for image format"""
        content_types = {
            'jpeg': 'image/jpeg',
            'jpg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'tiff': 'image/tiff',
            'ico': 'image/x-icon'
        }
        return content_types.get(format_name, 'image/png')
    
    @classmethod
    async def upload_image_from_url(cls, image_url: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Download image from URL and upload to R2 bucket with proper format detection"""
        try:
            # Download the image
            async with aiohttp.ClientSession() as session:
                async with session.get(image_url) as response:
                    if response.status != 200:
                        logger.error(f"Failed to download image from {image_url}: {response.status}")
                        return None
                    
                    image_data = await response.read()
                    original_content_type = response.headers.get('content-type', '')
                    logger.info(f"Original Content-Type from provider: {original_content_type}")
            
            # Detect actual image format from binary data
            format_name, file_extension = cls._detect_image_format(image_data)
            content_type = cls._get_content_type(format_name)
            
            # Generate unique filename with detected extension
            r2_key = f"images/{user_id}/{uuid.uuid4()}.{file_extension}"
            
            # Upload to R2
            s3 = get_s3_client()
            from app.services.config_service import get_config
            r2_bucket_name = await get_config("r2_bucket_name", "visuluxe-images")
            r2_public_base_url = await get_config("r2_public_base_url", "https://visuluxe.r2.cloudflarestorage.com")
            
            s3.put_object(Bucket=r2_bucket_name, Key=r2_key, Body=image_data, ContentType=content_type)
            logger.info(f"Uploaded image to R2: {r2_key}")
            
            # Generate public URL using custom domain
            public_url = f"{r2_public_base_url}/{r2_key}"
            
            # Debug logging to confirm objects are present in R2
            try:
                list_response = s3.list_objects_v2(Bucket=r2_bucket_name)
                logger.info(f"R2 bucket contents after upload: {list_response.get('Contents', [])}")
            except Exception as e:
                logger.warning(f"Failed to list R2 bucket contents for verification: {e}")
            
            return {
                "url": public_url,
                "r2_key": r2_key,
                "format": format_name,
                "extension": file_extension,
                "content_type": content_type,
                "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat()
            }
            
        except Exception as e:
            logger.error(f"R2 upload failed: {e}")
            logger.exception(e)
            return None
    
    @classmethod
    async def generate_signed_url(cls, r2_key: str, expires_in_minutes: int = 15) -> str:
        s3 = get_s3_client()
        from app.services.config_service import get_config
        r2_bucket_name = await get_config("r2_bucket_name", "visuluxe-images")
        url = s3.generate_presigned_url('get_object', Params={'Bucket': r2_bucket_name, 'Key': r2_key}, ExpiresIn=expires_in_minutes * 60)
        return url
    
    @classmethod
    def get_expiry_time(cls, minutes: int = 15) -> datetime:
        return datetime.utcnow() + timedelta(minutes=minutes)
    
    @classmethod
    async def delete_image(cls, r2_key: str):
        s3 = get_s3_client()
        from app.services.config_service import get_config
        r2_bucket_name = await get_config("r2_bucket_name", "visuluxe-images")
        s3.delete_object(Bucket=r2_bucket_name, Key=r2_key)
        logger.info(f"Deleted image from R2: {r2_key}")
    
    @classmethod
    async def cleanup_expired_images(cls):
        from app.services.database import DatabaseService
        sb = DatabaseService.get_client()
        response = sb.table("generation_jobs").select("job_id, r2_keys").lt("expires_at", datetime.utcnow().isoformat()).execute()
        for job in response.data or []:
            r2_keys = job.get("r2_keys", [])
            for key in r2_keys:
                if key:
                    await cls.delete_image(key)
            sb.table("generation_jobs").delete().eq("job_id", job["job_id"]).execute()
        logger.info(f"Cleaned up {len(response.data or [])} expired jobs")
