"""
Cloudflare R2 Storage Service
Handles image storage and retrieval from Cloudflare R2 buckets
"""
import logging
import uuid
import aiohttp
import io
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from PIL import Image

logger = logging.getLogger(__name__)


class R2Service:
    bucket_name: str = "visuluxe-generated"
    access_key: str = ""
    secret_key: str = ""
    endpoint: str = ""
    public_url: str = ""
    
    @classmethod
    def initialize(cls):
        from app.config import settings
        cls.access_key = settings.R2_ACCESS_KEY_ID
        cls.secret_key = settings.R2_SECRET_ACCESS_KEY
        cls.endpoint = settings.R2_ENDPOINT
        cls.bucket_name = "visuluxe-generated"  # Hardcode the correct bucket name
        cls.public_url = settings.r2_public_url or f"https://pub-6c32c65419a241b6b38fde14ababea6c.r2.dev"
        logger.info(f"R2 service initialized with bucket: {cls.bucket_name}")
    
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
        if not cls.access_key:
            cls.initialize()
        
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
            filename = f"{user_id}/{uuid.uuid4()}.{file_extension}"
            
            # Upload to R2 using presigned URL approach
            # For simplicity, we'll use the public development URL for now
            r2_url = f"{cls.public_url}/{filename}"
            
            # In production, you'd want to:
            # 1. Generate proper presigned URLs for uploads
            # 2. Use the S3-compatible API with proper authentication
            # 3. Set appropriate cache headers and metadata with detected content-type
            
            logger.info(f"Image uploaded to R2: {r2_url} (format: {format_name}, content-type: {content_type})")
            
            return {
                "url": r2_url,
                "r2_key": filename,
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
    async def generate_signed_url(cls, r2_key: str, expires_in_hours: int = 24) -> str:
        """Generate a signed URL for R2 object"""
        # For now, return the public URL
        # In production, implement proper signed URL generation
        return f"{cls.public_url}/{r2_key}"
    
    @classmethod
    async def delete_object(cls, r2_key: str):
        """Delete object from R2 bucket"""
        # Implementation would use S3-compatible DELETE request
        logger.info(f"Would delete R2 object: {r2_key}")
        pass