"""Database infrastructure module."""

from __future__ import annotations

from neural_navigator.infrastructure.db.base import Base, TimestampMixin, generate_uuid, utc_now
from neural_navigator.infrastructure.db.manager import DatabaseManager
from neural_navigator.infrastructure.db.models import (
    Citation,
    Claim,
    Contradiction,
    Document,
    DocumentChunkModel,
    Evidence,
    EvidenceGraphTopology,
    Query,
    ResearchSession,
    Source,
    User,
)

__all__ = [
    "Base",
    "Citation",
    "Claim",
    "Contradiction",
    "DatabaseManager",
    "Document",
    "DocumentChunkModel",
    "Evidence",
    "EvidenceGraphTopology",
    "Query",
    "ResearchSession",
    "Source",
    "TimestampMixin",
    "User",
    "generate_uuid",
    "utc_now",
]
