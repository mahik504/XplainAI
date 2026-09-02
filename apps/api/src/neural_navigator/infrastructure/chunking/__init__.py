"""Document chunking package."""

from __future__ import annotations

from neural_navigator.infrastructure.chunking.chunker import MetadataAwareChunker
from neural_navigator.infrastructure.chunking.models import DocumentChunk

__all__ = ["DocumentChunk", "MetadataAwareChunker"]
