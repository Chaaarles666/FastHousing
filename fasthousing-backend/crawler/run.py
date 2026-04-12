import argparse
import asyncio

from crawler.community_spider import CommunitySpider
from crawler.listing_spider import ListingSpider
from crawler.transaction_spider import TransactionSpider


async def run_community() -> None:
    spider = CommunitySpider()
    data = await spider.crawl()
    print(f"[community] fetched={len(data)}")
    await spider.close()


async def run_listing() -> None:
    spider = ListingSpider()
    data = await spider.crawl([])
    print(f"[listing] fetched={len(data)}")
    await spider.close()


async def run_transaction() -> None:
    spider = TransactionSpider()
    data = await spider.crawl([])
    print(f"[transaction] fetched={len(data)}")
    await spider.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--type", choices=["community", "listing", "transaction", "all", "daily"], default="daily")
    args = parser.parse_args()

    if args.type == "community":
        asyncio.run(run_community())
    elif args.type == "listing":
        asyncio.run(run_listing())
    elif args.type == "transaction":
        asyncio.run(run_transaction())
    elif args.type == "all":
        asyncio.run(run_community())
        asyncio.run(run_listing())
        asyncio.run(run_transaction())
    else:
        asyncio.run(run_listing())
        asyncio.run(run_transaction())


if __name__ == "__main__":
    main()
