"""Protocol-level constants shared by transports, services and workers.

The enum *values* in this module are part of the wire contract. Renaming a member is
a refactor; changing its value is a breaking change for every connected client and
must go through the versioning process described in ``shared/README.md``.
"""

from __future__ import annotations

from enum import IntEnum, StrEnum
from typing import Final

SERVICE_NAME: Final = "xplainai-api"
PROTOCOL_VERSION: Final = 1

API_V1_PREFIX: Final = "/api/v1"
WS_V1_PREFIX: Final = "/ws/v1"

HEADER_REQUEST_ID: Final = "X-Request-ID"
HEADER_CORRELATION_ID: Final = "X-Correlation-ID"
HEADER_RESPONSE_TIME: Final = "X-Response-Time-Ms"

SSE_MEDIA_TYPE: Final = "text/event-stream"
SSE_DONE_SENTINEL: Final = "[DONE]"

DEFAULT_PAGE_SIZE: Final = 20
MAX_PAGE_SIZE: Final = 100

#: Upper bound on how long a single streaming provider may go silent between chunks
#: before the read is abandoned. Distinct from the whole-request budget, which is
#: configured per environment.
LLM_STREAM_IDLE_TIMEOUT_SECONDS: Final = 45.0
LLM_RETRY_BASE_DELAY_SECONDS: Final = 0.5
LLM_RETRY_MAX_DELAY_SECONDS: Final = 8.0

#: Per-subscriber queue depth in the in-process event bus. A subscriber that falls
#: this far behind is shedding load, not catching up, so further events are dropped
#: rather than allowed to grow the queue without bound.
EVENT_QUEUE_MAX_SIZE: Final = 256


class Environment(StrEnum):
    """Deployment target. Drives fail-fast configuration checks."""

    LOCAL = "local"
    TEST = "test"
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

    @property
    def is_deployed(self) -> bool:
        return self in {Environment.DEVELOPMENT, Environment.STAGING, Environment.PRODUCTION}


class LogFormat(StrEnum):
    CONSOLE = "console"
    JSON = "json"


class LLMProviderName(StrEnum):
    ECHO = "echo"
    OPENAI = "openai"


class Role(StrEnum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class FinishReason(StrEnum):
    STOP = "stop"
    LENGTH = "length"
    CANCELLED = "cancelled"
    ERROR = "error"
    TOOL_CALLS = "tool_calls"


class ClientMessageType(StrEnum):
    """Frames the browser may send over the WebSocket."""

    CHAT_SEND = "chat.send"
    RUN_CANCEL = "run.cancel"
    PING = "ping"


class ServerMessageType(StrEnum):
    """Frames the server may send over the WebSocket.

    The run lifecycle is modelled as started/token/finished so that a graph runtime
    can emit per-node progress on the same channel without a protocol change.
    """

    CONNECTION_READY = "connection.ready"
    RUN_STARTED = "run.started"
    RUN_TOKEN = "run.token"
    RUN_FINISHED = "run.finished"
    HEARTBEAT = "heartbeat"
    PONG = "pong"
    ERROR = "error"


class EventType(StrEnum):
    """Internal events published on the application event bus."""

    RUN_STARTED = "run.started"
    RUN_COMPLETED = "run.completed"
    RUN_FAILED = "run.failed"
    RUN_CANCELLED = "run.cancelled"
    CONNECTION_OPENED = "connection.opened"
    CONNECTION_CLOSED = "connection.closed"


class ErrorCode(StrEnum):
    """Stable, machine-readable error identifiers returned to clients."""

    BAD_REQUEST = "bad_request"
    VALIDATION_FAILED = "validation_failed"
    UNAUTHENTICATED = "unauthenticated"
    FORBIDDEN = "forbidden"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    PAYLOAD_TOO_LARGE = "payload_too_large"
    RATE_LIMITED = "rate_limited"
    UPSTREAM_TIMEOUT = "upstream_timeout"
    UPSTREAM_ERROR = "upstream_error"
    SERVICE_UNAVAILABLE = "service_unavailable"
    INTERNAL_ERROR = "internal_error"
    RUN_CANCELLED = "run_cancelled"


class WSCloseCode(IntEnum):
    """WebSocket close codes.

    1xxx values are defined by RFC 6455. 4xxx values are application-defined and
    deliberately mirror the HTTP status they correspond to, so client-side handling
    can share a single mapping table.
    """

    NORMAL_CLOSURE = 1000
    GOING_AWAY = 1001
    UNSUPPORTED_DATA = 1003
    POLICY_VIOLATION = 1008
    MESSAGE_TOO_BIG = 1009
    INTERNAL_ERROR = 1011
    TRY_AGAIN_LATER = 1013

    INVALID_PAYLOAD = 4400
    UNAUTHENTICATED = 4401
    FORBIDDEN = 4403
    NOT_FOUND = 4404
    CONNECTION_LIMIT = 4429
    SHUTTING_DOWN = 4503
