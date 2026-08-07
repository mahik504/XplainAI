"""In-process publish/subscribe bus for application events.

Publishing is deliberately non-blocking and lossy under pressure: an event is
telemetry about work, never the work itself, so a slow subscriber must degrade its
own view rather than stall the request that produced the event.

The `EventBus` protocol is the seam for the Redis-backed implementation that
`realtime/broker/` will provide once the service runs on more than one replica.
Nothing outside this module should depend on the in-memory class directly.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Iterable
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Protocol, runtime_checkable

import structlog
from pydantic import Field

from neural_navigator.schemas.base import BaseSchema, generate_id, utc_now
from neural_navigator.utils.constants import EVENT_QUEUE_MAX_SIZE, EventType

_logger = structlog.stdlib.get_logger(__name__)

#: Subscribing to this topic receives every published event.
TOPIC_ALL = "*"


class Event(BaseSchema):
    """An immutable record that something happened."""

    id: str = Field(default_factory=lambda: generate_id("evt"))
    type: EventType
    topic: str
    payload: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime = Field(default_factory=utc_now)
    correlation_id: str | None = None


def build_event(
    event_type: EventType,
    *,
    payload: dict[str, Any] | None = None,
    topic: str | None = None,
    correlation_id: str | None = None,
) -> Event:
    """Create an event, defaulting its topic to the leading segment of its type.

    ``run.completed`` therefore lands on topic ``run``, which lets a subscriber take
    the whole run lifecycle without enumerating every member.
    """
    resolved_topic = topic or event_type.value.split(".", 1)[0]
    return Event(
        type=event_type,
        topic=resolved_topic,
        payload=payload or {},
        correlation_id=correlation_id,
    )


@runtime_checkable
class EventBus(Protocol):
    """Transport-agnostic event bus."""

    async def publish(self, event: Event) -> None: ...

    def subscribe(self, *topics: str) -> Any:
        """Async context manager yielding an ``AsyncIterator[Event]``."""
        ...

    async def aclose(self) -> None: ...


class _Subscription:
    __slots__ = ("queue", "topics", "dropped")

    def __init__(self, topics: frozenset[str], max_queue_size: int) -> None:
        self.topics = topics
        self.queue: asyncio.Queue[Event | None] = asyncio.Queue(maxsize=max_queue_size)
        self.dropped = 0

    def accepts(self, topic: str) -> bool:
        return TOPIC_ALL in self.topics or topic in self.topics


class InMemoryEventBus:
    """Single-process event bus backed by bounded per-subscriber queues.

    Correct for one worker. With multiple workers each process sees only its own
    events, which is why the WebSocket layer must not rely on this class for
    cross-connection delivery once it is scaled out.
    """

    def __init__(self, *, max_queue_size: int = EVENT_QUEUE_MAX_SIZE) -> None:
        self._max_queue_size = max_queue_size
        self._subscriptions: set[_Subscription] = set()
        self._lock = asyncio.Lock()
        self._closed = False
        self._published = 0
        self._dropped = 0

    @property
    def subscriber_count(self) -> int:
        return len(self._subscriptions)

    @property
    def published_count(self) -> int:
        return self._published

    @property
    def dropped_count(self) -> int:
        return self._dropped

    async def publish(self, event: Event) -> None:
        if self._closed:
            raise RuntimeError("event bus is closed")

        self._published += 1
        # Iterate a snapshot: a subscriber may unregister while we fan out.
        for subscription in tuple(self._subscriptions):
            if not subscription.accepts(event.topic):
                continue
            try:
                subscription.queue.put_nowait(event)
            except asyncio.QueueFull:
                subscription.dropped += 1
                self._dropped += 1
                _logger.warning(
                    "event_bus.subscriber_lagging",
                    topic=event.topic,
                    event_type=event.type.value,
                    dropped_for_subscriber=subscription.dropped,
                )

    async def emit(
        self,
        event_type: EventType,
        *,
        payload: dict[str, Any] | None = None,
        topic: str | None = None,
        correlation_id: str | None = None,
    ) -> Event:
        """Build and publish in one step. Returns the event that was published."""
        event = build_event(
            event_type, payload=payload, topic=topic, correlation_id=correlation_id
        )
        await self.publish(event)
        return event

    @asynccontextmanager
    async def subscribe(self, *topics: str) -> AsyncIterator[AsyncIterator[Event]]:
        """Yield an iterator of events for the given topics.

        Always use as a context manager; the subscription is unregistered and its
        queue drained on exit, including when the consumer is cancelled.
        """
        if self._closed:
            raise RuntimeError("event bus is closed")

        selected: Iterable[str] = topics or (TOPIC_ALL,)
        subscription = _Subscription(frozenset(selected), self._max_queue_size)

        async with self._lock:
            self._subscriptions.add(subscription)

        try:
            yield self._iterate(subscription)
        finally:
            async with self._lock:
                self._subscriptions.discard(subscription)
            while not subscription.queue.empty():
                subscription.queue.get_nowait()

    async def _iterate(self, subscription: _Subscription) -> AsyncIterator[Event]:
        while True:
            item = await subscription.queue.get()
            if item is None:
                return
            yield item

    async def aclose(self) -> None:
        """Close the bus and unblock every waiting subscriber."""
        if self._closed:
            return
        self._closed = True
        async with self._lock:
            subscriptions = tuple(self._subscriptions)
            self._subscriptions.clear()
        for subscription in subscriptions:
            try:
                subscription.queue.put_nowait(None)
            except asyncio.QueueFull:
                # Make room for the sentinel; the dropped event is already stale.
                subscription.queue.get_nowait()
                subscription.queue.put_nowait(None)
        _logger.info(
            "event_bus.closed",
            published=self._published,
            dropped=self._dropped,
            subscribers=len(subscriptions),
        )
