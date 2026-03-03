import asyncio
import sys
import os
import uuid
sys.path.append('backend')

from app.services.database import DatabaseService

async def create_test_job():
    job = {
        "id": str(uuid.uuid4()),
        "data": {
            'prompt': 'cyberpunk city landscape at night with neon lights',
            'size': '1024x1024',
            'n': 1,
            'user_id': '2a0d79c7-b6de-49a2-948e-5d1cc0f444cc',
            'model': 'flux-1-dev'
        }
    }
    
    job_id = await DatabaseService.store_pending_job(job)
    print(f'Created test job with ID: {job_id}')
    return job_id

if __name__ == "__main__":
    asyncio.run(create_test_job())