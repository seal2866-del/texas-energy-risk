"""
Cron runner — called by Railway cron job.
Runs once and exits. Railway handles the schedule.

Railway setup:
  1. In your Railway project, add a new service
  2. Connect it to the same repo
  3. Set the start command to: python -m jobs.cron_runner
  4. Under Settings -> Cron, set schedule: 0 12 * * *  (06:00 CT = 12:00 UTC)
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from jobs.daily_report_job import run

if __name__ == "__main__":
    asyncio.run(run())
