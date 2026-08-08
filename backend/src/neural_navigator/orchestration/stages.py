"""Canonical orchestration stage identifiers exposed to the client."""

from __future__ import annotations

from enum import StrEnum


class OrchestrationStage(StrEnum):
    QUERY_ANALYZED = "query_analyzed"
    MODE_SELECTED = "mode_selected"
    CONTEXT_CHECK = "context_check"
    RESEARCH_STARTED = "research_started"
    TOOL_STARTED = "tool_started"
    TOOL_COMPLETED = "tool_completed"
    GENERATION_STARTED = "generation_started"
    GENERATION_COMPLETED = "generation_completed"
    ANALYSIS_STARTED = "analysis_started"
    ANALYSIS_COMPLETED = "analysis_completed"
    STRUCTURE_READY = "structure_ready"
    COMPLETED = "completed"


# Ordered pipeline stages shown on the live execution graph (pre-structure morph).
PIPELINE_STAGE_ORDER: tuple[OrchestrationStage, ...] = (
    OrchestrationStage.QUERY_ANALYZED,
    OrchestrationStage.MODE_SELECTED,
    OrchestrationStage.CONTEXT_CHECK,
    OrchestrationStage.RESEARCH_STARTED,
    OrchestrationStage.TOOL_STARTED,
    OrchestrationStage.GENERATION_STARTED,
    OrchestrationStage.GENERATION_COMPLETED,
)
