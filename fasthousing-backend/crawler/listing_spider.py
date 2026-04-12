from crawler.base_spider import BaseSpider


class ListingSpider(BaseSpider):
    async def crawl(self, community_beike_ids: list[str]) -> list[dict]:
        # TODO: crawl listing pages by community and return normalized rows.
        return []
