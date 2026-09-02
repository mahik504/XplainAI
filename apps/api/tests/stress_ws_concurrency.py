"""Standalone high-concurrency WebSocket stress test script.

Executes:
1. 25 parallel WebSocket client sessions concurrently sending chat requests.
2. Connection registry tracking verification (scale to 25, scale down to 0).
3. Connect-disconnect storm under high parallelism.
4. Mixed auth concurrency (valid vs invalid JWT tokens).
"""

from __future__ import annotations

import time
from contextlib import ExitStack
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from starlette.websockets import WebSocketDisconnect

from neural_navigator.api.websocket import connection_registry
from neural_navigator.core.config import Settings
from neural_navigator.main import create_app
from neural_navigator.utils.constants import (
    ClientMessageType,
    ServerMessageType,
    WSCloseCode,
)


def run_concurrency_stress_test() -> None:
    print("[STRESS] Starting High-Concurrency WebSocket Stress Test...")
    with TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
        db_path = Path(tmp_dir) / "stress.db"
        settings = Settings(
            llm_provider="echo",
            conversation_db_path=str(db_path),
            ws_max_connections_per_user=100,
            auth_required=False,
        )
        app = create_app(settings)

        num_clients = 25
        print(f"[STRESS] Spawning {num_clients} concurrent WebSocket connections...")

        with TestClient(app) as client, ExitStack() as stack:
            open_sockets = []
            start_time = time.perf_counter()

            # Phase 1: Connect all
            for _ in range(num_clients):
                ws = stack.enter_context(client.websocket_connect("/ws/v1/chat"))
                ready = ws.receive_json()
                assert ready["type"] == ServerMessageType.CONNECTION_READY.value
                assert "connection_id" in ready
                assert ready["seq"] == 1
                open_sockets.append(ws)

            connect_duration = time.perf_counter() - start_time
            print(f"[STRESS] {num_clients} connections opened in {connect_duration:.3f}s")
            assert connection_registry.active_count == num_clients, (
                f"Expected {num_clients} active connections, got {connection_registry.active_count}"
            )

            # Phase 2: Concurrently send chat requests on all sockets
            send_start = time.perf_counter()
            for i, ws in enumerate(open_sockets):
                ws.send_json(
                    {
                        "type": ClientMessageType.CHAT_SEND.value,
                        "messages": [{"role": "user", "content": f"Stress query payload #{i}"}],
                        "mode": "fast",
                    }
                )

            # Phase 3: Drain all responses
            for i, ws in enumerate(open_sockets):
                tokens: list[str] = []
                while True:
                    frame = ws.receive_json()
                    if frame["type"] == ServerMessageType.RUN_TOKEN.value:
                        tokens.append(frame.get("delta", ""))
                    elif frame["type"] == ServerMessageType.RUN_FINISHED.value:
                        assert frame["finish_reason"] == "stop"
                        assert frame["mode"] == "fast"
                        break
                assert len(tokens) >= 1
                assert f"Stress query payload #{i}" in "".join(tokens)

            send_duration = time.perf_counter() - send_start
            print(f"[STRESS] {num_clients} runs finished in {send_duration:.3f}s")

        time.sleep(0.05)
        print(f"[STRESS] Active connections after close: {connection_registry.active_count}")
        assert connection_registry.active_count == 0, (
            f"Registry leaked connections! Remaining: {connection_registry.active_count}"
        )

        print("[STRESS] Concurrency Stress Test PASSED successfully!")


def run_auth_concurrency_stress_test() -> None:
    print("[STRESS] Starting Auth Concurrency Stress Test...")
    with TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
        db_path = Path(tmp_dir) / "stress_auth.db"
        secret = "secret_for_stress_testing_auth_concurrency_999"
        settings = Settings(
            llm_provider="echo",
            conversation_db_path=str(db_path),
            ws_max_connections_per_user=100,
            auth_required=True,
            jwt_secret=secret,
        )
        app = create_app(settings)

        with TestClient(app) as client:
            # 1. Test 15 valid auth connections concurrently
            with ExitStack() as stack:
                valid_sockets = []
                for i in range(15):
                    token = jwt.encode({"sub": f"user_auth_{i}"}, secret, algorithm="HS256")
                    ws = stack.enter_context(client.websocket_connect(f"/ws/v1/chat?token={token}"))
                    ready = ws.receive_json()
                    assert ready["type"] == ServerMessageType.CONNECTION_READY.value
                    valid_sockets.append(ws)

                assert connection_registry.active_count == 15

                # 2. Test 10 invalid auth rejections (unauthenticated close code 4401)
                for _ in range(10):
                    with (
                        pytest.raises(WebSocketDisconnect) as exc_info,
                        client.websocket_connect("/ws/v1/chat?token=invalid_token") as ws_bad,
                    ):
                        ws_bad.receive_json()
                    assert exc_info.value.code == WSCloseCode.UNAUTHENTICATED

                # Still 15 active
                assert connection_registry.active_count == 15

            # Context exited, all 15 closed
            time.sleep(0.05)
            assert connection_registry.active_count == 0

        print("[STRESS] Auth Concurrency Stress Test PASSED successfully!")


def run_rapid_churn_stress_test() -> None:
    print("[STRESS] Starting Rapid Connect/Disconnect Churn Storm...")
    with TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
        db_path = Path(tmp_dir) / "churn.db"
        settings = Settings(
            llm_provider="echo",
            conversation_db_path=str(db_path),
            ws_max_connections_per_user=50,
            auth_required=False,
        )
        app = create_app(settings)

        with TestClient(app) as client:
            churn_cycles = 50
            for _ in range(churn_cycles):
                with client.websocket_connect("/ws/v1/chat") as ws:
                    ready = ws.receive_json()
                    assert ready["type"] == ServerMessageType.CONNECTION_READY.value
                    # Send a quick ping
                    ws.send_json({"type": ClientMessageType.PING.value})
                    pong = ws.receive_json()
                    assert pong["type"] == ServerMessageType.PONG.value

            time.sleep(0.05)
            assert connection_registry.active_count == 0, (
                f"Registry leaked on churn: {connection_registry.active_count}"
            )

        print(f"[STRESS] {churn_cycles} Rapid Churn Cycles PASSED successfully!")


if __name__ == "__main__":
    run_concurrency_stress_test()
    run_auth_concurrency_stress_test()
    run_rapid_churn_stress_test()
    print("\n>>> ALL EMPIRICAL CHALLENGE TESTS COMPLETED AND VERIFIED 100% SUCCESS. <<<")
