from crawler.base_spider import BaseSpider


class TransactionSpider(BaseSpider):
    async def crawl(self, community_beike_ids: list[str]) -> list[dict]:
        # TODO: crawl transaction pages by community and return normalized rows.
        return []
