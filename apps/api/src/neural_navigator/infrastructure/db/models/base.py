"""Re-export Base and TimestampMixin for models namespace."""

from __future__ import annotations

from neural_navigator.infrastructure.db.base import (
    Base,
    TimestampMixin,
    generate_uuid,
    utc_now,
)

__all__ = ["Base", "TimestampMixin", "generate_uuid", "utc_now"]
