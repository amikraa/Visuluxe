import asyncio
import sys
import os
sys.path.append('backend')

from app.services.database import DatabaseService

async def check_jobs():
    jobs = await DatabaseService.get_pending_jobs()
    print(f'Found {len(jobs)} pending jobs:')
    for job in jobs:
        print(f'  Job ID: {job.get("job_id")}, Status: {job.get("status")}, Prompt: {job.get("prompt")}')

if __name__ == "__main__":
    asyncio.run(check_jobs())