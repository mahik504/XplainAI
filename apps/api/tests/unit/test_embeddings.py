"""Unit tests for embedding providers."""

import math

import numpy as np
import pytest
from pydantic import SecretStr

from neural_navigator.core.config import Settings
from neural_navigator.llm.embeddings.factory import get_embedding_provider
from neural_navigator.llm.embeddings.mock import MockEmbeddingProvider


@pytest.mark.asyncio
async def test_mock_embedding_provider_properties() -> None:
    provider = MockEmbeddingProvider(dimension=1536)
    assert provider.name == "mock"
    assert provider.dimension == 1536

    text = "Transformer architecture for research validation"
    vec1 = await provider.embed_query(text)
    assert len(vec1) == 1536

    # Unit vector check: norm should equal 1.0
    norm = np.linalg.norm(np.array(vec1))
    assert math.isclose(norm, 1.0, rel_tol=1e-5)

    # Deterministic check: same text produces identical vector
    vec2 = await provider.embed_query(text)
    assert vec1 == vec2

    # Batch embedding check
    batch_vecs = await provider.embed_texts([text, "Another sentence"])
    assert len(batch_vecs) == 2
    assert batch_vecs[0] == vec1


@pytest.mark.asyncio
async def test_embedding_factory_selection() -> None:
    settings_mock = Settings(embedding_provider="mock", embedding_dim=768)
    provider_mock = get_embedding_provider(settings_mock)
    assert provider_mock.name == "mock"
    assert provider_mock.dimension == 768

    settings_openai = Settings(
        embedding_provider="openai",
        openai_api_key=SecretStr("sk-mock-key"),
        embedding_dim=1536,
    )
    provider_openai = get_embedding_provider(settings_openai)
    assert provider_openai.name == "openai"
    assert provider_openai.dimension == 1536
    await provider_openai.aclose()
