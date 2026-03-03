#!/usr/bin/env python3
import asyncio
import logging
import signal
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

class Worker:
    def __init__(self):
        self.running = True
    
    async def process_job(self, job: dict):
        from app.workers.base import WorkerRegistry
        from app.services.queue import QueueService
        from app.services.database import DatabaseService
        from app.services.credit import CreditService
        
        job_id = job["id"]
        job_data = job["data"]
        
        logger.info(f"Processing job {job_id}")
        await QueueService.update_job_status(job_id, "processing")
        
        model = job_data.get("model", "flux-dev")
        worker = WorkerRegistry.get_worker(model)
        
        if not worker:
            error = f"No worker found for model: {model}"
            await QueueService.update_job_status(job_id, "failed", error=error)
            await CreditService.refund_credits(job_data["user_id"], job_data.get("n", 1), error)
            return
        
        try:
            result = await worker.process_job({**job_data, "job_id": job_id})
            if result["status"] == "completed":
                await QueueService.update_job_status(job_id, "completed", result=result)
                await DatabaseService.store_generated_images(job_id, result)
                logger.info(f"Job {job_id} completed")
            else:
                await QueueService.update_job_status(job_id, "failed", error=result.get("error"))
                await CreditService.refund_credits(job_data["user_id"], job_data.get("n", 1), f"Generation failed: {result.get('error')}")
        except Exception as e:
            logger.error(f"Job error: {e}", exc_info=True)
            await QueueService.update_job_status(job_id, "failed", error=str(e))
            await CreditService.refund_credits(job_data["user_id"], job_data.get("n", 1), f"Error: {str(e)}")
    
    async def run(self):
        from app.services.queue import QueueService
        logger.info("Worker started, waiting for jobs...")
        while self.running:
            try:
                job = await QueueService.dequeue_job()
                if job:
                    await self.process_job(job)
                else:
                    await asyncio.sleep(2)
            except Exception as e:
                logger.error(f"Worker error: {e}", exc_info=True)
                await asyncio.sleep(5)
    
    def stop(self):
        logger.info("Worker stopping...")
        self.running = False

async def main():
    worker = Worker()
    def signal_handler(signum, frame):
        worker.stop()
        sys.exit(0)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())