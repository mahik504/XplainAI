"""Explainable Intelligence multi-stage research pipeline.

Coordinates Query Analysis, Task Decomposition, Tool Execution via ToolRegistry,
Source/Evidence Extraction, Model Synthesis, Claim Extraction, and 2D/3D Graph Topology Generation.
"""

from __future__ import annotations

import asyncio
import re
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from neural_navigator.core.config import Settings
from neural_navigator.domain.models.research import (
    Assumption,
    Claim,
    Contradiction,
    Evidence,
    EvidenceGraph,
    ResearchRun,
    ResearchStep,
    Source,
    SourceType,
    generate_id,
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
from neural_navigator.schemas.base import ChatMessage
from neural_navigator.services.llm import LLMChunk, LLMService
from neural_navigator.utils.constants import Role

StageEmitter = Callable[[OrchestrationStage, dict[str, Any] | None], Awaitable[None]]


@dataclass(slots=True)
class QueryAnalysis:
    intent: str
    domain: str
    complexity: str  # simple | moderate | complex
    needs_research: bool
    ambiguity: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "intent": self.intent,
            "domain": self.domain,
            "complexity": self.complexity,
            "needs_research": self.needs_research,
            "ambiguity": self.ambiguity,
        }


@dataclass(slots=True)
class OrchestrationResult:
    mode: RunMode
    query_analysis: QueryAnalysis
    tool_results: list[ToolResult] = field(default_factory=list)
    research_tasks: list[str] = field(default_factory=list)
    sources_retrieved: int = 0
    sources: list[RetrievedSource] = field(default_factory=list)
    domain_sources: list[Source] = field(default_factory=list)
    domain_evidence: list[Evidence] = field(default_factory=list)
    domain_claims: list[Claim] = field(default_factory=list)
    domain_graph: EvidenceGraph = field(default_factory=EvidenceGraph)
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
            "domain_graph": self.domain_graph.as_dict(),
            "missing_context": self.missing_context,
            "counter_perspective": self.counter_perspective,
            "stage_timings": self.stage_timings,
        }


def _latest_user_text(messages: Sequence[ChatMessage]) -> str:
    for message in reversed(messages):
        if message.role is Role.USER:
            return message.content.strip()
    return ""


def analyze_query(text: str) -> QueryAnalysis:
    lowered = text.lower()
    words = re.findall(r"[a-z0-9]+", lowered)
    complexity = "simple"
    if len(words) > 28 or any(
        token in lowered for token in ("compare", "vs", "versus", "should", "invest", "pros and cons")
    ):
        complexity = "moderate"
    if any(token in lowered for token in ("research", "evidence", "sources", "cite", "deep", "analyze comprehensively")):
        complexity = "complex"

    domain = "general"
    if any(token in lowered for token in ("react", "vue", "python", "sql", "bitcoin", "postgres", "api", "code")):
        domain = "technology"
    elif any(token in lowered for token in ("inflation", "nuclear", "energy", "economy", "finance")):
        domain = "policy"
    elif any(token in lowered for token in ("quantum", "physics", "sky", "science")):
        domain = "science"

    intent = "explain"
    if "?" in text or lowered.startswith(("why", "how", "what", "should", "compare")):
        intent = "question"
    if any(token in lowered for token in ("joke", "poem", "story")):
        intent = "creative"
        complexity = "simple"

    needs_research = complexity != "simple" or any(
        token in lowered for token in ("latest", "current", "today", "news", "should", "invest")
    )

    ambiguity = "low"
    if len(words) < 3 and intent != "creative":
        ambiguity = "high"
    elif any(token in lowered for token in ("this", "that", "it", "they")) and len(words) < 8:
        ambiguity = "medium"

    return QueryAnalysis(
        intent=intent,
        domain=domain,
        complexity=complexity,
        needs_research=needs_research,
        ambiguity=ambiguity,
    )


def _decompose_research_tasks(text: str, analysis: QueryAnalysis, *, deep: bool) -> list[str]:
    base = text.strip()
    tasks = [base]
    if deep:
        tasks.append(f"{base} empirical methodology findings")
        tasks.append(f"{base} leading research papers benchmarks")
        tasks.append(f"{base} limitations contradictions criticisms")
        if analysis.domain != "general":
            tasks.append(f"{base} state of the art {analysis.domain}")
    elif analysis.domain != "general":
        tasks.append(f"{base} key facts {analysis.domain}")

    # Deduplicate while preserving order
    seen: set[str] = set()
    ordered: list[str] = []
    for task in tasks:
        key = task.lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(task)
    return ordered[: 5 if deep else 2]


def _build_augmented_messages(
    messages: Sequence[ChatMessage],
    *,
    mode: RunMode,
    analysis: QueryAnalysis,
    tool_results: Sequence[ToolResult],
) -> list[ChatMessage]:
    blocks: list[str] = [
        "You are XplainAI ? an explainable AI research workspace. Prefer clear, authoritative structure.",
        "Ground your answer in the provided observable tool and research sources where available.",
        "When making claims supported by sources, cite them clearly using bracketed numbers like [1] or [2].",
        f"Active mode: {mode.label} ({mode.description}).",
        f"Query analysis: intent={analysis.intent}, domain={analysis.domain}, complexity={analysis.complexity}.",
    ]
    usable = [item for item in tool_results if item.status == "ok"]
    if usable:
        blocks.append("Observable tool / research results:")
        for item in usable:
            blocks.append(f"- [{item.tool}] {item.summary}")
            results = item.data.get("results")
            if isinstance(results, list):
                for idx, row in enumerate(results[:5]):
                    if not isinstance(row, dict):
                        continue
                    title = str(row.get("title") or "Source")
                    url = str(row.get("url") or "")
                    snippet = str(row.get("snippet") or "")
                    blocks.append(f"  [{idx + 1}] {title}: {snippet[:260]}{f' ({url})' if url else ''}")
    else:
        blocks.append("No external sources were retrieved for this turn.")

    system = ChatMessage(role=Role.SYSTEM, content="\n".join(blocks))
    history = [message for message in messages if message.role is not Role.SYSTEM]
    return [system, *history]


def _extract_domain_sources_and_evidence(
    tool_results: Sequence[ToolResult],
) -> tuple[list[Source], list[Evidence]]:
    sources: list[Source] = []
    evidence: list[Evidence] = []
    seen_urls: set[str] = set()

    for tr in tool_results:
        if tr.status != "ok":
            continue
        rows = tr.data.get("results")
        if isinstance(rows, list):
            for row in rows:
                if not isinstance(row, dict):
                    continue
                url = str(row.get("url") or "")
                if url in seen_urls:
                    continue
                if url:
                    seen_urls.add(url)

                src_id = generate_id("src")
                title = str(row.get("title") or "Research Source")
                snippet = str(row.get("snippet") or "")
                domain = str(row.get("domain") or ("wikipedia.org" if "wikipedia" in url else "web"))
                authority = float(row.get("authority") or 0.85)

                src = Source(
                    id=src_id,
                    title=title,
                    url=url,
                    domain=domain,
                    snippet=snippet,
                    source_type=SourceType.PAPER if "arxiv" in url else SourceType.WEB,
                    authority_score=authority,
                )
                sources.append(src)

                # Formulate distinct evidence item
                if snippet:
                    ev_id = generate_id("evi")
                    ev = Evidence(
                        id=ev_id,
                        source_id=src_id,
                        source_title=title,
                        source_url=url,
                        text=snippet,
                        confidence=authority,
                    )
                    evidence.append(ev)

    return sources, evidence


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
    """Yield stage metadata via ``emit_stage``, then stream LLM chunks, then a final result."""
    tool_registry = ToolRegistry(settings)
    user_text = _latest_user_text(messages)
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

    # FAST: no tools / research
    if mode is RunMode.FAST:
        await emit_stage(
            OrchestrationStage.RESEARCH_STARTED,
            {"skipped": True, "reason": "fast_mode"},
        )
    else:
        # BALANCED / DEEP RESEARCH
        if mode is RunMode.DEEP_RESEARCH or analysis.needs_research:
            research_tasks = _decompose_research_tasks(
                user_text,
                analysis,
                deep=mode is RunMode.DEEP_RESEARCH,
            )
            await emit_stage(
                OrchestrationStage.RESEARCH_STARTED,
                {
                    "tasks": research_tasks,
                    "mode": mode.value,
                    "task_count": len(research_tasks),
                },
            )
        else:
            await emit_stage(
                OrchestrationStage.RESEARCH_STARTED,
                {"skipped": True, "reason": "simple_query"},
            )

        # Calculator when math is present
        math_expr = detect_math_expression(user_text)
        if math_expr:
            await emit_stage(OrchestrationStage.TOOL_STARTED, {"tool": "calculator"})
            calc = await tool_registry.execute("calculator", expression=math_expr)
            tool_results.append(calc)
            await emit_stage(OrchestrationStage.TOOL_COMPLETED, calc.as_dict())

        # Weather when asked and key present / detectable
        city = detect_weather_city(user_text)
        if city and (mode is RunMode.BALANCED or mode is RunMode.DEEP_RESEARCH):
            await emit_stage(OrchestrationStage.TOOL_STARTED, {"tool": "weather", "city": city})
            weather = await run_weather(city, settings=settings)
            tool_results.append(weather)
            await emit_stage(OrchestrationStage.TOOL_COMPLETED, weather.as_dict())

        # Multi-source web & academic search
        should_search = mode is RunMode.DEEP_RESEARCH or (
            mode is RunMode.BALANCED and analysis.needs_research and analysis.intent != "creative"
        )
        if should_search:
            queries = research_tasks or [user_text]
            limit = 4 if mode is RunMode.DEEP_RESEARCH else 1
            for query in queries[:limit]:
                await emit_stage(OrchestrationStage.TOOL_STARTED, {"tool": "web_search", "query": query})
                search = await tool_registry.execute(
                    "web_search",
                    query=query,
                    max_results=5 if mode is RunMode.DEEP_RESEARCH else 3,
                )
                tool_results.append(search)
                await emit_stage(OrchestrationStage.TOOL_COMPLETED, search.as_dict())

                if mode is RunMode.DEEP_RESEARCH:
                    # Academic ArXiv search for deep queries
                    arxiv_res = await tool_registry.execute("arxiv", query=query, max_results=3)
                    if arxiv_res.status == "ok":
                        tool_results.append(arxiv_res)
                        await emit_stage(OrchestrationStage.TOOL_COMPLETED, arxiv_res.as_dict())

                    # Wikipedia consensus for definitions & foundations
                    wiki_res = await tool_registry.execute("wikipedia", query=query)
                    if wiki_res.status == "ok":
                        tool_results.append(wiki_res)
                        await emit_stage(OrchestrationStage.TOOL_COMPLETED, wiki_res.as_dict())

            if mode is RunMode.DEEP_RESEARCH and settings.newsdata_api_key is not None:
                await emit_stage(OrchestrationStage.TOOL_STARTED, {"tool": "news", "query": user_text})
                news = await run_news(user_text, settings=settings)
                tool_results.append(news)
                await emit_stage(OrchestrationStage.TOOL_COMPLETED, news.as_dict())

    domain_sources, domain_evidence = _extract_domain_sources_and_evidence(tool_results)
    augmented = _build_augmented_messages(
        messages,
        mode=mode,
        analysis=analysis,
        tool_results=tool_results,
    )

    # Mode-specific generation knobs
    resolved_max = max_output_tokens
    if resolved_max is None:
        if mode is RunMode.FAST:
            resolved_max = min(settings.llm_max_output_tokens, 1024)
        elif mode is RunMode.DEEP_RESEARCH:
            resolved_max = max(settings.llm_max_output_tokens, 2048)
        else:
            resolved_max = settings.llm_max_output_tokens

    resolved_temp = temperature
    if resolved_temp is None:
        resolved_temp = 0.35 if mode is RunMode.FAST else settings.llm_temperature

    await emit_stage(
        OrchestrationStage.GENERATION_STARTED,
        {"model": llm.resolve_model(model), "mode": mode.value, "max_output_tokens": resolved_max},
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

    # Extract claims from generated text and construct full 2D/3D Evidence Graph
    domain_claims = extract_claims_from_text(answer_text, domain_evidence)

    # Parallel-safe post-answer analyses
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

    # Generate assumptions & contradictions if counter perspective found
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
            text=f"Assumes {analysis.domain} query parameters remain stationary across context window.",
            grounded_score=0.75,
            risk_level="low",
        )
    ]

    domain_graph = build_evidence_graph(
        sources=domain_sources,
        evidence=domain_evidence,
        claims=domain_claims,
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
        domain_graph=domain_graph,
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
        },
    )
    await emit_stage(OrchestrationStage.COMPLETED, result.as_dict())
    yield result