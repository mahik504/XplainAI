"""Unit tests for Model Context Protocol (MCP) server."""

import json
import pytest

from mcp_server import (
    app,
    calculate_egi,
    deep_research,
    extract_claims,
    get_evidence_pack_resource,
    get_evidence_resource,
    get_session_resource,
    get_source_resource,
    search_evidence,
    verify_contradictions,
    xplainai_claim_contradiction_audit,
    xplainai_deep_investigation,
    xplainai_fact_check_document,
)


@pytest.mark.asyncio
async def test_mcp_server_tools_listing() -> None:
    tools = await app.list_tools()
    tool_names = {t.name for t in tools}
    assert "deep_research" in tool_names
    assert "search_evidence" in tool_names
    assert "extract_claims" in tool_names
    assert "verify_contradictions" in tool_names
    assert "calculate_egi" in tool_names


@pytest.mark.asyncio
async def test_mcp_server_prompts_listing() -> None:
    prompts = await app.list_prompts()
    prompt_names = {p.name for p in prompts}
    assert "xplainai_deep_investigation" in prompt_names
    assert "xplainai_fact_check_document" in prompt_names
    assert "xplainai_claim_contradiction_audit" in prompt_names


@pytest.mark.asyncio
async def test_mcp_extract_claims_tool() -> None:
    sample_text = (
        "XplainAI provides deterministic evidence grounding. "
        "The system achieves 95 percent citation fidelity on benchmarks. "
        "Furthermore, hallucination rates are reduced to zero."
    )
    res = await extract_claims(sample_text)
    claims = json.loads(res)
    assert isinstance(claims, list)
    assert len(claims) >= 2
    assert "text" in claims[0]
    assert "confidence" in claims[0]


@pytest.mark.asyncio
async def test_mcp_verify_contradictions_tool() -> None:
    sample_text = (
        "Model latency is strictly under 10 milliseconds. "
        "However, average inference time is 500 milliseconds."
    )
    res = await verify_contradictions(claims_text=sample_text)
    parsed = json.loads(res)
    assert parsed is not None


@pytest.mark.asyncio
async def test_mcp_calculate_egi_tool() -> None:
    res = await calculate_egi(synthesis="Test synthesis", claim_count=4, evidence_count=4, source_quality=0.95)
    data = json.loads(res)
    assert "egi_score" in data
    assert 0.0 <= data["egi_score"] <= 1.0
    assert "metrics" in data


@pytest.mark.asyncio
async def test_mcp_search_evidence_tool() -> None:
    res = await search_evidence(query="transformer architecture", top_k=3, min_confidence=0.4)
    data = json.loads(res)
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "text" in data[0]


@pytest.mark.asyncio
async def test_mcp_resources() -> None:
    # 1. Session resource
    res_session = await get_session_resource("ses_test123")
    assert "session_id" in res_session

    # 2. Evidence resource
    res_evi = await get_evidence_resource("evi_test123")
    assert "evidence_id" in res_evi or "id" in res_evi

    # 3. Source resource
    res_src = await get_source_resource("src_test123")
    assert "source_id" in res_src or "id" in res_src

    # 4. Evidence pack resource
    res_pack = await get_evidence_pack_resource("ses_test123")
    assert isinstance(res_pack, str)


def test_mcp_prompts() -> None:
    p1 = xplainai_deep_investigation(topic="Quantum Annealing", depth="exhaustive")
    assert "Quantum Annealing" in p1
    assert "EGI 2.0" in p1

    p2 = xplainai_fact_check_document(document_text="Sample document assertions.")
    assert "Sample document assertions." in p2

    p3 = xplainai_claim_contradiction_audit(claims_text="Claim A vs Claim B")
    assert "Claim A vs Claim B" in p3
