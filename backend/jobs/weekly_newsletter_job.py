"""
TX Energy Risk — Weekly Newsletter Job
Runs every Monday at 06:00 CT (12:00 UTC).
Generates a draft newsletter issue and saves to Supabase for admin review.

Railway cron setup:
  Service: humble-newsletter (separate from humble-exploration)
  Start command: python -m jobs.weekly_newsletter_job
  Cron: 0 12 * * 1  (Monday 12:00 UTC = 07:00 CT)
"""
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

async def run():
    from services.newsletter_service import generate_and_save_draft
    log.info("=== Weekly Newsletter Generation Starting ===")
    issue_id = await generate_and_save_draft()
    log.info(f"=== Draft ready for review: {issue_id} ===")
    log.info("Review at: /admin/newsletter")

if __name__ == "__main__":
    asyncio.run(run())
