"""Pydantic v2 building blocks shared by every transport.

Endpoint-specific request and response models live next to their routes; this module
holds only the pieces that more than one of them needs.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from neural_navigator.utils.constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    PROTOCOL_VERSION,
    ErrorCode,
    FinishReason,
    Role,
    ServerMessageType,
)

ItemT = TypeVar("ItemT")


def utc_now() -> datetime:
    """Timezone-aware current time. Naive datetimes are never allowed to enter."""
    return datetime.now(UTC)


def generate_id(prefix: str) -> str:
    """Prefixed identifier, e.g. ``run_1f0c...``.

    The prefix makes an id self-describing in logs and in customer bug reports,
    which is worth the eight extra bytes.
    """
    return f"{prefix}_{uuid.uuid4().hex}"


class BaseSchema(BaseModel):
    """Strict base for every model that crosses a process boundary.

    ``extra="forbid"`` is deliberate: silently accepting unknown fields is how a
    client typo becomes a support ticket six weeks later.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
        from_attributes=True,
        ser_json_timedelta="float",
    )


class ErrorItem(BaseSchema):
    """One field-level validation failure."""

    location: str = Field(description="Dotted path to the offending field.")
    message: str
    type: str


class ProblemDetail(BaseSchema):
    """RFC 9457 problem details, extended with a stable machine-readable code."""

    type: str = Field(default="about:blank", description="URI identifying the problem type.")
    title: str
    status: int = Field(ge=100, le=599)
    detail: str | None = None
    instance: str | None = Field(default=None, description="Path of the failing request.")
    code: ErrorCode = ErrorCode.INTERNAL_ERROR
    request_id: str | None = None
    errors: list[ErrorItem] = Field(default_factory=list)


class HealthResponse(BaseSchema):
    status: Literal["ok", "degraded"] = "ok"
    service: str
    version: str
    environment: str
    uptime_seconds: float = Field(ge=0)
    checks: dict[str, bool] = Field(default_factory=dict)


class PaginationParams(BaseSchema):
    """Offset pagination, bounded so a client cannot ask for the whole table."""

    limit: int = Field(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
    offset: int = Field(default=0, ge=0)


class PageMeta(BaseSchema):
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)
    has_more: bool


class Page(BaseSchema, Generic[ItemT]):
    items: list[ItemT]
    meta: PageMeta


class Usage(BaseSchema):
    """Token accounting for a single model call."""

    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)


class ChatMessage(BaseSchema):
    """A single turn in a conversation, in provider-neutral form."""

    role: Role
    content: str = Field(min_length=1, max_length=32_000)
    name: str | None = Field(default=None, max_length=128)


# --- WebSocket envelope ----------------------------------------------------
#
# Every frame carries a discriminant `type`, a monotonic `seq` and a timestamp. The
# sequence number lets a client detect a gap after a reconnect; `run_id` on the run
# frames is what a graph runtime will use to interleave output from concurrent runs
# on one socket.


class WSFrame(BaseSchema):
    id: str = Field(default_factory=lambda: generate_id("frm"))
    seq: int = Field(default=0, ge=0)
    ts: datetime = Field(default_factory=utc_now)


class WSServerFrame(WSFrame):
    """Base for server-to-client frames."""


class ConnectionReadyFrame(WSServerFrame):
    type: Literal[ServerMessageType.CONNECTION_READY] = ServerMessageType.CONNECTION_READY
    connection_id: str
    protocol_version: int = PROTOCOL_VERSION
    heartbeat_interval_seconds: float
    max_message_bytes: int


class RunStartedFrame(WSServerFrame):
    type: Literal[ServerMessageType.RUN_STARTED] = ServerMessageType.RUN_STARTED
    run_id: str
    model: str


class RunTokenFrame(WSServerFrame):
    # Whitespace stripping is disabled here: a delta is a verbatim slice of model
    # output, and trimming it silently welds adjacent tokens together.
    model_config = ConfigDict(str_strip_whitespace=False)

    type: Literal[ServerMessageType.RUN_TOKEN] = ServerMessageType.RUN_TOKEN
    run_id: str
    delta: str


class RunFinishedFrame(WSServerFrame):
    type: Literal[ServerMessageType.RUN_FINISHED] = ServerMessageType.RUN_FINISHED
    run_id: str
    finish_reason: FinishReason
    usage: Usage | None = None
    mode: str | None = None
    orchestration: dict[str, object] | None = None


class StageStartedFrame(WSServerFrame):
    type: Literal[ServerMessageType.STAGE_STARTED] = ServerMessageType.STAGE_STARTED
    run_id: str
    stage: str
    detail: dict[str, object] | None = None


class StageCompleteFrame(WSServerFrame):
    type: Literal[ServerMessageType.STAGE_COMPLETE] = ServerMessageType.STAGE_COMPLETE
    run_id: str
    stage: str
    result: dict[str, object] | None = None


class HeartbeatFrame(WSServerFrame):
    type: Literal[ServerMessageType.HEARTBEAT] = ServerMessageType.HEARTBEAT


class PongFrame(WSServerFrame):
    type: Literal[ServerMessageType.PONG] = ServerMessageType.PONG


class ErrorFrame(WSServerFrame):
    type: Literal[ServerMessageType.ERROR] = ServerMessageType.ERROR
    code: ErrorCode
    message: str
    run_id: str | None = None


ServerFrame = Annotated[
    ConnectionReadyFrame
    | RunStartedFrame
    | RunTokenFrame
    | RunFinishedFrame
    | StageStartedFrame
    | StageCompleteFrame
    | HeartbeatFrame
    | PongFrame
    | ErrorFrame,
    Field(discriminator="type"),
]


def problem_from_exception(
    *,
    status: int,
    title: str,
    code: ErrorCode,
    detail: str | None = None,
    instance: str | None = None,
    request_id: str | None = None,
    errors: list[ErrorItem] | None = None,
) -> ProblemDetail:
    """Construct a problem document with consistent defaults."""
    return ProblemDetail(
        title=title,
        status=status,
        code=code,
        detail=detail,
        instance=instance,
        request_id=request_id,
        errors=errors or [],
    )


def serialise_problem(problem: ProblemDetail) -> dict[str, Any]:
    return problem.model_dump(mode="json", exclude_none=True)
