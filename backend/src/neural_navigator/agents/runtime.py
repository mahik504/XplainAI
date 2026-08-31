"""LangGraph state machine execution runtime.

Bridges LangGraph node updates to WebSocket and SSE stage events, streaming tokens,
and rehydrated domain research entities.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any, cast

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
    Source,
    SourceType,
)
from neural_navigator.orchestration.analyzers import QueryAnalysis, latest_user_text
from neural_navigator.orchestration.pipeline import OrchestrationResult
from neural_navigator.orchestration.sources import sources_from_tool_results
from neural_navigator.orchestration.stages import OrchestrationStage
from neural_navigator.orchestration.tools import ToolResult
from neural_navigator.services.llm import LLMChunk
from neural_navigator.utils.constants import FinishReason

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Sequence

    from neural_navigator.agents.state.research_state import ResearchState
    from neural_navigator.core.config import Settings
    from neural_navigator.orchestration.modes import RunMode
    from neural_navigator.orchestration.pipeline import StageEmitter
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
    config: dict[str, Any] = {"configurable": {"thread_id": run_thread_id}}

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

    async for event in cast("Any", graph).astream(
        initial_state,
        config=config,
        stream_mode="updates",
    ):
        for node_name, node_output in event.items():
            final_state.update(node_output)

            if emit_stage is not None:
                if node_name == "analyze":
                    qa_dict = node_output.get("query_analysis", {})
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
                elif node_name == "research":
                    trs = node_output.get("tool_results", [])
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
                elif node_name == "topology":
                    has_counter = final_state.get("counter_perspective") is not None
                    await emit_stage(
                        OrchestrationStage.ANALYSIS_COMPLETED,
                        {
                            "egi_score": node_output.get("egi_score", 0.85),
                            "has_counter_perspective": has_counter,
                        },
                    )

    # Stream the synthesized answer chunk
    answer_text = final_state.get("answer_text", "")
    if answer_text:
        yield LLMChunk(delta=answer_text, finish_reason=FinishReason.STOP)

    # Reconstruct domain objects for OrchestrationResult
    qa_dict = final_state.get("query_analysis", {})
    query_analysis = QueryAnalysis(
        intent=qa_dict.get("intent", "explain"),
        domain=qa_dict.get("domain", "general"),
        complexity=qa_dict.get("complexity", "moderate"),
        needs_research=qa_dict.get("needs_research", False),
        ambiguity=qa_dict.get("ambiguity", "low"),
    )

    tool_results: list[ToolResult] = [
        ToolResult(
            tool=tr.get("tool", ""),
            status=tr.get("status", "ok"),
            started_ms=tr.get("started_ms", 0.0),
            completed_ms=tr.get("completed_ms", 0.0),
            duration_ms=tr.get("duration_ms", 0.0),
            summary=tr.get("summary", ""),
            data=tr.get("data", {}),
        )
        for tr in final_state.get("tool_results", [])
    ]

    domain_sources: list[Source] = [
        Source(
            id=s.get("id", ""),
            title=s.get("title", ""),
            url=s.get("url", ""),
            domain=s.get("domain", ""),
            snippet=s.get("snippet", ""),
            source_type=SourceType(s.get("source_type", "web")),
            authority_score=float(s.get("authority_score", 0.8)),
        )
        for s in final_state.get("sources", [])
    ]

    domain_evidence: list[Evidence] = [
        Evidence(
            id=e.get("id", ""),
            source_id=e.get("source_id", ""),
            source_title=e.get("source_title", ""),
            source_url=e.get("source_url", ""),
            text=e.get("text", ""),
            confidence=float(e.get("confidence", 0.85)),
            relevance_score=float(e.get("relevance_score", 0.85)),
        )
        for e in final_state.get("evidence", [])
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
