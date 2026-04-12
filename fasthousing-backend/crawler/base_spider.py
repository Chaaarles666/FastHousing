import asyncio
import random

import httpx

from crawler.config import config


class AntiCrawlError(Exception):
    pass


class BaseSpider:
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(timeout=30)
        self.semaphore = asyncio.Semaphore(config.concurrent_limit)
        self.request_count = 0
        self.ua_pool = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 Chrome/124.0",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0",
        ]

    async def fetch(self, url: str) -> str:
        async with self.semaphore:
            await asyncio.sleep(random.uniform(config.min_delay_sec, config.max_delay_sec))
            headers = {
                "User-Agent": random.choice(self.ua_pool),
                "Accept-Language": "zh-CN,zh;q=0.9",
                "Referer": f"{config.base_url}/",
            }
            response = await self.client.get(url, headers=headers)
            self.request_count += 1

            if response.status_code in {403, 429} or "验证" in response.text:
                raise AntiCrawlError(f"anti-crawl triggered at {url}")

            response.raise_for_status()
            return response.text

    async def close(self) -> None:
        await self.client.aclose()
