"""Application configuration.

Settings are parsed and validated once, at import of the application factory, so a
misconfigured deployment fails at boot with a precise error instead of at the first
request that happens to touch the bad value.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from neural_navigator.utils.constants import Environment, LLMProviderName, LogFormat

_PLACEHOLDER_SECRETS = frozenset({"", "change-me", "changeme", "secret", "please-change"})


class Settings(BaseSettings):
    """Environment-backed application settings.

    Field names map to upper-case environment variables case-insensitively, so
    ``postgres_dsn`` is populated from ``POSTGRES_DSN``.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        frozen=True,
        validate_default=True,
    )

    # --- Runtime -----------------------------------------------------------
    app_env: Environment = Environment.LOCAL
    project_name: str = "XplainAI"
    version: str = "2.1.0"
    log_level: str = "INFO"
    log_format: LogFormat = LogFormat.CONSOLE

    # --- HTTP --------------------------------------------------------------
    api_host: str = "0.0.0.0"  # noqa: S104 - binding all interfaces is intended in a container
    api_port: int = Field(default=8000, ge=1, le=65535)
    api_root_path: str = ""
    # Declared as a plain string because pydantic-settings attempts a JSON decode on
    # complex-typed fields before validators run, which rejects the comma-separated
    # form that every deployment tool emits. Parsed by `cors_origins` below.
    api_cors_origins: str = "http://localhost:5173"

    # --- Datastores --------------------------------------------------------
    postgres_dsn: str | None = None
    postgres_pool_size: int = Field(default=10, ge=1, le=100)
    redis_url: str | None = None

    # --- Auth --------------------------------------------------------------
    auth_required: bool = False
    jwt_secret: SecretStr = SecretStr("change-me")
    jwt_algorithm: str = "HS256"
    jwt_audience: str | None = None
    jwt_issuer: str | None = None
    access_token_ttl_seconds: int = Field(default=900, ge=60)
    refresh_token_ttl_seconds: int = Field(default=1_209_600, ge=300)

    # --- Model providers ---------------------------------------------------
    # Production / demo path: openai. Echo remains the offline fallback.
    llm_provider: LLMProviderName = LLMProviderName.OPENAI
    llm_base_url: str = "https://api.openai.com/v1"
    openai_api_key: SecretStr | None = None
    anthropic_api_key: SecretStr | None = None
    default_chat_model: str = "gpt-4.1-mini"
    llm_request_timeout_seconds: float = Field(default=60.0, gt=0)
    llm_max_retries: int = Field(default=2, ge=0, le=5)
    llm_temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    llm_max_output_tokens: int = Field(default=2048, ge=1)

    # --- Agent runtime -----------------------------------------------------
    langgraph_checkpoint_backend: str = "memory"
    agent_max_steps: int = Field(default=32, ge=1)
    agent_step_timeout_seconds: float = Field(default=120.0, gt=0)
    conversation_db_path: str = ".data/conversations.db"
    default_run_mode: str = "balanced"

    # Optional research tool keys (never hardcode; unset = tool skipped)
    newsdata_api_key: SecretStr | None = None
    openweather_api_key: SecretStr | None = None

    # --- WebSocket ---------------------------------------------------------
    ws_heartbeat_interval_seconds: float = Field(default=20.0, gt=0)
    ws_max_connections_per_user: int = Field(default=5, ge=1)
    ws_message_max_bytes: int = Field(default=65_536, ge=1_024)

    # --- Observability -----------------------------------------------------
    otel_service_name: str = "xplainai-api"
    otel_exporter_otlp_endpoint: str | None = None

    @field_validator("log_level", mode="before")
    @classmethod
    def _normalise_log_level(cls, value: Any) -> str:
        level = str(value).upper().strip()
        if level not in logging.getLevelNamesMapping():
            valid = ", ".join(sorted(logging.getLevelNamesMapping()))
            raise ValueError(f"unknown log level {level!r}; expected one of: {valid}")
        return level

    @field_validator("api_root_path")
    @classmethod
    def _normalise_root_path(cls, value: str) -> str:
        stripped = value.strip().rstrip("/")
        if stripped and not stripped.startswith("/"):
            raise ValueError("api_root_path must start with '/'")
        return stripped

    @field_validator(
        "openai_api_key",
        "anthropic_api_key",
        "newsdata_api_key",
        "openweather_api_key",
        mode="before",
    )
    @classmethod
    def _blank_secret_to_none(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        if isinstance(value, SecretStr) and not value.get_secret_value().strip():
            return None
        return value

    @field_validator("llm_base_url")
    @classmethod
    def _normalise_base_url(cls, value: str) -> str:
        return value.strip().rstrip("/")

    @model_validator(mode="after")
    def _enforce_deployment_invariants(self) -> Settings:
        if not self.app_env.is_deployed:
            return self

        problems: list[str] = []
        if self.jwt_secret.get_secret_value().strip().lower() in _PLACEHOLDER_SECRETS:
            problems.append("JWT_SECRET is unset or still the placeholder value")
        if "*" in self.cors_origins:
            problems.append("API_CORS_ORIGINS may not be a wildcard outside local development")
        if self.llm_provider is LLMProviderName.ECHO:
            problems.append("LLM_PROVIDER=echo is a development stub and must not be deployed")
        if self.llm_provider is LLMProviderName.OPENAI and self.openai_api_key is None:
            problems.append("LLM_PROVIDER=openai requires OPENAI_API_KEY")
        if problems:
            joined = "; ".join(problems)
            raise ValueError(f"invalid configuration for app_env={self.app_env.value}: {joined}")
        return self

    @property
    def cors_origins(self) -> list[str]:
        """Allowed browser origins, parsed from the comma-separated setting."""
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]

    @property
    def cors_allow_credentials(self) -> bool:
        """Credentialed CORS is incompatible with a wildcard origin per the Fetch spec."""
        return "*" not in self.cors_origins

    @property
    def is_production(self) -> bool:
        return self.app_env is Environment.PRODUCTION

    @property
    def docs_enabled(self) -> bool:
        return not self.is_production

    @property
    def docs_url(self) -> str | None:
        return "/docs" if self.docs_enabled else None

    @property
    def redoc_url(self) -> str | None:
        return "/redoc" if self.docs_enabled else None

    @property
    def openapi_url(self) -> str | None:
        return "/openapi.json" if self.docs_enabled else None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings singleton.

    Cached so that FastAPI dependency resolution does not re-read the environment on
    every request. Tests that need to vary configuration should call
    ``get_settings.cache_clear()`` in a fixture teardown.
    """
    return Settings()
