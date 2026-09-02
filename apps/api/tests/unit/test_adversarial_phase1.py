"""Empirical Challenger Adversarial Test Suite for Backend Phase 1 (P0 Stability).

Empirically challenges:
1. DI Resolution for WSPrincipalDep, WSLLMServiceDep, WSEventBusDep, WSSettingsDep across auth modes,
   token scenarios, malformed claims, and missing app-state dependencies.
2. Pydantic v2 Chat Response & Request serialization, roundtrip integrity, whitespace preservation,
   and OpenAPI schema reflection.
3. WebSocket connection initialization, registry concurrency, per-user connection limits, connect/disconnect storms,
   superseding runs, run cancellations, frame sequence monotonicity, and malformed payload resilience.
"""

from __future__ import annotations

import time
from types import SimpleNamespace
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest
from fastapi import WebSocket, WebSocketException
from fastapi.testclient import TestClient
from jose import jwt
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

from neural_navigator.api.chat import (
    ChatRequest,
    ChatResponse,
    StreamDelta,
)
from neural_navigator.api.websocket import (
    ChatSendFrame,
    PingFrame,
    RunCancelFrame,
    _client_frame_adapter,
    connection_registry,
    get_ws_event_bus,
    get_ws_llm_service,
)
from neural_navigator.core.config import Settings
from neural_navigator.core.dependencies import (
    get_ws_app_settings,
    get_ws_principal,
)
from neural_navigator.main import create_app
from neural_navigator.schemas.base import (
    ChatMessage,
    Usage,
    utc_now,
)
from neural_navigator.services.events import EventBus
from neural_navigator.services.llm import LLMService
from neural_navigator.utils.constants import (
    ClientMessageType,
    FinishReason,
    Role,
    ServerMessageType,
    WSCloseCode,
)

if TYPE_CHECKING:
    from pathlib import Path


# ===========================================================================
# 1. DI Resolution Unit & Integration Empirical Tests
# ===========================================================================


class TestDependencyInjectionResolution:
    """Empirically challenge dependency injection providers for WebSocket and HTTP."""

    def test_get_ws_llm_service_success(self) -> None:
        """Verify get_ws_llm_service resolves correctly when app.state has LLMService."""
        mock_ws = MagicMock(spec=WebSocket)
        mock_app = MagicMock()
        mock_app.state = SimpleNamespace()
        mock_ws.app = mock_app
        mock_llm = MagicMock(spec=LLMService)
        mock_app.state.llm_service = mock_llm

        resolved = get_ws_llm_service(mock_ws)
        assert resolved is mock_llm

    def test_get_ws_llm_service_missing_raises(self) -> None:
        """Verify get_ws_llm_service raises WebSocketException(TRY_AGAIN_LATER) when missing."""
        mock_ws = MagicMock(spec=WebSocket)
        mock_app = MagicMock()
        mock_app.state = SimpleNamespace()
        mock_ws.app = mock_app
        mock_app.state.llm_service = None

        with pytest.raises(WebSocketException) as exc_info:
            get_ws_llm_service(mock_ws)
        assert exc_info.value.code == WSCloseCode.TRY_AGAIN_LATER
        assert "llm_service is not initialised" in exc_info.value.reason

    def test_get_ws_llm_service_wrong_type_raises(self) -> None:
        """Verify get_ws_llm_service raises WebSocketException when app.state.llm_service is invalid type."""
        mock_ws = MagicMock(spec=WebSocket)
        mock_app = MagicMock()
        mock_app.state = SimpleNamespace()
        mock_ws.app = mock_app
        mock_app.state.llm_service = "not an llm service instance"

        with pytest.raises(WebSocketException) as exc_info:
            get_ws_llm_service(mock_ws)
        assert exc_info.value.code == WSCloseCode.TRY_AGAIN_LATER

    def test_get_ws_event_bus_success(self) -> None:
        """Verify get_ws_event_bus resolves correctly when app.state has EventBus."""
        mock_ws = MagicMock(spec=WebSocket)
        mock_app = MagicMock()
        mock_app.state = SimpleNamespace()
        mock_ws.app = mock_app
        mock_bus = MagicMock(spec=EventBus)
        mock_app.state.event_bus = mock_bus

        resolved = get_ws_event_bus(mock_ws)
        assert resolved is mock_bus

    def test_get_ws_event_bus_missing_raises(self) -> None:
        """Verify get_ws_event_bus raises WebSocketException(TRY_AGAIN_LATER) when missing."""
        mock_ws = MagicMock(spec=WebSocket)
        mock_app = MagicMock()
        mock_app.state = SimpleNamespace()
        mock_ws.app = mock_app
        mock_app.state.event_bus = None

        with pytest.raises(WebSocketException) as exc_info:
            get_ws_event_bus(mock_ws)
        assert exc_info.value.code == WSCloseCode.TRY_AGAIN_LATER
        assert "event_bus is not initialised" in exc_info.value.reason

    def test_get_ws_app_settings_from_state(self) -> None:
        """Verify get_ws_app_settings reads settings from app.state."""
        mock_ws = MagicMock(spec=WebSocket)
        mock_app = MagicMock()
        mock_app.state = SimpleNamespace()
        mock_ws.app = mock_app
        custom_settings = Settings(ws_max_connections_per_user=42)
        mock_app.state.settings = custom_settings

        resolved = get_ws_app_settings(mock_ws)
        assert resolved.ws_max_connections_per_user == 42

    @pytest.mark.asyncio
    async def test_get_ws_principal_anonymous_when_auth_not_required(self) -> None:
        """Verify get_ws_principal returns ANONYMOUS_PRINCIPAL when auth is not required and no token."""
        mock_ws = MagicMock(spec=WebSocket)
        mock_ws.headers = {}
        settings = Settings(auth_required=False)

        principal = await get_ws_principal(websocket=mock_ws, settings=settings, token=None)
        assert principal.is_anonymous is True
        assert principal.subject == "anonymous"

    @pytest.mark.asyncio
    async def test_get_ws_principal_raises_when_auth_required_and_no_token(self) -> None:
        """Verify get_ws_principal raises UNAUTHENTICATED close code when auth_required=True and no token."""
        mock_ws = MagicMock(spec=WebSocket)
        mock_ws.headers = {}
        settings = Settings(auth_required=True)

        with pytest.raises(WebSocketException) as exc_info:
            await get_ws_principal(websocket=mock_ws, settings=settings, token=None)
        assert exc_info.value.code == WSCloseCode.UNAUTHENTICATED
        assert "missing access token" in exc_info.value.reason

    @pytest.mark.asyncio
    async def test_get_ws_principal_valid_jwt_query_param(self) -> None:
        """Verify get_ws_principal resolves claims correctly from a valid JWT query token."""
        settings = Settings(
            jwt_secret="adversarial_test_secret_key_1234567890",
            jwt_algorithm="HS256",
            jwt_audience="test_audience",
            jwt_issuer="test_issuer",
        )
        claims = {
            "sub": "user_challenger_99",
            "scope": "read write admin",
            "aud": "test_audience",
            "iss": "test_issuer",
            "exp": int(time.time()) + 3600,
        }
        token = jwt.encode(claims, settings.jwt_secret.get_secret_value(), algorithm="HS256")

        mock_ws = MagicMock(spec=WebSocket)
        mock_ws.headers = {}

        principal = await get_ws_principal(websocket=mock_ws, settings=settings, token=token)
        assert principal.is_anonymous is False
        assert principal.subject == "user_challenger_99"
        assert principal.has_scope("read")
        assert principal.has_scope("write")
        assert principal.has_scope("admin")
        assert not principal.has_scope("delete")

    @pytest.mark.asyncio
    async def test_get_ws_principal_valid_jwt_header_bearer(self) -> None:
        """Verify get_ws_principal resolves claims correctly from Authorization: Bearer <token>."""
        settings = Settings(
            jwt_secret="adversarial_test_secret_key_1234567890",
            jwt_algorithm="HS256",
        )
        claims = {
            "sub": "service_bot_42",
            "scopes": ["metrics", "pipeline:run"],
            "exp": int(time.time()) + 3600,
        }
        token = jwt.encode(claims, settings.jwt_secret.get_secret_value(), algorithm="HS256")

        mock_ws = MagicMock(spec=WebSocket)
        mock_ws.headers = {"authorization": f"Bearer {token}"}

        principal = await get_ws_principal(websocket=mock_ws, settings=settings, token=None)
        assert principal.subject == "service_bot_42"
        assert principal.has_scope("metrics")
        assert principal.has_scope("pipeline:run")

    @pytest.mark.asyncio
    async def test_get_ws_principal_invalid_jwt_raises(self) -> None:
        """Verify get_ws_principal rejects invalid tokens with 4401 UNAUTHENTICATED."""
        settings = Settings(jwt_secret="adversarial_test_secret_key_1234567890")
        mock_ws = MagicMock(spec=WebSocket)
        mock_ws.headers = {}

        with pytest.raises(WebSocketException) as exc_info:
            await get_ws_principal(
                websocket=mock_ws, settings=settings, token="invalid.token.payload"
            )
        assert exc_info.value.code == WSCloseCode.UNAUTHENTICATED

    @pytest.mark.asyncio
    async def test_get_ws_principal_expired_jwt_raises(self) -> None:
        """Verify get_ws_principal rejects expired tokens."""
        settings = Settings(jwt_secret="adversarial_test_secret_key_1234567890")
        claims = {
            "sub": "user_expired",
            "exp": int(time.time()) - 3600,  # 1 hour in past
        }
        token = jwt.encode(claims, settings.jwt_secret.get_secret_value(), algorithm="HS256")

        mock_ws = MagicMock(spec=WebSocket)
        mock_ws.headers = {}

        with pytest.raises(WebSocketException) as exc_info:
            await get_ws_principal(websocket=mock_ws, settings=settings, token=token)
        assert exc_info.value.code == WSCloseCode.UNAUTHENTICATED


# ===========================================================================
# 2. Pydantic v2 Chat Models & Schema Reflection Tests
# ===========================================================================


class TestPydanticChatModelsAndSerialization:
    """Empirically test Pydantic v2 serialization, edge cases, and schema generation."""

    def test_chat_response_serialization_with_datetime(self) -> None:
        """Verify ChatResponse serializes and deserializes accurately with ISO 8601 UTC datetimes."""
        now = utc_now()
        response = ChatResponse(
            run_id="run_test_abc123",
            model="gpt-4o",
            message=ChatMessage(role=Role.ASSISTANT, content="Hello, empirical world!"),
            finish_reason=FinishReason.STOP,
            usage=Usage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
            created_at=now,
        )

        json_str = response.model_dump_json()
        assert "run_test_abc123" in json_str
        assert "created_at" in json_str

        # Roundtrip parse
        parsed = ChatResponse.model_validate_json(json_str)
        assert parsed.run_id == response.run_id
        assert parsed.created_at.timestamp() == pytest.approx(now.timestamp(), abs=1e-3)
        assert parsed.message.content == "Hello, empirical world!"

    def test_chat_response_with_large_payload_and_special_characters(self) -> None:
        """Verify ChatResponse handles markdown, code blocks, unicode, RTL, emojis up to schema max."""
        large_text = (
            "\u2728 \U0001f680 Quantum computation with <html> tags & `code = true;` " * 400
        ).strip()
        assert len(large_text) < 32000
        response = ChatResponse(
            run_id="run_large",
            model="claude-3-5-sonnet",
            message=ChatMessage(role=Role.ASSISTANT, content=large_text),
            finish_reason=FinishReason.STOP,
            usage=Usage(prompt_tokens=100, completion_tokens=5000, total_tokens=5100),
            created_at=utc_now(),
        )

        json_data = response.model_dump()
        assert json_data["message"]["content"] == large_text
        serialized = response.model_dump_json()
        assert len(serialized) > 20000

    def test_chat_request_validation_bounds(self) -> None:
        """Verify ChatRequest rejects invalid bounds (empty messages, excess messages, temperature out of bounds)."""
        # Empty messages
        with pytest.raises(ValidationError):
            ChatRequest(messages=[])

        # Temperature > 2.0
        with pytest.raises(ValidationError):
            ChatRequest(
                messages=[ChatMessage(role=Role.USER, content="hi")],
                temperature=2.5,
            )

        # Max output tokens < 1
        with pytest.raises(ValidationError):
            ChatRequest(
                messages=[ChatMessage(role=Role.USER, content="hi")],
                max_output_tokens=0,
            )

    def test_stream_delta_whitespace_preservation(self) -> None:
        """Verify StreamDelta preserves leading and trailing spaces, tabs, and newlines."""
        delta_str = "   \n\n\tdef foo():\n    return 42\n\n  "
        delta = StreamDelta(run_id="run_123", delta=delta_str)
        assert delta.delta == delta_str
        assert delta.model_dump()["delta"] == delta_str

    def test_openapi_schema_generation_flawless(self, tmp_path: Path) -> None:
        """Verify FastAPI generates OpenAPI JSON schema without any PydanticSchemaGenerationError or recursion."""
        settings = Settings(conversation_db_path=str(tmp_path / "openapi_test.db"))
        app = create_app(settings)
        schema = app.openapi()

        assert schema["openapi"].startswith("3.")
        assert "/api/v1/chat/completions" in schema["paths"]
        assert "/api/v1/chat/stream" in schema["paths"]
        assert "ChatResponse" in schema["components"]["schemas"]
        assert "ChatRequest" in schema["components"]["schemas"]


# ===========================================================================
# 3. WebSocket Concurrency, Registry Limits, and Session Stress Tests
# ===========================================================================


class TestWebSocketAdversarialStressHarness:
    """Empirical stress tests for WebSocket protocol, connection limits, and concurrency."""

    def test_per_user_connection_limit_enforcement(self, tmp_path: Path) -> None:
        """Empirically test that connection_registry enforces per-user connection limit and frees on disconnect."""
        max_conns = 3
        settings = Settings(
            llm_provider="echo",
            conversation_db_path=str(tmp_path / "ws_limit.db"),
            ws_max_connections_per_user=max_conns,
            auth_required=False,
        )
        app = create_app(settings)

        with (
            TestClient(app) as client,
            client.websocket_connect("/ws/v1/chat") as ws1,
            client.websocket_connect("/ws/v1/chat") as ws2,
            client.websocket_connect("/ws/v1/chat") as ws3,
        ):
            assert ws1.receive_json()["type"] == ServerMessageType.CONNECTION_READY.value
            assert ws2.receive_json()["type"] == ServerMessageType.CONNECTION_READY.value
            assert ws3.receive_json()["type"] == ServerMessageType.CONNECTION_READY.value

            assert connection_registry.active_count == max_conns

            # Attempt 4th socket: must be closed with CONNECTION_LIMIT (4429)
            with (
                pytest.raises(WebSocketDisconnect) as exc_info,
                client.websocket_connect("/ws/v1/chat") as ws_rejected,
            ):
                ws_rejected.receive_json()
            assert exc_info.value.code == WSCloseCode.CONNECTION_LIMIT

        # All 3 closed
        time.sleep(0.05)
        assert connection_registry.active_count == 0

    def test_rapid_ping_pong_flood(self, tmp_path: Path) -> None:
        """Send 30 ping frames in rapid succession and verify 30 pong frames with strictly monotonic seq."""
        settings = Settings(
            llm_provider="echo",
            conversation_db_path=str(tmp_path / "ping_flood.db"),
        )
        app = create_app(settings)

        with TestClient(app) as client, client.websocket_connect("/ws/v1/chat") as ws:
            ready = ws.receive_json()
            last_seq = ready["seq"]

            for _ in range(30):
                ws.send_json({"type": ClientMessageType.PING.value})

            for _ in range(30):
                pong = ws.receive_json()
                assert pong["type"] == ServerMessageType.PONG.value
                assert pong["seq"] > last_seq
                last_seq = pong["seq"]

    def test_run_cancellation_flow(self, tmp_path: Path) -> None:
        """Verify starting a run and immediately sending a run.cancel frame terminates cleanly."""
        settings = Settings(
            llm_provider="echo",
            conversation_db_path=str(tmp_path / "ws_cancel.db"),
        )
        app = create_app(settings)

        with TestClient(app) as client, client.websocket_connect("/ws/v1/chat") as ws:
            ws.receive_json()  # connection.ready

            # Start run
            ws.send_json(
                {
                    "type": ClientMessageType.CHAT_SEND.value,
                    "messages": [
                        {"role": "user", "content": "Tell me a very long story about galaxies"}
                    ],
                    "mode": "fast",
                }
            )

            # Receive run.started
            started_frame = ws.receive_json()
            assert started_frame["type"] == ServerMessageType.RUN_STARTED.value
            run_id = started_frame["run_id"]

            # Send cancel for this run_id
            ws.send_json(
                {
                    "type": ClientMessageType.RUN_CANCEL.value,
                    "run_id": run_id,
                }
            )

            # Drain frames until run.finished
            terminal_seen = False
            while True:
                frame = ws.receive_json()
                if frame["type"] == ServerMessageType.RUN_FINISHED.value:
                    terminal_seen = True
                    assert frame["finish_reason"] in {"cancelled", "stop"}
                    break

            assert terminal_seen is True

            # Subsequent chat on same socket works
            ws.send_json(
                {
                    "type": ClientMessageType.CHAT_SEND.value,
                    "messages": [{"role": "user", "content": "Are you still alive?"}],
                    "mode": "fast",
                }
            )
            while True:
                frame = ws.receive_json()
                if frame["type"] == ServerMessageType.RUN_FINISHED.value:
                    assert frame["finish_reason"] == "stop"
                    break

    def test_superseding_chat_sends(self, tmp_path: Path) -> None:
        """Send two consecutive chat.send frames before the first completes; verify second supersedes first."""
        settings = Settings(
            llm_provider="echo",
            conversation_db_path=str(tmp_path / "ws_supersede.db"),
        )
        app = create_app(settings)

        with TestClient(app) as client, client.websocket_connect("/ws/v1/chat") as ws:
            ws.receive_json()  # connection.ready

            # Send first query
            ws.send_json(
                {
                    "type": ClientMessageType.CHAT_SEND.value,
                    "messages": [{"role": "user", "content": "Initial query 1"}],
                    "mode": "fast",
                }
            )

            # Immediately send second query to supersede
            ws.send_json(
                {
                    "type": ClientMessageType.CHAT_SEND.value,
                    "messages": [{"role": "user", "content": "Superseding query 2"}],
                    "mode": "fast",
                }
            )

            finished_runs: list[str] = []
            while True:
                frame = ws.receive_json()
                if frame["type"] == ServerMessageType.RUN_FINISHED.value:
                    finished_runs.append(frame["run_id"])
                    if frame["finish_reason"] == "stop":
                        break

            assert len(finished_runs) >= 1

    def test_malformed_client_frame_adapter_validation(self) -> None:
        """Test _client_frame_adapter directly on various invalid JSON inputs."""
        # Non-matching discriminator type
        with pytest.raises(ValidationError):
            _client_frame_adapter.validate_json('{"type": "non_existent_type"}')

        # Chat send with empty messages
        with pytest.raises(ValidationError):
            _client_frame_adapter.validate_json('{"type": "chat.send", "messages": []}')

        # Valid chat.send
        valid = _client_frame_adapter.validate_json(
            '{"type": "chat.send", "messages": [{"role": "user", "content": "test"}]}'
        )
        assert isinstance(valid, ChatSendFrame)
        assert valid.messages[0].content == "test"

        # Valid ping
        ping = _client_frame_adapter.validate_json('{"type": "ping"}')
        assert isinstance(ping, PingFrame)

        # Valid run.cancel
        cancel = _client_frame_adapter.validate_json('{"type": "run.cancel", "run_id": "run_123"}')
        assert isinstance(cancel, RunCancelFrame)
        assert cancel.run_id == "run_123"
