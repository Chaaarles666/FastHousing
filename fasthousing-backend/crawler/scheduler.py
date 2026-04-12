from apscheduler.schedulers.asyncio import AsyncIOScheduler


def build_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
    # TODO: bind real jobs after spider implementation.
    # scheduler.add_job(run_listing_incremental, "cron", hour=2, minute=0)
    # scheduler.add_job(run_transaction_incremental, "cron", hour=4, minute=0)
    # scheduler.add_job(run_community_refresh, "cron", day_of_week="sun", hour=1, minute=0)
    return scheduler
