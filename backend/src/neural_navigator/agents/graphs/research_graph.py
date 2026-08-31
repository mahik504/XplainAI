"""Compiled LangGraph State Machine for Explainable Intelligence research runs."""

from __future__ import annotations

from typing import Any

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from neural_navigator.agents.edges.conditional import should_critique, should_research
from neural_navigator.agents.nodes.analyze_node import analyze_query_node
from neural_navigator.agents.nodes.citation_node import citation_resolution_node
from neural_navigator.agents.nodes.claim_node import claim_extraction_node
from neural_navigator.agents.nodes.critique_node import critique_node
from neural_navigator.agents.nodes.research_node import research_node
from neural_navigator.agents.nodes.synthesize_node import synthesize_node
from neural_navigator.agents.nodes.topology_node import topology_node
from neural_navigator.agents.state.research_state import ResearchState


def build_research_graph(
    checkpointer: Any | None = None,
) -> Any:
    """Build and compile the LangGraph StateGraph research workflow."""
    workflow = StateGraph(ResearchState)

    # 1. Add all nodes
    workflow.add_node("analyze", analyze_query_node)
    workflow.add_node("research", research_node)
    workflow.add_node("synthesize", synthesize_node)
    workflow.add_node("claim", claim_extraction_node)
    workflow.add_node("citation", citation_resolution_node)
    workflow.add_node("critique", critique_node)
    workflow.add_node("topology", topology_node)

    # 2. Add edges & conditional branches
    workflow.add_edge(START, "analyze")

    workflow.add_conditional_edges(
        "analyze",
        should_research,
        {
            "research": "research",
            "synthesize": "synthesize",
        },
    )

    workflow.add_edge("research", "synthesize")
    workflow.add_edge("synthesize", "claim")
    workflow.add_edge("claim", "citation")

    workflow.add_conditional_edges(
        "citation",
        should_critique,
        {
            "critique": "critique",
            "topology": "topology",
        },
    )

    workflow.add_edge("critique", "topology")
    workflow.add_edge("topology", END)

    saver = checkpointer if checkpointer is not None else MemorySaver()
    return workflow.compile(checkpointer=saver)
