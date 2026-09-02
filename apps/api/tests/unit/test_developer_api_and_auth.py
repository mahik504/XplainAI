"""Unit tests for Developer API key generation, authentication, and REST routes."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from neural_navigator.api.middleware.auth import (
    Principal,
    generate_api_key,
    get_api_key_principal,
    get_current_principal,
    hash_api_key,
    require_scope,
)
from neural_navigator.core.config import Settings
from neural_navigator.infrastructure.db.models.api_key import ApiKey, ApiKeyModel


def test_api_key_generation_and_hashing() -> None:
    raw_key, key_hash = generate_api_key()
    assert raw_key.startswith("xpk_live_")
    assert len(raw_key) > 20
    assert len(key_hash) == 64  # SHA-256 hex string

    # Deterministic hash check
    assert hash_api_key(raw_key) == key_hash


def test_api_key_model_attributes() -> None:
    api_key = ApiKeyModel(
        id="key_123",
        user_id="usr_456",
        tenant_id="ten_789",
        key_hash=hash_api_key("xpk_live_test"),
        name="Test Dev Key",
        tier="pro",
        scopes=["research:jobs:write", "evidence:read"],
        rate_limit=300,
        is_active=True,
    )
    assert api_key.id == "key_123"
    assert api_key.user_id == "usr_456"
    assert api_key.tier == "pro"
    assert "evidence:read" in api_key.scopes
    assert api_key.rate_limit == 300
    assert ApiKey is ApiKeyModel


def test_principal_scope_evaluation() -> None:
    # 1. Exact scope match
    p1 = Principal(user_id="u1", scopes=["research:run", "citations:read"])
    assert p1.has_scope("research:run") is True
    assert p1.has_scope("citations:read") is True
    assert p1.has_scope("evidence:delete") is False

    # 2. Wildcard match
    p2 = Principal(user_id="u2", scopes=["*"])
    assert p2.has_scope("anything") is True

    # 3. Domain prefix wildcard
    p3 = Principal(user_id="u3", scopes=["research:*"])
    assert p3.has_scope("research:jobs:create") is True
    assert p3.has_scope("research:cancel") is True
    assert p3.has_scope("billing:view") is False


@pytest.mark.asyncio
async def test_require_scope_dependency() -> None:
    checker = require_scope("evidence:read")

    # Allowed principal
    p_valid = Principal(user_id="u1", scopes=["evidence:read"])
    res = await checker(principal=p_valid)
    assert res.user_id == "u1"

    # Forbidden principal
    p_invalid = Principal(user_id="u2", scopes=["chat:write"])
    with pytest.raises(HTTPException) as exc_info:
        await checker(principal=p_invalid)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_developer_api_routes_end_to_end() -> None:
    from httpx import ASGITransport, AsyncClient
    from neural_navigator.main import create_app

    settings = Settings(auth_required=False)
    app = create_app(settings)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. POST /api/v1/research/jobs
        job_payload = {
            "query": "Quantum computing in cryptography",
            "mode": "deep_research",
            "max_sources": 5,
        }
        res_job = await client.post("/api/v1/research/jobs", json=job_payload)
        assert res_job.status_code == 202
        job_data = res_job.json()
        assert "job_id" in job_data
        assert job_data["status"] in ("queued", "running", "completed")

        job_id = job_data["job_id"]

        # 2. GET /api/v1/research/jobs/{id}
        res_get_job = await client.get(f"/api/v1/research/jobs/{job_id}")
        assert res_get_job.status_code == 200
        assert res_get_job.json()["job_id"] == job_id

        # 3. GET /api/v1/research/jobs (list)
        res_list_jobs = await client.get("/api/v1/research/jobs")
        assert res_list_jobs.status_code == 200
        assert isinstance(res_list_jobs.json(), list)

        # 4. POST /api/v1/evidence/search
        res_search = await client.post(
            "/api/v1/evidence/search",
            json={"query": "quantum cryptography", "top_k": 5},
        )
        assert res_search.status_code == 200
        assert isinstance(res_search.json(), list)
