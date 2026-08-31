"""Explainable Intelligence multi-stage research pipeline coordinator.

Coordinates semantic query analysis, multi-source tool execution, prompt augmentation,
grounded streaming LLM generation, claim & citation resolution, post-analysis, and
2D/3D knowledge graph topology generation.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from neural_navigator.domain.models.research import (
    Assumption,
    Citation,
    Claim,
    Contradiction,
    Evidence,
    EvidenceGraph,
    Source,
    generate_id,
)
from neural_navigator.orchestration.analyzers import (
    QueryAnalysis,
    _decompose_research_tasks,
    _latest_user_text,
    analyze_query,
    decompose_research_tasks,
    latest_user_text,
)
from neural_navigator.orchestration.augmenters import (
    _build_augmented_messages,
    build_augmented_messages,
    format_tool_results_block,
)
from neural_navigator.orchestration.citations import (
    parse_citation_markers,
    resolve_inline_citations,
)
from neural_navigator.orchestration.egi import compute_egi_score
from neural_navigator.orchestration.extractors import (
    _extract_domain_sources_and_evidence,
    extract_domain_sources_and_evidence,
)
from neural_navigator.orchestration.graph_engine import (
    build_evidence_graph,
    extract_claims_from_text,
)
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.post_analysis import (
    build_counter_perspective,
    detect_missing_context,
)
from neural_navigator.orchestration.sources import RetrievedSource, sources_from_tool_results
from neural_navigator.orchestration.stages import OrchestrationStage
from neural_navigator.orchestration.tool_registry import ToolRegistry
from neural_navigator.orchestration.tools import (
    ToolResult,
    detect_math_expression,
    detect_weather_city,
    run_news,
    run_weather,
)

if TYPE_CHECKING:
    from collections.abc import Sequence

    from neural_navigator.core.config import Settings
    from neural_navigator.schemas.base import ChatMessage
    from neural_navigator.services.llm import LLMChunk, LLMService

StageEmitter = Callable[[OrchestrationStage, dict[str, Any] | None], Awaitable[None]]


@dataclass(slots=True)
class OrchestrationResult:
    """The complete observable outcome of a research run."""

    mode: RunMode
    query_analysis: QueryAnalysis
    tool_results: list[ToolResult] = field(default_factory=list)
    research_tasks: list[str] = field(default_factory=list)
    sources_retrieved: int = 0
    sources: list[RetrievedSource] = field(default_factory=list)
    domain_sources: list[Source] = field(default_factory=list)
    domain_evidence: list[Evidence] = field(default_factory=list)
    domain_claims: list[Claim] = field(default_factory=list)
    domain_citations: list[Citation] = field(default_factory=list)
    domain_graph: EvidenceGraph = field(default_factory=EvidenceGraph)
    egi_score: float = 0.85
    trust_metrics: dict[str, Any] = field(default_factory=dict)
    missing_context: list[dict[str, Any]] = field(default_factory=list)
    counter_perspective: str | None = None
    stage_timings: list[dict[str, Any]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode.value,
            "query_analysis": self.query_analysis.as_dict(),
            "tool_results": [item.as_dict() for item in self.tool_results],
            "research_tasks": self.research_tasks,
            "sources_retrieved": self.sources_retrieved,
            "sources": [item.as_dict() for item in self.sources],
            "domain_sources": [s.as_dict() for s in self.domain_sources],
            "domain_evidence": [e.as_dict() for e in self.domain_evidence],
            "domain_claims": [c.as_dict() for c in self.domain_claims],
            "domain_citations": [cit.as_dict() for cit in self.domain_citations],
            "domain_graph": self.domain_graph.as_dict(),
            "egi_score": self.egi_score,
            "trust_metrics": self.trust_metrics,
            "missing_context": self.missing_context,
            "counter_perspective": self.counter_perspective,
            "stage_timings": self.stage_timings,
        }


async def run_orchestrated_chat(
    *,
    messages: Sequence[ChatMessage],
    mode: RunMode,
    llm: LLMService,
    settings: Settings,
    emit_stage: StageEmitter,
    model: str | None = None,
    temperature: float | None = None,
    max_output_tokens: int | None = None,
) -> AsyncIterator[LLMChunk | OrchestrationResult]:
    """Yield stage metadata via ``emit_stage``, stream LLM chunks, and yield final result."""
    tool_registry = ToolRegistry(settings)
    user_text = latest_user_text(messages)
    analysis = analyze_query(user_text)
    await emit_stage(OrchestrationStage.QUERY_ANALYZED, analysis.as_dict())

    await emit_stage(
        OrchestrationStage.MODE_SELECTED,
        {"mode": mode.value, "label": mode.label, "description": mode.description},
    )

    await emit_stage(
        OrchestrationStage.CONTEXT_CHECK,
        {"ambiguity": analysis.ambiguity, "message_count": len(messages)},
    )

    tool_results: list[ToolResult] = []
    research_tasks: list[str] = []

    if mode is RunMode.FAST:
        await emit_stage(
            OrchestrationStage.RESEARCH_STARTED,
            {"skipped": True, "reason": "fast_mode"},
        )
    else:
        research_tasks = decompose_research_tasks(
            user_text,
            analysis,
            deep=True,
        )
        await emit_stage(
            OrchestrationStage.RESEARCH_STARTED,
            {
                "tasks": research_tasks,
                "mode": mode.value,
                "task_count": len(research_tasks),
            },
        )

        math_expr = detect_math_expression(user_text)
        if math_expr:
            await emit_stage(OrchestrationStage.TOOL_STARTED, {"tool": "calculator"})
            calc = await tool_registry.execute("calculator", expression=math_expr)
            tool_results.append(calc)
            await emit_stage(OrchestrationStage.TOOL_COMPLETED, calc.as_dict())

        city = detect_weather_city(user_text)
        if city and mode is RunMode.DEEP_RESEARCH:
            await emit_stage(OrchestrationStage.TOOL_STARTED, {"tool": "weather", "city": city})
            weather = await run_weather(city, settings=settings)
            tool_results.append(weather)
            await emit_stage(OrchestrationStage.TOOL_COMPLETED, weather.as_dict())

        from neural_navigator.orchestration.url_ingest import extract_urls_from_text

        detected_urls = extract_urls_from_text(user_text)
        for url in detected_urls[:3]:
            await emit_stage(OrchestrationStage.TOOL_STARTED, {"tool": "url_ingest", "url": url})
            url_res = await tool_registry.execute("url_ingest", url=url)
            tool_results.append(url_res)
            await emit_stage(OrchestrationStage.TOOL_COMPLETED, url_res.as_dict())

        queries = research_tasks or [user_text]
        for query in queries[:4]:
            await emit_stage(
                OrchestrationStage.TOOL_STARTED,
                {"tool": "web_search", "query": query},
            )
            search = await tool_registry.execute(
                "web_search",
                query=query,
                max_results=5,
            )
            tool_results.append(search)
            await emit_stage(OrchestrationStage.TOOL_COMPLETED, search.as_dict())

            arxiv_res = await tool_registry.execute("arxiv", query=query, max_results=3)
            if arxiv_res.status == "ok":
                tool_results.append(arxiv_res)
                await emit_stage(OrchestrationStage.TOOL_COMPLETED, arxiv_res.as_dict())

            wiki_res = await tool_registry.execute("wikipedia", query=query)
            if wiki_res.status == "ok":
                tool_results.append(wiki_res)
                await emit_stage(OrchestrationStage.TOOL_COMPLETED, wiki_res.as_dict())

        if settings.newsdata_api_key is not None:
            await emit_stage(
                OrchestrationStage.TOOL_STARTED,
                {"tool": "news", "query": user_text},
            )
            news = await run_news(user_text, settings=settings)
            tool_results.append(news)
            await emit_stage(OrchestrationStage.TOOL_COMPLETED, news.as_dict())

    domain_sources, domain_evidence = extract_domain_sources_and_evidence(tool_results)
    augmented = build_augmented_messages(
        messages,
        mode=mode,
        analysis=analysis,
        tool_results=tool_results,
    )

    resolved_max = max_output_tokens
    if resolved_max is None:
        resolved_max = (
            min(settings.llm_max_output_tokens, 1024)
            if mode is RunMode.FAST
            else max(settings.llm_max_output_tokens, 2048)
        )

    resolved_temp = temperature
    if resolved_temp is None:
        resolved_temp = 0.35 if mode is RunMode.FAST else settings.llm_temperature

    await emit_stage(
        OrchestrationStage.GENERATION_STARTED,
        {
            "model": llm.resolve_model(model),
            "mode": mode.value,
            "max_output_tokens": resolved_max,
        },
    )

    answer_parts: list[str] = []
    async for chunk in llm.stream_chat(
        augmented,
        model=model,
        temperature=resolved_temp,
        max_output_tokens=resolved_max,
    ):
        if chunk.delta:
            answer_parts.append(chunk.delta)
        yield chunk

    await emit_stage(OrchestrationStage.GENERATION_COMPLETED, {"mode": mode.value})

    answer_text = "".join(answer_parts)
    legacy_sources = sources_from_tool_results(tool_results)

    # 1. Claim extraction
    domain_claims = extract_claims_from_text(answer_text, domain_evidence)

    # 2. Citation resolution and claim-evidence linking
    _, domain_citations, citation_edges = resolve_inline_citations(
        answer_text, domain_sources, domain_evidence, domain_claims
    )

    # 3. Post-answer analysis (missing context + counter perspective)
    await emit_stage(OrchestrationStage.ANALYSIS_STARTED, {"mode": mode.value})
    missing_items, counter = await asyncio.gather(
        asyncio.to_thread(detect_missing_context, user_text),
        asyncio.to_thread(
            lambda: build_counter_perspective(
                user_query=user_text,
                answer=answer_text,
                mode=mode.value,
            )
        ),
    )
    missing = [item.as_dict() for item in missing_items]

    contradictions: list[Contradiction] = []
    if counter:
        contradictions.append(
            Contradiction(
                id=generate_id("con"),
                claim_id=domain_claims[0].id if domain_claims else generate_id("clm"),
                evidence_a_id=domain_evidence[0].id if domain_evidence else "",
                evidence_b_id="",
                explanation=counter[:160],
                severity="moderate",
            )
        )

    assumptions: list[Assumption] = [
        Assumption(
            id=generate_id("asm"),
            text=(
                f"Assumes {analysis.domain} query parameters "
                "remain stationary across context window."
            ),
            grounded_score=0.75,
            risk_level="low",
        )
    ]

    # 4. Build 3D spatial evidence graph & attach citation edges
    domain_graph = build_evidence_graph(
        sources=domain_sources,
        evidence=domain_evidence,
        claims=domain_claims,
        contradictions=contradictions,
        assumptions=assumptions,
    )
    existing_edge_ids = {e.id for e in domain_graph.edges}
    for edge in citation_edges:
        if edge.id not in existing_edge_ids:
            domain_graph.edges.append(edge)

    # 5. Compute EGI grounding metrics
    egi_score, trust_metrics = compute_egi_score(
        claims=domain_claims,
        evidence=domain_evidence,
        citations=domain_citations,
        contradictions=contradictions,
        assumptions=assumptions,
    )

    await emit_stage(
        OrchestrationStage.ANALYSIS_COMPLETED,
        {
            "missing_context_count": len(missing),
            "has_counter_perspective": counter is not None,
            "sources_retrieved": len(domain_sources),
            "claims_extracted": len(domain_claims),
            "citations_resolved": len(domain_citations),
            "egi_score": egi_score,
        },
    )

    result = OrchestrationResult(
        mode=mode,
        query_analysis=analysis,
        tool_results=tool_results,
        research_tasks=research_tasks,
        sources_retrieved=len(domain_sources),
        sources=legacy_sources,
        domain_sources=domain_sources,
        domain_evidence=domain_evidence,
        domain_claims=domain_claims,
        domain_citations=domain_citations,
        domain_graph=domain_graph,
        egi_score=egi_score,
        trust_metrics=trust_metrics,
        missing_context=missing,
        counter_perspective=counter,
    )

    await emit_stage(
        OrchestrationStage.STRUCTURE_READY,
        {
            "sources_retrieved": len(domain_sources),
            "node_count": len(domain_graph.nodes),
            "edge_count": len(domain_graph.edges),
            "density": domain_graph.density,
            "egi_score": egi_score,
        },
    )
    await emit_stage(OrchestrationStage.COMPLETED, result.as_dict())
    yield result


__all__ = [
    "OrchestrationResult",
    "QueryAnalysis",
    "StageEmitter",
    "_build_augmented_messages",
    "_decompose_research_tasks",
    "_extract_domain_sources_and_evidence",
    "_latest_user_text",
    "analyze_query",
    "build_augmented_messages",
    "compute_egi_score",
    "decompose_research_tasks",
    "extract_domain_sources_and_evidence",
    "format_tool_results_block",
    "latest_user_text",
    "parse_citation_markers",
    "resolve_inline_citations",
    "run_orchestrated_chat",
]
