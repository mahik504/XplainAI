"""OWASP and Enterprise API Security Headers Middleware.

Injects essential security headers (nosniff, DENY, HSTS, CSP, Referrer-Policy,
Permissions-Policy) on all HTTP responses and strips server identification headers
(Server, X-Powered-By) to prevent fingerprinting.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import Response

DEFAULT_SECURITY_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' ws: wss: https:; "
        "frame-ancestors 'none';"
    ),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    ),
    "X-XSS-Protection": "0",
}

STRIPPED_HEADERS: tuple[str, ...] = (
    "server",
    "x-powered-by",
    "Server",
    "X-Powered-By",
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """FastAPI/Starlette middleware enforcing OWASP security headers across all responses."""

    def __init__(
        self,
        app: Any,
        custom_headers: dict[str, str] | None = None,
        strip_server_headers: bool = True,
    ) -> None:
        super().__init__(app)
        self._headers = dict(DEFAULT_SECURITY_HEADERS)
        if custom_headers:
            self._headers.update(custom_headers)
        self._strip_server_headers = strip_server_headers

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        # Inject standard security headers (without overriding existing specific headers if set)
        for name, value in self._headers.items():
            response.headers.setdefault(name, value)

        # Strip server fingerprinting headers
        if self._strip_server_headers:
            for header in STRIPPED_HEADERS:
                if header in response.headers:
                    del response.headers[header]

        return response
