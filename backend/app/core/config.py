from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "O Mestre do Português API"
    api_prefix: str = ""
    environment: str = "development"
    debug: bool = True
    database_url: str = Field(alias="DATABASE_URL")
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    clerk_jwks_url: str = Field(alias="CLERK_JWKS_URL")
    clerk_issuer: str = Field(alias="CLERK_ISSUER")
    clerk_audience: str = Field(alias="CLERK_AUDIENCE")
    clerk_secret_key: str | None = Field(default=None, alias="CLERK_SECRET_KEY")
    clerk_api_base_url: str = Field(default="https://api.clerk.com/v1", alias="CLERK_API_BASE_URL")

    reminder_goal: int = Field(default=50, alias="REMINDER_GOAL")
    reminder_job_secret: str | None = Field(default=None, alias="REMINDER_JOB_SECRET")
    resend_api_key: str | None = Field(default=None, alias="RESEND_API_KEY")
    reminder_from_email: str | None = Field(default=None, alias="REMINDER_FROM_EMAIL")

    translation_provider: str = Field(default="local", alias="TRANSLATION_PROVIDER")
    libretranslate_url: str | None = Field(default=None, alias="LIBRETRANSLATE_URL")
    libretranslate_api_key: str | None = Field(default=None, alias="LIBRETRANSLATE_API_KEY")
    mymemory_contact_email: str | None = Field(default=None, alias="MYMEMORY_CONTACT_EMAIL")

    google_sheets_enabled: bool = Field(default=False, alias="GOOGLE_SHEETS_ENABLED")
    google_sheet_id: str | None = Field(default=None, alias="GOOGLE_SHEET_ID")
    google_sheet_name: str = Field(default="Vocabulary", alias="GOOGLE_SHEET_NAME")
    google_service_account_json: str | None = Field(default=None, alias="GOOGLE_SERVICE_ACCOUNT_JSON")

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("debug", mode="before")
    @classmethod
    def normalize_debug_flag(cls, value: bool | str) -> bool | str:
        if isinstance(value, bool):
            return value
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "on", "development", "debug"}:
            return True
        if lowered in {"0", "false", "no", "off", "release", "production"}:
            return False
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
