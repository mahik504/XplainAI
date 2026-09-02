"""Domain exception hierarchy for XplainAI.

Every exception inherits from ``XplainAIError`` so callers can catch broadly
when they need to, yet handle specific failure modes when precision matters.

The ``recoverable`` flag and optional ``retry_after_ms`` allow upstream error
handlers (HTTP middleware, WebSocket frames) to communicate recovery semantics
to clients without hard-coding policy in each handler.
"""

from __future__ import annotations


class XplainAIError(Exception):
    """Base exception for all XplainAI domain errors."""

    def __init__(
        self,
        message: str,
        *,
        recoverable: bool = False,
        retry_after_ms: int | None = None,
    ) -> None:
        super().__init__(message)
        self.recoverable = recoverable
        self.retry_after_ms = retry_after_ms


class PipelineError(XplainAIError):
    """Raised when the orchestration pipeline encounters a fatal error."""


class ToolExecutionError(XplainAIError):
    """Raised when a tool (ArXiv, Wikipedia, web search, etc.) fails to execute."""

    def __init__(
        self,
        tool_name: str,
        message: str,
        *,
        recoverable: bool = True,
        retry_after_ms: int | None = None,
    ) -> None:
        super().__init__(
            f"Tool '{tool_name}' failed: {message}",
            recoverable=recoverable,
            retry_after_ms=retry_after_ms,
        )
        self.tool_name = tool_name


class LLMProviderError(XplainAIError):
    """Raised when the LLM provider returns an unrecoverable error."""


class CitationResolutionError(XplainAIError):
    """Raised when citation linking between claims and sources fails."""


class CacheError(XplainAIError):
    """Raised when the caching layer encounters a failure."""


class AuthenticationError(XplainAIError):
    """Raised when authentication or authorization checks fail."""


class InputValidationError(XplainAIError):
    """Raised when user input fails validation or sanitization."""


class BudgetExceededError(XplainAIError):
    """Raised when spend exceeds the configured cost circuit breaker limits."""


__all__ = [
    "AuthenticationError",
    "BudgetExceededError",
    "CacheError",
    "CitationResolutionError",
    "InputValidationError",
    "LLMProviderError",
    "PipelineError",
    "ToolExecutionError",
    "XplainAIError",
]
