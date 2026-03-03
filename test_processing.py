import asyncio
import sys
import os
sys.path.append('backend')

from app.services.processor import ImageProcessor
from app.services.database import DatabaseService

async def test_manual_processing():
    # Get the first pending job
    job = await DatabaseService.get_next_pending_job()
    
    if job:
        print(f"Found job to process: {job['job_id']}")
        print(f"Job data: {job['data']}")
        
        # Process it manually
        result = await ImageProcessor.process_job(job)
        print(f"Processing result: {result}")
    else:
        print("No pending jobs found")

if __name__ == "__main__":
    asyncio.run(test_manual_processing())