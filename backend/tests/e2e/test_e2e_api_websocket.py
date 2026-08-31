"""Tier 1-4 End-to-End Test Suite for Neural Navigator API & WebSocket Transports.

Opaque-box, requirement-driven tests covering:
- Tier 1: Feature Coverage (WebSocket Handshake, Ping/Pong, Full Lifecycle, Multi-run, REST Chat, SSE Stream, Conversations CRUD, Health)
- Tier 2: Boundary & Corner Cases (Oversized payload rejection, Malformed JSON frames, RFC 9457 error details, Missing resources)
- Tier 3: Pairwise Combinations (Modes x Models x Parameters across WebSocket & REST)
- Tier 4: Real-World Workload Scenarios (Degraded Upstream LLM Timeout Recovery, High-Concurrency Multi-Tenant Session Isolation)
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from neural_navigator.core.config import Settings
from neural_navigator.domain.models.research import generate_id
from neural_navigator.main import create_app
from neural_navigator.services.llm import (
    LLMChunk,
    LLMService,
    LLMTimeoutError,
)
from neural_navigator.utils.constants import (
    ClientMessageType,
    ErrorCode,
    FinishReason,
    Role,
    ServerMessageType,
)

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator, Generator, Sequence
    from pathlib import Path

    from neural_navigator.schemas.base import ChatMessage

# ---------------------------------------------------------------------------
# Fixtures & Test Providers
# ---------------------------------------------------------------------------


class PersistentTimeoutLLMProvider:
    """Mock LLM Provider that consistently raises LLMTimeoutError to test exhausted retry handling."""

    name = "mock_persistent_timeout_provider"

    def __init__(self, fail_first_n: int = 10) -> None:
        self.fail_first_n = fail_first_n
        self.call_count = 0

    async def stream_chat(
        self,
        messages: Sequence[ChatMessage],
        *,
        model: str,
        temperature: float,
        max_output_tokens: int,
    ) -> AsyncGenerator[LLMChunk, None]:
        self.call_count += 1
        if self.call_count <= self.fail_first_n:
            raise LLMTimeoutError("Upstream model gateway timed out after 30.0s")

        prompt = next((m.content for m in reversed(messages) if m.role is Role.USER), "")
        yield LLMChunk(delta=f"Recovered response to: {prompt}")
        yield LLMChunk(finish_reason=FinishReason.STOP)

    async def aclose(self) -> None:
        pass


@pytest.fixture
def app_settings(tmp_path: Path) -> Settings:
    db_file = tmp_path / f"test_conv_{generate_id('db')}.db"
    return Settings(
        llm_provider="echo",
        llm_model="mock-gpt-4o",
        conversation_db_path=str(db_file),
        ws_message_max_bytes=16384,
        ws_heartbeat_interval_seconds=30,
        ws_max_connections_per_user=10,
    )


@pytest.fixture
def test_client(app_settings: Settings) -> Generator[TestClient, None, None]:
    app = create_app(app_settings)
    with TestClient(app) as client:
        yield client


# ===========================================================================
# Tier 1: Feature Coverage (>=5 tests per core transport feature)
# ===========================================================================


# --- Feature 7: WebSocket Protocol & Chat Session ---


def test_tier1_ws_connection_ready_handshake(test_client: TestClient) -> None:
    """Verifies that connecting to /ws/v1/chat immediately issues a connection.ready frame."""
    with test_client.websocket_connect("/ws/v1/chat") as ws:
        ready_frame = ws.receive_json()
        assert ready_frame["type"] == ServerMessageType.CONNECTION_READY.value
        assert "connection_id" in ready_frame
        assert ready_frame["heartbeat_interval_seconds"] > 0
        assert ready_frame["max_message_bytes"] > 0
        assert ready_frame["seq"] == 1


def test_tier1_ws_ping_pong_heartbeat(test_client: TestClient) -> None:
    """Verifies that sending a client ping frame returns a server pong frame."""
    with test_client.websocket_connect("/ws/v1/chat") as ws:
        ws.receive_json()  # Consume connection.ready
        ws.send_json({"type": ClientMessageType.PING.value})
        pong_frame = ws.receive_json()
        assert pong_frame["type"] == ServerMessageType.PONG.value
        assert pong_frame["seq"] == 2


def test_tier1_ws_chat_send_full_lifecycle(test_client: TestClient) -> None:
    """Verifies full WebSocket run lifecycle: run.started -> stages -> tokens -> run.finished."""
    with test_client.websocket_connect("/ws/v1/chat") as ws:
        ws.receive_json()  # connection.ready

        payload = {
            "type": ClientMessageType.CHAT_SEND.value,
            "messages": [{"role": "user", "content": "Calculate 25 * 4"}],
            "mode": "fast",
        }
        ws.send_json(payload)

        frames: list[dict[str, Any]] = []
        tokens: list[str] = []

        while True:
            frame = ws.receive_json()
            frames.append(frame)
            if frame["type"] == ServerMessageType.RUN_TOKEN.value:
                tokens.append(frame.get("delta", ""))
            elif frame["type"] == ServerMessageType.RUN_FINISHED.value:
                break

        frame_types = [f["type"] for f in frames]
        assert ServerMessageType.RUN_STARTED.value in frame_types
        assert ServerMessageType.STAGE_STARTED.value in frame_types
        assert ServerMessageType.STAGE_COMPLETE.value in frame_types
        assert ServerMessageType.RUN_FINISHED.value in frame_types

        finished_frame = frames[-1]
        assert finished_frame["finish_reason"] == "stop"
        assert finished_frame["mode"] == "fast"
        assert "orchestration" in finished_frame
        assert len(tokens) >= 1


def test_tier1_ws_conversation_attachment_and_persistence(
    test_client: TestClient, app_settings: Settings
) -> None:
    """Verifies that providing conversation_id saves user and assistant messages to SQLite."""
    # 1. Create a conversation via REST
    create_resp = test_client.post("/api/v1/conversations", json={"title": "WebSocket Session"})
    assert create_resp.status_code == 201
    conv_id = create_resp.json()["id"]

    # 2. Run chat turn over WebSocket
    with test_client.websocket_connect("/ws/v1/chat") as ws:
        ws.receive_json()  # ready
        ws.send_json(
            {
                "type": ClientMessageType.CHAT_SEND.value,
                "messages": [{"role": "user", "content": "Explain quantum superposition"}],
                "mode": "fast",
                "conversation_id": conv_id,
            }
        )

        while True:
            frame = ws.receive_json()
            if frame["type"] == ServerMessageType.RUN_FINISHED.value:
                break

    # 3. Retrieve conversation from REST and verify saved messages
    conv_detail = test_client.get(f"/api/v1/conversations/{conv_id}").json()
    messages = conv_detail["messages"]
    assert len(messages) >= 2
    assert messages[0]["role"] == "user"
    assert "quantum superposition" in messages[0]["content"].lower()
    assert messages[1]["role"] == "assistant"
    assert len(messages[1]["content"]) > 0


def test_tier1_ws_multiple_sequential_runs(test_client: TestClient) -> None:
    """Verifies executing multiple sequential runs over a single WebSocket connection with monotonic sequence numbers."""
    with test_client.websocket_connect("/ws/v1/chat") as ws:
        ws.receive_json()  # ready

        for turn in range(3):
            ws.send_json(
                {
                    "type": ClientMessageType.CHAT_SEND.value,
                    "messages": [{"role": "user", "content": f"Turn number {turn}"}],
                    "mode": "fast",
                }
            )
            while True:
                frame = ws.receive_json()
                if frame["type"] == ServerMessageType.RUN_FINISHED.value:
                    assert frame["seq"] > turn
                    break


# --- Feature 8: REST Endpoints & Streaming ---


def test_tier1_rest_chat_buffered_endpoint(test_client: TestClient) -> None:
    """Verifies POST /api/v1/chat/completions returns full non-streaming ChatResponse."""
    payload = {
        "messages": [{"role": "user", "content": "What is 10 + 20?"}],
        "model": "mock-gpt-4o",
        "temperature": 0.5,
    }
    resp = test_client.post("/api/v1/chat/completions", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "run_id" in data
    assert data["message"]["role"] == "assistant"
    assert "10 + 20" in data["message"]["content"]
    assert data["finish_reason"] == "stop"
    assert "usage" in data


def test_tier1_rest_chat_stream_sse_endpoint(test_client: TestClient) -> None:
    """Verifies POST /api/v1/chat/stream returns valid Server-Sent Events stream."""
    payload = {
        "messages": [{"role": "user", "content": "Explain photosynthesis"}],
    }
    with test_client.stream("POST", "/api/v1/chat/stream", json=payload) as resp:
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]
        events = list(resp.iter_lines())

    assert any(line.startswith("data: ") for line in events)
    assert any("[DONE]" in line for line in events)


def test_tier1_rest_conversations_crud_lifecycle(test_client: TestClient) -> None:
    """Verifies complete CRUD operations on /api/v1/conversations."""
    # 1. Create
    create_res = test_client.post("/api/v1/conversations", json={"title": "Test Thread"})
    assert create_res.status_code == 201
    conv = create_res.json()
    conv_id = conv["id"]
    assert conv["title"] == "Test Thread"

    # 2. List
    list_res = test_client.get("/api/v1/conversations")
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert any(item["id"] == conv_id for item in items)

    # 3. Get Detail
    get_res = test_client.get(f"/api/v1/conversations/{conv_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == conv_id

    # 4. Rename (PATCH)
    patch_res = test_client.patch(
        f"/api/v1/conversations/{conv_id}", json={"title": "Renamed Thread"}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Renamed Thread"

    # 5. Delete
    del_res = test_client.delete(f"/api/v1/conversations/{conv_id}")
    assert del_res.status_code == 204

    # 6. Verify Deleted
    assert test_client.get(f"/api/v1/conversations/{conv_id}").status_code == 404


def test_tier1_rest_health_probes(test_client: TestClient) -> None:
    """Verifies /health/live and /health/ready endpoints for orchestrators and container probes."""
    live_resp = test_client.get("/health/live")
    assert live_resp.status_code == 200
    live_data = live_resp.json()
    assert live_data["status"] == "ok"
    assert "uptime_seconds" in live_data

    ready_resp = test_client.get("/health/ready")
    assert ready_resp.status_code == 200
    ready_data = ready_resp.json()
    assert ready_data["status"] == "ok"
    assert ready_data["checks"]["llm_service"] is True
    assert ready_data["checks"]["event_bus"] is True


def test_tier1_rest_cors_and_request_id_headers(test_client: TestClient) -> None:
    """Verifies X-Request-ID propagation and CORS headers on HTTP responses."""
    custom_id = "req_custom_test_12345"
    resp = test_client.get(
        "/health/live",
        headers={"X-Request-ID": custom_id, "Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 200
    assert resp.headers.get("x-request-id") == custom_id
    assert resp.headers.get("access-control-allow-origin") in {"*", "http://localhost:5173"}


# ===========================================================================
# Tier 2: Boundary & Corner Cases (>=5 tests)
# ===========================================================================


def test_tier2_boundary_oversized_payload_rejection(test_client: TestClient) -> None:
    """Verifies that sending a WebSocket frame larger than ws_message_max_bytes closes socket with MESSAGE_TOO_BIG."""
    with test_client.websocket_connect("/ws/v1/chat") as ws:
        ws.receive_json()  # ready
        huge_content = "X" * 32000  # exceeds 16KB limit in app_settings
        with pytest.raises(WebSocketDisconnect) as exc_info:
            ws.send_text(huge_content)
            ws.receive_text()
        assert exc_info.value.code in {1009, 1000, 1008, 4409}


def test_tier2_boundary_invalid_json_frame(test_client: TestClient) -> None:
    """Verifies that sending invalid JSON over WebSocket receives a validation error frame without dropping connection."""
    with test_client.websocket_connect("/ws/v1/chat") as ws:
        ws.receive_json()  # ready
        ws.send_text("THIS IS NOT VALID JSON")
        error_frame = ws.receive_json()
        assert error_frame["type"] == ServerMessageType.ERROR.value
        assert error_frame["code"] == ErrorCode.VALIDATION_FAILED.value


def test_tier2_boundary_unknown_frame_type(test_client: TestClient) -> None:
    """Verifies that sending an unrecognized frame type receives validation failure frame."""
    with test_client.websocket_connect("/ws/v1/chat") as ws:
        ws.receive_json()  # ready
        ws.send_json({"type": "unrecognized_custom_type", "data": 123})
        error_frame = ws.receive_json()
        assert error_frame["type"] == ServerMessageType.ERROR.value
        assert error_frame["code"] == ErrorCode.VALIDATION_FAILED.value


def test_tier2_boundary_rfc9457_validation_error(test_client: TestClient) -> None:
    """Verifies that HTTP validation errors return RFC 9457 ProblemDetail payloads."""
    resp = test_client.post("/api/v1/chat/completions", json={"messages": []})
    assert resp.status_code == 422
    problem = resp.json()
    assert problem["status"] == 422
    assert problem["code"] == ErrorCode.VALIDATION_FAILED.value
    assert "errors" in problem
    assert len(problem["errors"]) >= 1


def test_tier2_boundary_conversation_not_found(test_client: TestClient) -> None:
    """Verifies that requests for missing conversation IDs return 404 ProblemDetail."""
    resp = test_client.get("/api/v1/conversations/non_existent_conv_id")
    assert resp.status_code == 404
    problem = resp.json()
    assert problem["status"] == 404
    assert problem["code"] == ErrorCode.NOT_FOUND.value


# ===========================================================================
# Tier 3: Pairwise Combinations (>=10 tests)
# ===========================================================================


@pytest.mark.parametrize(
    ("mode", "prompt", "max_tokens", "temperature"),
    [
        ("fast", "What is 5 * 5?", 128, 0.2),
        ("fast", "Explain binary search", 512, 0.7),
        ("deep_research", "Analyze surface code fault tolerance", 1024, 0.5),
        ("deep_research", "Compare PostgreSQL vs DynamoDB", 2048, 0.8),
        ("fast", "Hello!", None, None),
    ],
)
def test_tier3_pairwise_websocket_parameters(
    mode: str,
    prompt: str,
    max_tokens: int | None,
    temperature: float | None,
    test_client: TestClient,
) -> None:
    """Pairwise combination of mode, token limit, and temperature over WebSocket."""
    with test_client.websocket_connect("/ws/v1/chat") as ws:
        ws.receive_json()  # ready
        ws.send_json(
            {
                "type": ClientMessageType.CHAT_SEND.value,
                "messages": [{"role": "user", "content": prompt}],
                "mode": mode,
                "max_output_tokens": max_tokens,
                "temperature": temperature,
            }
        )

        while True:
            frame = ws.receive_json()
            if frame["type"] == ServerMessageType.RUN_FINISHED.value:
                assert frame["finish_reason"] in {"stop", "length"}
                assert frame["mode"] == mode
                break


@pytest.mark.parametrize(
    ("model", "max_tokens", "temperature"),
    [
        ("mock-gpt-4o", 64, 0.0),
        ("mock-gpt-4o-mini", 256, 1.0),
        (None, 512, 0.7),
        ("mock-claude-3-5", 128, 0.3),
        (None, None, None),
    ],
)
def test_tier3_pairwise_rest_chat_parameters(
    model: str | None,
    max_tokens: int | None,
    temperature: float | None,
    test_client: TestClient,
) -> None:
    """Pairwise combination of model name, token bounds, and temperature over REST."""
    payload: dict[str, Any] = {
        "messages": [{"role": "user", "content": "Compute sqrt(100)"}],
    }
    if model:
        payload["model"] = model
    if max_tokens:
        payload["max_output_tokens"] = max_tokens
    if temperature is not None:
        payload["temperature"] = temperature

    resp = test_client.post("/api/v1/chat/completions", json=payload)
    assert resp.status_code == 200
    assert resp.json()["finish_reason"] == "stop"


# ===========================================================================
# Tier 4: Real-World Workload Scenarios
# ===========================================================================


def test_tier4_workload_degraded_upstream_timeout_recovery(tmp_path: Path) -> None:
    """Tier 4 Real-World Scenario 4: Degraded Network & Upstream LLM Timeout Recovery.

    Simulates:
    1. Upstream LLM gateway timeout during a WebSocket chat run with exhausted retries.
    2. Verifies server delivers error frame with ErrorCode.UPSTREAM_TIMEOUT and run.finished without dropping the socket.
    3. Retries immediate second chat turn on the SAME connection; verifies graceful recovery and successful stream.
    """
    settings = Settings(
        llm_provider="echo",
        conversation_db_path=str(tmp_path / "timeout_test.db"),
    )
    app = create_app(settings)

    # Provider that fails 10 consecutive attempts (exhausting LLMService retries)
    flaky_provider = PersistentTimeoutLLMProvider(fail_first_n=10)
    custom_llm = LLMService(provider=flaky_provider, settings=settings)

    with TestClient(app) as client:
        # Override app state LLM with failing service
        app.state.llm_service = custom_llm

        with client.websocket_connect("/ws/v1/chat") as ws:
            ws.receive_json()  # connection.ready

            # 1. First run triggers upstream timeout failure
            ws.send_json(
                {
                    "type": ClientMessageType.CHAT_SEND.value,
                    "messages": [{"role": "user", "content": "Run 1: Trigger timeout"}],
                    "mode": "fast",
                }
            )

            saw_error = False
            while True:
                frame = ws.receive_json()
                if frame["type"] == ServerMessageType.ERROR.value:
                    saw_error = True
                    assert frame["code"] in {
                        ErrorCode.UPSTREAM_TIMEOUT.value,
                        ErrorCode.UPSTREAM_ERROR.value,
                    }
                elif frame["type"] == ServerMessageType.RUN_FINISHED.value:
                    assert frame["finish_reason"] == "error"
                    break

            assert saw_error is True

            # 2. Reset provider to succeed on next turn
            flaky_provider.fail_first_n = 0

            # 3. Immediate retry on the same live socket succeeds
            ws.send_json(
                {
                    "type": ClientMessageType.CHAT_SEND.value,
                    "messages": [{"role": "user", "content": "Run 2: Successful retry turn"}],
                    "mode": "fast",
                }
            )

            tokens: list[str] = []
            while True:
                frame = ws.receive_json()
                if frame["type"] == ServerMessageType.RUN_TOKEN.value:
                    tokens.append(frame.get("delta", ""))
                elif frame["type"] == ServerMessageType.RUN_FINISHED.value:
                    assert frame["finish_reason"] == "stop"
                    break

            full_resp = "".join(tokens)
            assert "Recovered response to: Run 2" in full_resp


def test_tier4_workload_multi_tenant_session_isolation(test_client: TestClient) -> None:
    """Tier 4 Real-World Scenario 5: High-Concurrency Multi-Tenant Session with Isolation.

    Simulates:
    1. Tenant Alpha and Tenant Beta opening concurrent WebSocket sessions.
    2. Separate conversations attached to each tenant.
    3. Interleaved execution of runs.
    4. Verification of strict zero state bleed between conversation histories and session frames.
    """
    # Create conversations for Tenant A and Tenant B
    conv_a = test_client.post("/api/v1/conversations", json={"title": "Tenant Alpha Space"}).json()[
        "id"
    ]
    conv_b = test_client.post("/api/v1/conversations", json={"title": "Tenant Beta Space"}).json()[
        "id"
    ]

    with (
        test_client.websocket_connect("/ws/v1/chat") as ws_a,
        test_client.websocket_connect("/ws/v1/chat") as ws_b,
    ):
        ready_a = ws_a.receive_json()
        ready_b = ws_b.receive_json()

        assert ready_a["connection_id"] != ready_b["connection_id"]

        # Tenant A sends query
        ws_a.send_json(
            {
                "type": ClientMessageType.CHAT_SEND.value,
                "messages": [{"role": "user", "content": "Alpha Confidential Research Data"}],
                "mode": "fast",
                "conversation_id": conv_a,
            }
        )

        # Tenant B sends query
        ws_b.send_json(
            {
                "type": ClientMessageType.CHAT_SEND.value,
                "messages": [{"role": "user", "content": "Beta Public Telemetry Metrics"}],
                "mode": "fast",
                "conversation_id": conv_b,
            }
        )

        # Drain Tenant A
        tokens_a: list[str] = []
        while True:
            frame_a = ws_a.receive_json()
            if frame_a["type"] == ServerMessageType.RUN_TOKEN.value:
                tokens_a.append(frame_a.get("delta", ""))
            elif frame_a["type"] == ServerMessageType.RUN_FINISHED.value:
                break

        # Drain Tenant B
        tokens_b: list[str] = []
        while True:
            frame_b = ws_b.receive_json()
            if frame_b["type"] == ServerMessageType.RUN_TOKEN.value:
                tokens_b.append(frame_b.get("delta", ""))
            elif frame_b["type"] == ServerMessageType.RUN_FINISHED.value:
                break

        assert "Alpha Confidential" in "".join(tokens_a)
        assert "Beta Public" in "".join(tokens_b)

    # Verify conversation isolation
    detail_a = test_client.get(f"/api/v1/conversations/{conv_a}").json()
    detail_b = test_client.get(f"/api/v1/conversations/{conv_b}").json()

    assert all("Beta" not in m["content"] for m in detail_a["messages"])
    assert all("Alpha" not in m["content"] for m in detail_b["messages"])
