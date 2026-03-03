import asyncio
import sys
import os
sys.path.append('backend')

from app.services.processor import ImageProcessor
from app.services.database import DatabaseService

async def detailed_test():
    print("=== Checking all jobs ===")
    sb = DatabaseService.get_client()
    response = sb.table('generation_jobs').select('*').execute()
    print(f'Total jobs: {len(response.data)}')
    for job in response.data:
        print(f'  Job ID: {job.get("job_id")}, Status: {job.get("status")}, Prompt: {job.get("prompt")}')
    
    print("\n=== Checking pending jobs specifically ===")
    pending_response = sb.table('generation_jobs').select('*').eq('status', 'pending').execute()
    print(f'Pending jobs: {len(pending_response.data)}')
    for job in pending_response.data:
        print(f'  Job ID: {job.get("job_id")}, Status: {job.get("status")}, Prompt: {job.get("prompt")}')
    
    print("\n=== Trying to get next pending job ===")
    next_job = await DatabaseService.get_next_pending_job()
    if next_job:
        print(f"Found job: {next_job}")
        print("Attempting to process...")
        result = await ImageProcessor.process_job(next_job)
        print(f"Processing result: {result}")
    else:
        print("No job found by get_next_pending_job")

if __name__ == "__main__":
    asyncio.run(detailed_test())