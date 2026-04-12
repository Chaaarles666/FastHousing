from collections.abc import Awaitable, Callable
from functools import wraps

from redis.asyncio import Redis

from app.config import get_settings

settings = get_settings()
redis_client = Redis.from_url(settings.redis_url, decode_responses=True)


def cache_for(seconds: int, key_builder: Callable[..., str]):
    def decorator(func: Callable[..., Awaitable]):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = key_builder(*args, **kwargs)
            cached = await redis_client.get(key)
            if cached:
                return cached

            result = await func(*args, **kwargs)
            await redis_client.set(key, str(result), ex=seconds)
            return result

        return wrapper

    return decorator
