import sys
import os
sys.path.append('backend')
from app.services.database import DatabaseService

sb = DatabaseService.get_client()
response = sb.table('generation_jobs').select('job_id,status').execute()
print('All job statuses:')
for job in response.data:
    status = job["status"]
    print(f'  {job["job_id"]}: "{status}" (length: {len(status)}, repr: {repr(status)})')