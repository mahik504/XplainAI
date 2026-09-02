"""Unit tests for liveness, readiness, and observability health probes."""

import pytest
from fastapi.testclient import TestClient

from neural_navigator.core.config import Settings
from neural_navigator.main import create_app


def test_health_liveness_probe() -> None:
    settings = Settings(auth_required=False)
    app = create_app(settings)
    with TestClient(app) as client:
        response = client.get("/health/live")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "uptime_seconds" in data
        assert data["service"] == "xplainai-api"


def test_health_readiness_probe_with_database_and_redis() -> None:
    settings = Settings(auth_required=False)
    app = create_app(settings)
    with TestClient(app) as client:
        response = client.get("/health/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "checks" in data
        assert data["checks"]["llm_service"] is True
        assert data["checks"]["event_bus"] is True
        assert data["checks"]["database"] is True
        assert data["checks"]["redis"] is True
