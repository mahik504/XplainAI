"""Pytest configuration for backend unit and integration tests.

Sets offline deterministic defaults (LLM_PROVIDER=echo) so unit tests can run
reliably in offline CI/CD and air-gapped test environments without live API credentials.
"""

import os
import pytest

# Ensure offline deterministic provider is set for unit test suite
os.environ.setdefault("LLM_PROVIDER", "echo")
os.environ.setdefault("OPENAI_API_KEY", "sk-mock-testing-key-for-ci")
os.environ.setdefault("OMNI_ROUTER_API_KEY", "sk-or-v1-mock-testing-key-for-ci")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-minimum-32-chars-long-123456789")
