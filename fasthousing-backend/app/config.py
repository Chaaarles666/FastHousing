from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "FastHousing Backend"
    app_env: str = "dev"
    app_debug: bool = True

    database_url: str = "postgresql+asyncpg://fasthousing:fasthousing@localhost:5432/fasthousing"
    redis_url: str = "redis://localhost:6379/0"

    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:3456"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | List[str]) -> List[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
