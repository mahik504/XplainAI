"""Provider-agnostic access to large language models.

Streaming is the primitive and whole-response completion is derived from it, rather
than the other way round, because every consumer that matters — the SSE endpoint, the
WebSocket session, and the graph nodes that will follow — needs incremental output.

The rest of the application depends on ``LLMService`` and the ``LLMProvider``
protocol only, so adding or replacing a vendor is a change confined to this module.
"""

from __future__ import annotations

import asyncio
import json
import random
import time
from collections.abc import AsyncGenerator, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
import structlog

from neural_navigator.core.config import Settings
from neural_navigator.schemas.base import ChatMessage, Usage
from neural_navigator.utils.constants import (
    LLM_RETRY_BASE_DELAY_SECONDS,
    LLM_RETRY_MAX_DELAY_SECONDS,
    LLM_STREAM_IDLE_TIMEOUT_SECONDS,
    ErrorCode,
    FinishReason,
    LLMProviderName,
    Role,
)

_logger = structlog.stdlib.get_logger(__name__)


class LLMError(RuntimeError):
    """Base class for model access failures."""

    code: ErrorCode = ErrorCode.UPSTREAM_ERROR
    retryable: bool = False

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class LLMTimeoutError(LLMError):
    code = ErrorCode.UPSTREAM_TIMEOUT
    retryable = True


class LLMRateLimitError(LLMError):
    code = ErrorCode.RATE_LIMITED
    retryable = True


class LLMAuthenticationError(LLMError):
    code = ErrorCode.UPSTREAM_ERROR
    retryable = False


class LLMProviderError(LLMError):
    code = ErrorCode.UPSTREAM_ERROR

    def __init__(
        self, message: str, *, status_code: int | None = None, retryable: bool = False
    ) -> None:
        super().__init__(message, status_code=status_code)
        self.retryable = retryable


@dataclass(frozen=True, slots=True)
class LLMChunk:
    """One increment of a streamed response."""

    delta: str = ""
    finish_reason: FinishReason | None = None
    usage: Usage | None = None


@dataclass(frozen=True, slots=True)
class LLMCompletion:
    """A fully accumulated response."""

    content: str
    model: str
    finish_reason: FinishReason
    usage: Usage


class LLMProvider(Protocol):
    """The surface a model vendor must implement."""

    name: str

    def stream_chat(
        self,
        messages: Sequence[ChatMessage],
        *,
        model: str,
        temperature: float,
        max_output_tokens: int,
    ) -> AsyncGenerator[LLMChunk, None]:
        """Yield response increments until the model stops."""
        ...

    async def aclose(self) -> None:
        """Release any transport resources held by the provider."""
        ...


class EchoProvider:
    """Deterministic local provider that streams the last user turn back.

    Exists so the service, the SSE endpoint and the WebSocket protocol can be run and
    tested end to end without network access or an API key. Configuration validation
    rejects it in any deployed environment.
    """

    name = LLMProviderName.ECHO.value

    def __init__(self, *, chunk_delay_seconds: float = 0.0) -> None:
        self._chunk_delay_seconds = chunk_delay_seconds

    async def stream_chat(
        self,
        messages: Sequence[ChatMessage],
        *,
        model: str,
        temperature: float,
        max_output_tokens: int,
    ) -> AsyncGenerator[LLMChunk, None]:
        prompt = next(
            (m.content for m in reversed(messages) if m.role is Role.USER),
            "",
        )
        words = f"You said: {prompt}".split()
        emitted = 0

        for index, word in enumerate(words):
            if emitted >= max_output_tokens:
                yield LLMChunk(finish_reason=FinishReason.LENGTH)
                return
            if self._chunk_delay_seconds:
                await asyncio.sleep(self._chunk_delay_seconds)
            else:
                # Yield to the loop so a cancel frame can interrupt a long echo.
                await asyncio.sleep(0)
            yield LLMChunk(delta=word if index == 0 else f" {word}")
            emitted += 1

        prompt_tokens = sum(len(m.content.split()) for m in messages)
        yield LLMChunk(
            finish_reason=FinishReason.STOP,
            usage=Usage(
                prompt_tokens=prompt_tokens,
                completion_tokens=emitted,
                total_tokens=prompt_tokens + emitted,
            ),
        )

    async def aclose(self) -> None:
        return None


class OpenAICompatibleProvider:
    """Client for any endpoint speaking the OpenAI chat-completions protocol."""

    name = LLMProviderName.OPENAI.value

    _FINISH_REASONS = {
        "stop": FinishReason.STOP,
        "length": FinishReason.LENGTH,
        "tool_calls": FinishReason.TOOL_CALLS,
        "content_filter": FinishReason.ERROR,
    }

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        timeout_seconds: float,
        include_usage: bool = True,
    ) -> None:
        self._include_usage = include_usage
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(
                connect=10.0, read=timeout_seconds, write=10.0, pool=10.0
            ),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
        )

    async def stream_chat(
        self,
        messages: Sequence[ChatMessage],
        *,
        model: str,
        temperature: float,
        max_output_tokens: int,
    ) -> AsyncGenerator[LLMChunk, None]:
        payload: dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": message.role.value, "content": message.content}
                for message in messages
            ],
            "temperature": temperature,
            "max_tokens": max_output_tokens,
            "stream": True,
        }
        if self._include_usage:
            payload["stream_options"] = {"include_usage": True}

        try:
            async with self._client.stream(
                "POST", "/chat/completions", json=payload
            ) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode("utf-8", errors="replace")
                    raise self._map_status(response.status_code, body)

                async for line in response.aiter_lines():
                    chunk = self._parse_line(line)
                    if chunk is not None:
                        yield chunk
        except httpx.TimeoutException as exc:
            raise LLMTimeoutError(f"model request timed out: {exc}") from exc
        except httpx.HTTPError as exc:
            raise LLMProviderError(
                f"model transport failure: {exc}", retryable=True
            ) from exc

    def _parse_line(self, line: str) -> LLMChunk | None:
        stripped = line.strip()
        if not stripped or not stripped.startswith("data:"):
            return None

        data = stripped.removeprefix("data:").strip()
        if data == "[DONE]":
            return None

        try:
            event: dict[str, Any] = json.loads(data)
        except json.JSONDecodeError:
            _logger.warning("llm.stream.undecodable_frame", frame=data[:256])
            return None

        usage = self._parse_usage(event.get("usage"))
        choices = event.get("choices") or []
        if not choices:
            return LLMChunk(usage=usage) if usage else None

        choice = choices[0]
        delta = (choice.get("delta") or {}).get("content") or ""
        raw_reason = choice.get("finish_reason")
        finish_reason = self._FINISH_REASONS.get(raw_reason) if raw_reason else None

        if not delta and finish_reason is None and usage is None:
            return None
        return LLMChunk(delta=delta, finish_reason=finish_reason, usage=usage)

    @staticmethod
    def _parse_usage(raw: Any) -> Usage | None:
        if not isinstance(raw, dict):
            return None
        return Usage(
            prompt_tokens=int(raw.get("prompt_tokens", 0)),
            completion_tokens=int(raw.get("completion_tokens", 0)),
            total_tokens=int(raw.get("total_tokens", 0)),
        )

    @staticmethod
    def _map_status(status_code: int, body: str) -> LLMError:
        excerpt = body[:512]
        if status_code in {401, 403}:
            return LLMAuthenticationError(
                f"model provider rejected credentials: {excerpt}", status_code=status_code
            )
        if status_code == 429:
            return LLMRateLimitError(
                f"model provider rate limited the request: {excerpt}",
                status_code=status_code,
            )
        if status_code == 408 or status_code >= 500:
            return LLMProviderError(
                f"model provider error {status_code}: {excerpt}",
                status_code=status_code,
                retryable=True,
            )
        return LLMProviderError(
            f"model provider rejected the request ({status_code}): {excerpt}",
            status_code=status_code,
            retryable=False,
        )

    async def aclose(self) -> None:
        await self._client.aclose()


class LLMService:
    """Applies timeouts, retries and observability on top of a raw provider."""

    def __init__(
        self,
        *,
        provider: LLMProvider,
        settings: Settings,
        idle_timeout_seconds: float = LLM_STREAM_IDLE_TIMEOUT_SECONDS,
    ) -> None:
        self._provider = provider
        self._settings = settings
        self._idle_timeout_seconds = idle_timeout_seconds

    @property
    def provider_name(self) -> str:
        return self._provider.name

    @property
    def default_model(self) -> str:
        return self._settings.default_chat_model

    def resolve_model(self, requested: str | None) -> str:
        from neural_navigator.services.model_registry import resolve_allowed_model

        return resolve_allowed_model(
            requested,
            default_model=self._settings.default_chat_model,
        )

    async def stream_chat(
        self,
        messages: Sequence[ChatMessage],
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_output_tokens: int | None = None,
    ) -> AsyncGenerator[LLMChunk, None]:
        """Stream a response, retrying only failures that occur before first output.

        Once a token has reached the caller the stream cannot be restarted without
        duplicating text, so a mid-stream failure is surfaced rather than retried.
        """
        resolved_model = self.resolve_model(model)
        resolved_temperature = (
            temperature if temperature is not None else self._settings.llm_temperature
        )
        resolved_max_tokens = max_output_tokens or self._settings.llm_max_output_tokens

        attempt = 0
        while True:
            emitted = False
            started = time.perf_counter()
            try:
                async for chunk in self._stream_once(
                    messages,
                    model=resolved_model,
                    temperature=resolved_temperature,
                    max_output_tokens=resolved_max_tokens,
                ):
                    emitted = True
                    yield chunk
            except LLMError as exc:
                exhausted = attempt >= self._settings.llm_max_retries
                if emitted or not exc.retryable or exhausted:
                    _logger.error(
                        "llm.stream.failed",
                        provider=self._provider.name,
                        model=resolved_model,
                        attempt=attempt,
                        error_code=exc.code.value,
                        status_code=exc.status_code,
                        emitted_output=emitted,
                    )
                    raise
                delay = self._backoff_delay(attempt)
                _logger.warning(
                    "llm.stream.retrying",
                    provider=self._provider.name,
                    model=resolved_model,
                    attempt=attempt,
                    delay_seconds=round(delay, 3),
                    error_code=exc.code.value,
                )
                await asyncio.sleep(delay)
                attempt += 1
                continue

            _logger.info(
                "llm.stream.completed",
                provider=self._provider.name,
                model=resolved_model,
                attempt=attempt,
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )
            return

    async def _stream_once(
        self,
        messages: Sequence[ChatMessage],
        *,
        model: str,
        temperature: float,
        max_output_tokens: int,
    ) -> AsyncGenerator[LLMChunk, None]:
        deadline = time.monotonic() + self._settings.llm_request_timeout_seconds
        stream = self._provider.stream_chat(
            messages,
            model=model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )
        try:
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise LLMTimeoutError(
                        "model request exceeded "
                        f"{self._settings.llm_request_timeout_seconds}s budget"
                    )
                try:
                    chunk = await asyncio.wait_for(
                        stream.__anext__(),
                        timeout=min(remaining, self._idle_timeout_seconds),
                    )
                except StopAsyncIteration:
                    return
                except TimeoutError as exc:
                    raise LLMTimeoutError(
                        "model stream stalled for "
                        f"{self._idle_timeout_seconds}s without output"
                    ) from exc
                yield chunk
        finally:
            await stream.aclose()

    async def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_output_tokens: int | None = None,
    ) -> LLMCompletion:
        """Accumulate a streamed response into a single result."""
        resolved_model = self.resolve_model(model)
        parts: list[str] = []
        finish_reason = FinishReason.STOP
        usage = Usage()

        async for chunk in self.stream_chat(
            messages,
            model=resolved_model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        ):
            if chunk.delta:
                parts.append(chunk.delta)
            if chunk.finish_reason is not None:
                finish_reason = chunk.finish_reason
            if chunk.usage is not None:
                usage = chunk.usage

        return LLMCompletion(
            content="".join(parts),
            model=resolved_model,
            finish_reason=finish_reason,
            usage=usage,
        )

    @staticmethod
    def _backoff_delay(attempt: int) -> float:
        """Exponential backoff with full jitter, to avoid synchronised retries."""
        ceiling = min(
            LLM_RETRY_MAX_DELAY_SECONDS, LLM_RETRY_BASE_DELAY_SECONDS * (2**attempt)
        )
        return random.uniform(0, ceiling)  # noqa: S311 - jitter, not cryptography

    async def aclose(self) -> None:
        await self._provider.aclose()


def build_llm_provider(settings: Settings) -> LLMProvider:
    """Select and construct the provider named in configuration.

    ``LLM_PROVIDER=openai`` requires ``OPENAI_API_KEY`` and never falls back to
    Echo. Use ``LLM_PROVIDER=echo`` explicitly for offline stubs.
    """
    if settings.llm_provider is LLMProviderName.OPENAI:
        if settings.openai_api_key is None:
            raise RuntimeError(
                "LLM_PROVIDER=openai requires OPENAI_API_KEY to be set "
                "(no silent Echo fallback)"
            )
        return OpenAICompatibleProvider(
            base_url=settings.llm_base_url,
            api_key=settings.openai_api_key.get_secret_value(),
            timeout_seconds=settings.llm_request_timeout_seconds,
        )
    return EchoProvider()
