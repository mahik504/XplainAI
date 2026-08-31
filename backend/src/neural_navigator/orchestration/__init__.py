"""Observable orchestration for XplainAI runs.

Stages represent system progress (query analysis, tools, generation, post-analysis,
graph construction, EGI calculation), never private model chain-of-thought.
"""

from neural_navigator.orchestration.analyzers import (
    QueryAnalysis,
    analyze_query,
    decompose_research_tasks,
    latest_user_text,
)
from neural_navigator.orchestration.augmenters import (
    build_augmented_messages,
    format_tool_results_block,
)
from neural_navigator.orchestration.citations import (
    parse_citation_markers,
    resolve_inline_citations,
)
from neural_navigator.orchestration.egi import compute_egi_score
from neural_navigator.orchestration.extractors import extract_domain_sources_and_evidence
from neural_navigator.orchestration.graph_engine import (
    build_evidence_graph,
    extract_claims_from_text,
)
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.pipeline import (
    OrchestrationResult,
    StageEmitter,
    run_orchestrated_chat,
)
from neural_navigator.orchestration.post_analysis import (
    MissingContextItem,
    build_counter_perspective,
    detect_missing_context,
)
from neural_navigator.orchestration.sources import RetrievedSource, sources_from_tool_results
from neural_navigator.orchestration.stages import OrchestrationStage
from neural_navigator.orchestration.tool_registry import ToolRegistry
from neural_navigator.orchestration.tools import ToolResult

__all__ = [
    "MissingContextItem",
    "OrchestrationResult",
    "OrchestrationStage",
    "QueryAnalysis",
    "RetrievedSource",
    "RunMode",
    "StageEmitter",
    "ToolRegistry",
    "ToolResult",
    "analyze_query",
    "build_augmented_messages",
    "build_counter_perspective",
    "build_evidence_graph",
    "compute_egi_score",
    "decompose_research_tasks",
    "detect_missing_context",
    "extract_claims_from_text",
    "extract_domain_sources_and_evidence",
    "format_tool_results_block",
    "latest_user_text",
    "parse_citation_markers",
    "resolve_inline_citations",
    "run_orchestrated_chat",
    "sources_from_tool_results",
]
