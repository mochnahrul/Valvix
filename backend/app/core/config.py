from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./valvix.db"
    STEAM_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"

    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if "postgresql+psycopg2://" in v:
            return v.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
        if "postgresql://" in v:
            return v.replace("postgresql://", "postgresql+asyncpg://")
        if "postgres://" in v:
            return v.replace("postgres://", "postgresql+asyncpg://")
        if "sqlite:///" in v and "sqlite+aiosqlite:///" not in v:
            return v.replace("sqlite:///", "sqlite+aiosqlite:///")
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
