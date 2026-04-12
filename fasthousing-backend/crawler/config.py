from dataclasses import dataclass


@dataclass
class CrawlerConfig:
    city: str = "sh"
    base_url: str = "https://sh.ke.com"
    min_delay_sec: float = 2.0
    max_delay_sec: float = 5.0
    concurrent_limit: int = 5


config = CrawlerConfig()
