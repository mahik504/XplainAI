"""LangGraph state machine execution runtime.

Bridges LangGraph node updates to WebSocket and SSE stage events, streaming tokens,
and rehydrated domain research entities.
"""

from __future__ import annotations

import time
import uuid
from typing import TYPE_CHECKING, Any

from neural_navigator.agents.graphs.research_graph import build_research_graph
from neural_navigator.domain.models.research import (
    Citation,
    Claim,
    ClaimStatus,
    Evidence,
    EvidenceGraph,
    GraphEdge,
    GraphEdgeType,
    GraphNode,
    GraphNodeType,
    OrchestrationResult,
    Source,
    SourceType,
)
from neural_navigator.orchestration.analyzers import QueryAnalysis, analyze_query, latest_user_text
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.sources import sources_from_tool_results
from neural_navigator.orchestration.stages import OrchestrationStage, StageEmitter
from neural_navigator.orchestration.tool_registry import ToolRegistry
from neural_navigator.orchestration.tools import ToolResult
from neural_navigator.services.llm import LLMChunk
from neural_navigator.utils.constants import FinishReason

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Sequence

    from neural_navigator.agents.state.research_state import ResearchState
    from neural_navigator.core.config import Settings
    from neural_navigator.schemas.base import ChatMessage
    from neural_navigator.services.llm import LLMService


async def execute_research_graph(
    *,
    messages: Sequence[ChatMessage],
    mode: RunMode,
    llm: LLMService,
    settings: Settings,
    emit_stage: StageEmitter | None = None,
    model: str | None = None,
    temperature: float | None = None,
    max_output_tokens: int | None = None,
    thread_id: str | None = None,
    checkpointer: Any | None = None,
) -> AsyncIterator[LLMChunk | OrchestrationResult]:
    """Execute the compiled LangGraph research state machine and stream results."""
    graph = build_research_graph(checkpointer=checkpointer)
    user_text = latest_user_text(messages)
    run_thread_id = thread_id or f"thread_{uuid.uuid4().hex[:12]}"
    tool_registry = ToolRegistry(settings)

    config: dict[str, Any] = {
        "configurable": {
            "thread_id": run_thread_id,
            "llm": llm,
            "settings": settings,
            "tool_registry": tool_registry,
        }
    }

    initial_state: ResearchState = {
        "messages": list(messages),
        "user_text": user_text,
        "mode": mode.value,
        "model": model,
        "temperature": temperature,
        "max_output_tokens": max_output_tokens,
        "stage_timings": [],
    }

    final_state: dict[str, Any] = dict(initial_state)
    tokens_streamed = False
    start_time = time.monotonic()

    async for stream_item in graph.astream(
        initial_state,
        config=config,
        stream_mode=["updates", "custom"],
    ):
        if isinstance(stream_item, tuple) and len(stream_item) == 2:
            mode_name, payload = stream_item
        elif isinstance(stream_item, dict):
            mode_name = "updates"
            payload = stream_item
        else:
            continue

        if mode_name == "custom" and isinstance(payload, dict):
            event_type = payload.get("type")
            if event_type == "token":
                tokens_streamed = True
                yield payload["chunk"]
            elif event_type == "stage" and emit_stage is not None:
                await emit_stage(payload["stage"], payload.get("data"))

        elif mode_name == "updates" and isinstance(payload, dict):
            for node_name, node_output in payload.items():
                if isinstance(node_output, dict):
                    final_state.update(node_output)

                if emit_stage is not None:
                    if node_name == "analyze":
                        qa_dict = (
                            node_output.get("query_analysis", {})
                            if isinstance(node_output, dict)
                            else {}
                        )
                        await emit_stage(OrchestrationStage.QUERY_ANALYZED, qa_dict)
                        await emit_stage(
                            OrchestrationStage.MODE_SELECTED,
                            {
                                "mode": mode.value,
                                "label": mode.label,
                                "description": mode.description,
                            },
                        )
                        await emit_stage(
                            OrchestrationStage.CONTEXT_CHECK,
                            {
                                "ambiguity": qa_dict.get("ambiguity", "low"),
                                "message_count": len(messages),
                            },
                        )
                        if mode is RunMode.FAST:
                            await emit_stage(
                                OrchestrationStage.RESEARCH_STARTED,
                                {"skipped": True, "reason": "fast_mode"},
                            )
                    elif node_name == "research":
                        trs = (
                            node_output.get("tool_results", [])
                            if isinstance(node_output, dict)
                            else []
                        )
                        await emit_stage(
                            OrchestrationStage.RESEARCH_STARTED,
                            {
                                "mode": mode.value,
                                "tools_executed": len(trs),
                            },
                        )
                    elif node_name == "synthesize":
                        await emit_stage(
                            OrchestrationStage.GENERATION_COMPLETED,
                            {"mode": mode.value},
                        )
                        await emit_stage(
                            OrchestrationStage.RESPONSE_SYNTHESIZED,
                            {"mode": mode.value},
                        )
                    elif node_name == "critique":
                        await emit_stage(
                            OrchestrationStage.ANALYSIS_STARTED,
                            {"mode": mode.value},
                        )
                    elif node_name == "topology":
                        has_counter = final_state.get("counter_perspective") is not None
                        await emit_stage(
                            OrchestrationStage.ANALYSIS_COMPLETED,
                            {
                                "egi_score": (
                                    node_output.get("egi_score", 0.85)
                                    if isinstance(node_output, dict)
                                    else 0.85
                                ),
                                "has_counter_perspective": has_counter,
                                "sources_retrieved": len(final_state.get("sources", [])),
                                "claims_extracted": len(final_state.get("claims", [])),
                                "citations_resolved": len(final_state.get("citations", [])),
                            },
                        )
                        await emit_stage(
                            OrchestrationStage.TOPOLOGY_GENERATED,
                            {
                                "nodes": len(final_state.get("graph", {}).get("nodes", [])),
                                "edges": len(final_state.get("graph", {}).get("edges", [])),
                            },
                        )

    # Rehydrate structured domain results
    answer_text = final_state.get("answer_text", "")
    if not tokens_streamed and answer_text:
        yield LLMChunk(delta=answer_text, finish_reason=FinishReason.STOP)

    total_duration_ms = round((time.monotonic() - start_time) * 1000, 2)

    qa_raw = final_state.get("query_analysis", {})
    if isinstance(qa_raw, QueryAnalysis):
        query_analysis = qa_raw
    elif isinstance(qa_raw, dict) and qa_raw:
        query_analysis = QueryAnalysis(
            intent=qa_raw.get("intent", "explain"),
            domain=qa_raw.get("domain", "general"),
            complexity=qa_raw.get("complexity", "moderate"),
            needs_research=qa_raw.get("needs_research", True),
            ambiguity=qa_raw.get("ambiguity", "low"),
            query=qa_raw.get("query", user_text),
        )
    else:
        query_analysis = analyze_query(user_text)

    tool_results: list[ToolResult] = [
        ToolResult(
            tool=tr.get("tool", "unknown"),
            status=tr.get("status", "ok"),
            started_ms=float(tr.get("started_ms", 0.0)),
            completed_ms=float(tr.get("completed_ms", 0.0)),
            duration_ms=float(tr.get("duration_ms", 0.0)),
            summary=tr.get("summary", ""),
            data=tr.get("data", {}),
        )
        for tr in final_state.get("tool_results", [])
    ]

    domain_sources: list[Source] = []
    for s in final_state.get("sources", []):
        st_val = s.get("source_type", "web")
        try:
            st = SourceType(st_val)
        except ValueError:
            st = SourceType.WEB
        domain_sources.append(
            Source(
                id=s.get("id", ""),
                title=s.get("title", ""),
                url=s.get("url", ""),
                domain=s.get("domain", ""),
                snippet=s.get("snippet", ""),
                source_type=st,
                authority_score=float(s.get("authority_score", 0.8)),
                published_date=s.get("published_date"),
                author=s.get("author"),
                reliability_tier=s.get("reliability_tier", "medium"),
            )
        )

    domain_evidence: list[Evidence] = [
        Evidence(
            id=ev.get("id", ""),
            source_id=ev.get("source_id", ""),
            source_title=ev.get("source_title", ""),
            source_url=ev.get("source_url", ""),
            text=ev.get("text", ""),
            confidence=float(ev.get("confidence", 0.85)),
            relevance_score=float(ev.get("relevance_score", 0.85)),
            chunk_id=ev.get("chunk_id"),
        )
        for ev in final_state.get("evidence", [])
    ]

    domain_claims: list[Claim] = [
        Claim(
            id=c.get("id", ""),
            text=c.get("text", ""),
            status=ClaimStatus(c.get("status", "unverified")),
            evidence_ids=list(c.get("evidence_ids", [])),
            confidence=float(c.get("confidence", 0.7)),
            importance=c.get("importance", "medium"),
            sentence_index=int(c.get("sentence_index", 0)),
        )
        for c in final_state.get("claims", [])
    ]

    domain_citations: list[Citation] = [
        Citation(
            id=cit.get("id", ""),
            claim_id=cit.get("claim_id", ""),
            source_id=cit.get("source_id", ""),
            evidence_id=cit.get("evidence_id", ""),
            inline_marker=cit.get("inline_marker", ""),
            citation_index=int(cit.get("citation_index", 1)),
        )
        for cit in final_state.get("citations", [])
    ]

    graph_dict = final_state.get("graph", {})
    nodes = [
        GraphNode(
            id=n.get("id", ""),
            type=GraphNodeType(n.get("type", "source")),
            label=n.get("label", ""),
            description=n.get("description", ""),
            metadata=n.get("metadata", {}),
            position_3d=tuple(n.get("position_3d", (0.0, 0.0, 0.0))),
            status=n.get("status", "neutral"),
            cluster=n.get("cluster", "default"),
        )
        for n in graph_dict.get("nodes", [])
    ]
    edges = [
        GraphEdge(
            id=ed.get("id", ""),
            source_node_id=ed.get("source_node_id", ""),
            target_node_id=ed.get("target_node_id", ""),
            type=GraphEdgeType(ed.get("type", "supports")),
            weight=float(ed.get("weight", 1.0)),
            label=ed.get("label"),
        )
        for ed in graph_dict.get("edges", [])
    ]
    domain_graph = EvidenceGraph(
        nodes=nodes,
        edges=edges,
        density=float(graph_dict.get("density", 0.0)),
        cluster_count=int(graph_dict.get("cluster_count", 1)),
    )

    stage_timings = final_state.get("stage_timings", [])
    if not stage_timings:
        stage_timings = [{"stage": "total", "duration_ms": total_duration_ms}]

    result = OrchestrationResult(
        mode=mode,
        query_analysis=query_analysis,
        tool_results=tool_results,
        research_tasks=final_state.get("research_tasks", []),
        sources_retrieved=len(domain_sources),
        sources=sources_from_tool_results(tool_results),
        domain_sources=domain_sources,
        domain_evidence=domain_evidence,
        domain_claims=domain_claims,
        domain_citations=domain_citations,
        domain_graph=domain_graph,
        egi_score=float(final_state.get("egi_score", 0.85)),
        trust_metrics=final_state.get("trust_metrics", {}),
        missing_context=final_state.get("missing_context", []),
        counter_perspective=final_state.get("counter_perspective"),
        stage_timings=stage_timings,
        answer_text=answer_text,
    )

    if emit_stage is not None:
        await emit_stage(
            OrchestrationStage.STRUCTURE_READY,
            {
                "sources_retrieved": len(domain_sources),
                "node_count": len(domain_graph.nodes),
                "edge_count": len(domain_graph.edges),
                "density": domain_graph.density,
                "egi_score": result.egi_score,
            },
        )
        await emit_stage(OrchestrationStage.COMPLETED, result.as_dict())

    yield result
