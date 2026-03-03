import asyncio
import sys
import os
sys.path.append('backend')

from app.services.database import DatabaseService

async def check_all_jobs():
    sb = DatabaseService.get_client()
    response = sb.table('generation_jobs').select('*').execute()
    print(f'Total jobs in database: {len(response.data)}')
    for job in response.data:
        print(f'  Job ID: {job.get("job_id")}, Status: {job.get("status")}, Prompt: {job.get("prompt")}')

if __name__ == "__main__":
    asyncio.run(check_all_jobs())