"""Bidirectional chat over WebSocket.

One socket carries many runs. Frames are JSON objects discriminated on ``type``, and
every server frame carries a monotonic ``seq`` so a reconnecting client can tell
whether it missed anything.

Generation happens in a task separate from the receive loop, which is what makes a
mid-flight cancel possible: the receive loop stays responsive while tokens stream.
When the LangGraph runtime lands it will replace the call to ``LLMService`` inside
``_execute_run`` and emit the same run frames per node.
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import Annotated, Literal

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import Field, TypeAdapter, ValidationError

from neural_navigator.core.config import Settings
from neural_navigator.core.dependencies import (
    EventBusDep,
    LLMServiceDep,
    Principal,
    SettingsDep,
    WSPrincipalDep,
)
from neural_navigator.schemas.base import (
    ChatMessage,
    ConnectionReadyFrame,
    ErrorFrame,
    HeartbeatFrame,
    PongFrame,
    RunFinishedFrame,
    RunStartedFrame,
    RunTokenFrame,
    Usage,
    WSFrame,
    WSServerFrame,
    generate_id,
)
from neural_navigator.services.events import EventBus
from neural_navigator.services.llm import LLMError, LLMService
from neural_navigator.utils.constants import (
    ClientMessageType,
    ErrorCode,
    EventType,
    FinishReason,
    WSCloseCode,
)

router = APIRouter()

_logger = structlog.stdlib.get_logger(__name__)


# --- Client frames ---------------------------------------------------------


class WSClientFrame(WSFrame):
    """Base for client-to-server frames."""


class ChatSendFrame(WSClientFrame):
    type: Literal[ClientMessageType.CHAT_SEND] = ClientMessageType.CHAT_SEND
    messages: list[ChatMessage] = Field(min_length=1, max_length=200)
    model: str | None = Field(default=None, max_length=128)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_output_tokens: int | None = Field(default=None, ge=1, le=32_000)


class RunCancelFrame(WSClientFrame):
    type: Literal[ClientMessageType.RUN_CANCEL] = ClientMessageType.RUN_CANCEL
    run_id: str | None = Field(
        default=None, description="Cancels the active run when omitted."
    )


class PingFrame(WSClientFrame):
    type: Literal[ClientMessageType.PING] = ClientMessageType.PING


ClientFrame = Annotated[
    ChatSendFrame | RunCancelFrame | PingFrame,
    Field(discriminator="type"),
]

_client_frame_adapter: TypeAdapter[ChatSendFrame | RunCancelFrame | PingFrame] = (
    TypeAdapter(ClientFrame)
)


# --- Connection registry ---------------------------------------------------


class ConnectionRegistry:
    """Tracks live sockets in this process.

    Per-user limits are therefore per-process. A cluster-wide limit needs the shared
    counter that ``realtime/broker/`` will own; until then, size the configured limit
    with the replica count in mind.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._sessions: dict[str, ChatSocketSession] = {}
        self._per_subject: dict[str, int] = {}

    @property
    def active_count(self) -> int:
        return len(self._sessions)

    async def register(self, session: ChatSocketSession, *, limit: int) -> bool:
        async with self._lock:
            current = self._per_subject.get(session.subject, 0)
            if current >= limit:
                return False
            self._sessions[session.connection_id] = session
            self._per_subject[session.subject] = current + 1
            return True

    async def unregister(self, session: ChatSocketSession) -> None:
        async with self._lock:
            self._sessions.pop(session.connection_id, None)
            remaining = self._per_subject.get(session.subject, 0) - 1
            if remaining > 0:
                self._per_subject[session.subject] = remaining
            else:
                self._per_subject.pop(session.subject, None)

    async def close_all(self) -> None:
        """Close every live socket, used during application shutdown."""
        async with self._lock:
            sessions = tuple(self._sessions.values())
        for session in sessions:
            await session.shutdown()


connection_registry = ConnectionRegistry()


# --- Session ---------------------------------------------------------------


class ChatSocketSession:
    """Owns one WebSocket connection for its whole lifetime."""

    def __init__(
        self,
        *,
        websocket: WebSocket,
        principal: Principal,
        llm: LLMService,
        events: EventBus,
        settings: Settings,
    ) -> None:
        self._websocket = websocket
        self._principal = principal
        self._llm = llm
        self._events = events
        self._settings = settings

        self.connection_id = generate_id("con")
        self._seq = 0
        # Serialises sends, which the heartbeat and the run task perform concurrently.
        self._send_lock = asyncio.Lock()
        self._run_task: asyncio.Task[None] | None = None
        self._active_run_id: str | None = None
        self._closed = False
        self._log = _logger.bind(
            connection_id=self.connection_id, subject=principal.subject
        )

    @property
    def subject(self) -> str:
        return self._principal.subject

    async def run(self) -> None:
        """Accept the socket and serve it until the peer or the server goes away."""
        await self._websocket.accept()

        admitted = await connection_registry.register(
            self, limit=self._settings.ws_max_connections_per_user
        )
        if not admitted:
            self._log.warning("ws.rejected.connection_limit")
            await self._websocket.close(
                code=WSCloseCode.CONNECTION_LIMIT,
                reason="too many concurrent connections",
            )
            return

        await self._events.emit(
            EventType.CONNECTION_OPENED,
            payload={"connection_id": self.connection_id, "subject": self.subject},
        )
        self._log.info("ws.connected")

        heartbeat = asyncio.create_task(self._heartbeat_loop(), name="ws-heartbeat")
        try:
            await self._send(
                ConnectionReadyFrame(
                    connection_id=self.connection_id,
                    heartbeat_interval_seconds=self._settings.ws_heartbeat_interval_seconds,
                    max_message_bytes=self._settings.ws_message_max_bytes,
                )
            )
            await self._receive_loop()
        except WebSocketDisconnect as exc:
            self._log.info("ws.disconnected", code=exc.code)
        finally:
            heartbeat.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await heartbeat
            await self._cancel_active_run()
            await connection_registry.unregister(self)
            await self._events.emit(
                EventType.CONNECTION_CLOSED,
                payload={"connection_id": self.connection_id, "subject": self.subject},
            )
            self._log.info("ws.closed", frames_sent=self._seq)

    async def shutdown(self) -> None:
        """Close from the server side, e.g. during a rolling deploy."""
        await self._cancel_active_run()
        await self._close(WSCloseCode.SHUTTING_DOWN, "server shutting down")

    # --- Receive path ------------------------------------------------------

    async def _receive_loop(self) -> None:
        while True:
            raw = await self._websocket.receive_text()

            if len(raw.encode("utf-8")) > self._settings.ws_message_max_bytes:
                self._log.warning("ws.frame.too_large", size=len(raw))
                await self._close(
                    WSCloseCode.MESSAGE_TOO_BIG,
                    f"frame exceeds {self._settings.ws_message_max_bytes} bytes",
                )
                return

            try:
                frame = _client_frame_adapter.validate_json(raw)
            except ValidationError as exc:
                await self._send(
                    ErrorFrame(
                        code=ErrorCode.VALIDATION_FAILED,
                        message=f"malformed frame: {exc.error_count()} problem(s)",
                    )
                )
                continue

            await self._dispatch(frame)

    async def _dispatch(self, frame: ChatSendFrame | RunCancelFrame | PingFrame) -> None:
        if isinstance(frame, PingFrame):
            await self._send(PongFrame())
            return
        if isinstance(frame, RunCancelFrame):
            await self._handle_cancel(frame)
            return
        await self._handle_chat_send(frame)

    async def _handle_cancel(self, frame: RunCancelFrame) -> None:
        if frame.run_id is not None and frame.run_id != self._active_run_id:
            await self._send(
                ErrorFrame(
                    code=ErrorCode.NOT_FOUND,
                    message="no such active run",
                    run_id=frame.run_id,
                )
            )
            return
        await self._cancel_active_run()

    async def _handle_chat_send(self, frame: ChatSendFrame) -> None:
        # One run at a time per socket: a second send supersedes the first, which is
        # what the UI's "stop and re-ask" gesture expects.
        await self._cancel_active_run()

        run_id = generate_id("run")
        self._active_run_id = run_id
        self._run_task = asyncio.create_task(
            self._execute_run(run_id, frame), name=f"ws-run-{run_id}"
        )

    # --- Run execution -----------------------------------------------------

    async def _execute_run(self, run_id: str, frame: ChatSendFrame) -> None:
        model = self._llm.resolve_model(frame.model)
        finish_reason = FinishReason.STOP
        usage: Usage | None = None

        await self._events.emit(
            EventType.RUN_STARTED,
            payload={
                "run_id": run_id,
                "connection_id": self.connection_id,
                "subject": self.subject,
                "transport": "websocket",
            },
        )

        try:
            await self._send(RunStartedFrame(run_id=run_id, model=model))
            async for chunk in self._llm.stream_chat(
                frame.messages,
                model=frame.model,
                temperature=frame.temperature,
                max_output_tokens=frame.max_output_tokens,
            ):
                if chunk.delta:
                    await self._send(RunTokenFrame(run_id=run_id, delta=chunk.delta))
                if chunk.finish_reason is not None:
                    finish_reason = chunk.finish_reason
                if chunk.usage is not None:
                    usage = chunk.usage
        except asyncio.CancelledError:
            # The terminal frame is sent by the canceller, not from here: awaiting a
            # send while unwinding a cancellation is not reliably delivered.
            await self._events.emit(EventType.RUN_CANCELLED, payload={"run_id": run_id})
            raise
        except LLMError as exc:
            self._log.error("ws.run.failed", run_id=run_id, error_code=exc.code.value)
            await self._events.emit(
                EventType.RUN_FAILED,
                payload={"run_id": run_id, "error_code": exc.code.value},
            )
            await self._send(
                ErrorFrame(code=exc.code, message=exc.message, run_id=run_id)
            )
            await self._send(
                RunFinishedFrame(run_id=run_id, finish_reason=FinishReason.ERROR)
            )
            return
        else:
            await self._send(
                RunFinishedFrame(
                    run_id=run_id, finish_reason=finish_reason, usage=usage
                )
            )
            await self._events.emit(
                EventType.RUN_COMPLETED,
                payload={
                    "run_id": run_id,
                    "model": model,
                    "total_tokens": usage.total_tokens if usage else 0,
                },
            )
        finally:
            if self._active_run_id == run_id:
                self._active_run_id = None
                self._run_task = None

    async def _cancel_active_run(self) -> None:
        task = self._run_task
        run_id = self._active_run_id
        self._run_task = None
        self._active_run_id = None

        if task is None or task.done():
            return

        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

        if run_id is not None:
            with contextlib.suppress(Exception):
                await self._send(
                    RunFinishedFrame(run_id=run_id, finish_reason=FinishReason.CANCELLED)
                )

    # --- Send path ---------------------------------------------------------

    async def _heartbeat_loop(self) -> None:
        interval = self._settings.ws_heartbeat_interval_seconds
        while True:
            await asyncio.sleep(interval)
            try:
                await self._send(HeartbeatFrame())
            except (WebSocketDisconnect, RuntimeError):
                # The socket is gone; the receive loop will observe it and unwind.
                return

    async def _send(self, frame: WSServerFrame) -> None:
        if self._closed:
            return
        async with self._send_lock:
            self._seq += 1
            frame.seq = self._seq
            await self._websocket.send_text(frame.model_dump_json(exclude_none=True))

    async def _close(self, code: WSCloseCode, reason: str) -> None:
        if self._closed:
            return
        self._closed = True
        with contextlib.suppress(RuntimeError):
            await self._websocket.close(code=code, reason=reason)


# --- Route -----------------------------------------------------------------


@router.websocket("/chat")
async def chat_socket(
    websocket: WebSocket,
    principal: WSPrincipalDep,
    llm: LLMServiceDep,
    events: EventBusDep,
    settings: SettingsDep,
) -> None:
    """Streaming chat channel.

    Authentication runs before the handshake completes, so an invalid token is
    rejected with close code 4401 rather than an accepted-then-closed socket.
    """
    session = ChatSocketSession(
        websocket=websocket,
        principal=principal,
        llm=llm,
        events=events,
        settings=settings,
    )
    await session.run()
