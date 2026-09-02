"""Unit tests for OmniRouterProvider and configuration routing."""

from __future__ import annotations

import pytest
from pydantic import SecretStr

from neural_navigator.core.config import Settings
from neural_navigator.schemas.base import ChatMessage
from neural_navigator.services.llm import (
    LLMChunk,
    LLMService,
    OmniRouterProvider,
    OpenAICompatibleProvider,
    build_llm_provider,
)
from neural_navigator.utils.constants import Environment, FinishReason, LLMProviderName, Role


def test_omni_router_provider_init_headers() -> None:
    provider = OmniRouterProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key="sk-or-test-key",
        timeout_seconds=30.0,
        site_url="https://xplain.ai",
        app_name="XplainAI",
    )
    assert provider.name == LLMProviderName.OMNI_ROUTER.value
    assert provider._client.headers.get("authorization") == "Bearer sk-or-test-key"
    assert provider._client.headers.get("http-referer") == "https://xplain.ai"
    assert provider._client.headers.get("x-title") == "XplainAI"


def test_omni_router_custom_extra_headers() -> None:
    provider = OmniRouterProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key="sk-or-test-key",
        timeout_seconds=30.0,
        extra_headers={"X-Custom-Header": "custom-val"},
    )
    assert provider._client.headers.get("x-custom-header") == "custom-val"
    assert provider._client.headers.get("http-referer") == "https://xplain.ai"


def test_build_llm_provider_omni_router_missing_key() -> None:
    settings = Settings(
        llm_provider=LLMProviderName.OMNI_ROUTER,
        omni_router_api_key=None,
    )
    with pytest.raises(RuntimeError, match="requires OMNI_ROUTER_API_KEY"):
        build_llm_provider(settings)


def test_build_llm_provider_omni_router_configured() -> None:
    settings = Settings(
        llm_provider=LLMProviderName.OMNI_ROUTER,
        omni_router_api_key=SecretStr("sk-or-test-12345"),
        omni_router_base_url="https://openrouter.ai/api/v1",
        omni_router_site_url="https://xplain.ai",
        omni_router_app_name="XplainAI Pro",
    )
    provider = build_llm_provider(settings)
    assert isinstance(provider, OmniRouterProvider)
    assert provider.name == LLMProviderName.OMNI_ROUTER.value
    assert provider._client.headers.get("authorization") == "Bearer sk-or-test-12345"
    assert provider._client.headers.get("x-title") == "XplainAI Pro"


def test_config_deployment_invariant_omni_router() -> None:
    with pytest.raises(ValueError, match="LLM_PROVIDER=omni_router requires OMNI_ROUTER_API_KEY"):
        Settings(
            app_env=Environment.PRODUCTION,
            jwt_secret=SecretStr("real-production-secret-key-32chars!"),
            api_cors_origins="https://xplain.ai",
            llm_provider=LLMProviderName.OMNI_ROUTER,
            omni_router_api_key=None,
        )
