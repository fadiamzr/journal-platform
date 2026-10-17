"""
Application configuration management using Pydantic Settings.
Loads and validates environment variables from apps/api/.env regardless of the CWD.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Literal, Self

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Path to apps/api/.env resolved relative to this file
_CONFIG_DIR = Path(__file__).resolve().parent
_API_DIR = _CONFIG_DIR.parent.parent
_DEFAULT_ENV_FILE = _API_DIR / ".env"

_REF_RE = re.compile(r"postgres\.([a-z0-9]+)", re.IGNORECASE)
_URL_REF_RE = re.compile(r"https?://([a-z0-9]+)\.supabase\.(?:co|in|net)", re.IGNORECASE)


class Settings(BaseSettings):
    """Core application settings with environment variable bindings."""

    model_config = SettingsConfigDict(
        env_file=_DEFAULT_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: Literal["development", "production"] = "development"
    LOG_LEVEL: str = "INFO"

    # Core Supabase credentials & endpoints (Required)
    SUPABASE_URL: str = ""
    SUPABASE_SECRET_KEY: SecretStr = SecretStr("")
    SUPABASE_JWKS_URL: str = ""

    # JWT Authentication
    JWT_AUDIENCE: str = "authenticated"
    JWKS_CACHE_TTL_SECONDS: int = 600

    # Networking & Uploads
    CORS_ORIGINS: str = ""
    MAX_UPLOAD_MB: int = 50

    # Database & Optional Services
    DATABASE_URL: SecretStr | None = None
    LLM_PROVIDER: str | None = None
    GEMINI_API_KEY: SecretStr | None = None
    GEMINI_MODEL: str | None = None

    @model_validator(mode="after")
    def validate_required_settings(self) -> Self:
        """Ensure critical environment variables are present and non-empty."""
        missing: list[str] = []
        if not self.SUPABASE_URL.strip():
            missing.append("SUPABASE_URL")
        if not self.SUPABASE_SECRET_KEY.get_secret_value().strip():
            missing.append("SUPABASE_SECRET_KEY")
        if not self.SUPABASE_JWKS_URL.strip():
            missing.append("SUPABASE_JWKS_URL")

        if missing:
            # Report only variable names, never any secret values
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing)}"
            )
        return self

    @property
    def jwt_issuer(self) -> str:
        """Derived Supabase Auth JWT issuer URL."""
        return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parsed list of allowed CORS origins."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def project_ref(self) -> str:
        """Extract project reference identifier for sanitized logging context."""
        if self.DATABASE_URL:
            db_val = self.DATABASE_URL.get_secret_value()
            match_db = _REF_RE.search(db_val)
            if match_db:
                return match_db.group(1)
        if self.SUPABASE_URL:
            match_url = _URL_REF_RE.search(self.SUPABASE_URL)
            if match_url:
                return match_url.group(1)
        return "unknown"


@lru_cache
def get_settings() -> Settings:
    """Cached factory function returning the application Settings instance."""
    return Settings()
