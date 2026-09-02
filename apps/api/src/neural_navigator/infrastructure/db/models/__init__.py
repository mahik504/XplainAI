"""SQLAlchemy 2.0 ORM Models for XplainAI."""

from __future__ import annotations

from neural_navigator.infrastructure.db.base import (
    Base,
    TimestampMixin,
    generate_uuid,
    utc_now,
)
from neural_navigator.infrastructure.db.models.api_key import ApiKey, ApiKeyModel
from neural_navigator.infrastructure.db.models.chunks import DocumentChunkModel
from neural_navigator.infrastructure.db.models.citation import Citation
from neural_navigator.infrastructure.db.models.claim import Claim
from neural_navigator.infrastructure.db.models.contradiction import Contradiction
from neural_navigator.infrastructure.db.models.crawled_page import CrawledPageModel
from neural_navigator.infrastructure.db.models.document import Document
from neural_navigator.infrastructure.db.models.evidence import Evidence
from neural_navigator.infrastructure.db.models.query import Query
from neural_navigator.infrastructure.db.models.session import ResearchSession
from neural_navigator.infrastructure.db.models.source import Source
from neural_navigator.infrastructure.db.models.tool_audit import ToolExecutionLogModel
from neural_navigator.infrastructure.db.models.topology import EvidenceGraphTopology
from neural_navigator.infrastructure.db.models.user import User

__all__ = [
    "ApiKey",
    "ApiKeyModel",
    "Base",
    "Citation",
    "Claim",
    "Contradiction",
    "CrawledPageModel",
    "Document",
    "DocumentChunkModel",
    "Evidence",
    "EvidenceGraphTopology",
    "Query",
    "ResearchSession",
    "Source",
    "TimestampMixin",
    "ToolExecutionLogModel",
    "User",
    "generate_uuid",
    "utc_now",
]
