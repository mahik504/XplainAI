"""Tool execution and evidence retrieval node with search provider router and crawler."""

from __future__ import annotations

import asyncio
from typing import Any

from langchain_core.runnables import RunnableConfig
from langgraph.types import StreamWriter

from neural_navigator.agents.state.research_state import ResearchState
from neural_navigator.core.config import Settings
from neural_navigator.orchestration.extractors import extract_domain_sources_and_evidence
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.stages import OrchestrationStage
from neural_navigator.orchestration.tool_registry import ToolRegistry
from neural_navigator.orchestration.tools import (
    ToolResult,
    detect_math_expression,
    detect_weather_city,
    run_news,
    run_weather,
)
from neural_navigator.orchestration.url_ingest import extract_urls_from_text


async def research_node(
    state: ResearchState,
    config: RunnableConfig,
    writer: StreamWriter,
) -> dict[str, Any]:
    """Execute domain tools, web search, ArXiv, Wikipedia, and deep crawler concurrently."""
    configurable = config.get("configurable", {}) if isinstance(config, dict) else {}
    active_settings = configurable.get("settings") or Settings()
    active_registry = configurable.get("tool_registry") or ToolRegistry(active_settings)

    user_text = state.get("user_text", "")
    mode = RunMode.parse(state.get("mode"))
    research_tasks = state.get("research_tasks", [])

    tool_results: list[ToolResult] = []

    # 1. Calculator Tool
    math_expr = detect_math_expression(user_text)
    if math_expr:
        if writer is not None:
            writer(
                {
                    "type": "stage",
                    "stage": OrchestrationStage.TOOL_STARTED,
                    "data": {"tool": "calculator", "query": math_expr},
                }
            )
        calc = await active_registry.execute("calculator", expression=math_expr)
        tool_results.append(calc)
        if writer is not None:
            writer(
                {
                    "type": "stage",
                    "stage": OrchestrationStage.TOOL_COMPLETED,
                    "data": calc.as_dict(),
                }
            )

    # 2. Weather Tool
    city = detect_weather_city(user_text)
    if city and mode is not RunMode.FAST:
        if writer is not None:
            writer(
                {
                    "type": "stage",
                    "stage": OrchestrationStage.TOOL_STARTED,
                    "data": {"tool": "weather", "city": city},
                }
            )
        weather = await run_weather(city, settings=active_settings)
        tool_results.append(weather)
        if writer is not None:
            writer(
                {
                    "type": "stage",
                    "stage": OrchestrationStage.TOOL_COMPLETED,
                    "data": weather.as_dict(),
                }
            )

    # 3. URL Ingestion / Deep Crawler Tool
    detected_urls = extract_urls_from_text(user_text)
    for url in detected_urls[:2]:
        if writer is not None:
            writer(
                {
                    "type": "stage",
                    "stage": OrchestrationStage.TOOL_STARTED,
                    "data": {"tool": "url_ingest", "url": url},
                }
            )
        url_res = await active_registry.execute("url_ingest", url=url)
        tool_results.append(url_res)
        if writer is not None:
            writer(
                {
                    "type": "stage",
                    "stage": OrchestrationStage.TOOL_COMPLETED,
                    "data": url_res.as_dict(),
                }
            )

    # 4. Multi-query research execution based on research mode
    if mode is not RunMode.FAST:
        max_queries = 2 if mode is RunMode.BALANCED else (4 if mode is RunMode.COMPLEX else 3)
        max_results = 5 if mode is RunMode.BALANCED else (10 if mode is RunMode.COMPLEX else 8)

        queries = (research_tasks or [user_text])[:max_queries]

        async def _execute_search_query(q: str) -> list[ToolResult]:
            sub_res: list[ToolResult] = []
            if writer is not None:
                writer(
                    {
                        "type": "stage",
                        "stage": OrchestrationStage.TOOL_STARTED,
                        "data": {"tool": "web_search", "query": q, "max_results": max_results},
                    }
                )
            search = await active_registry.execute(
                "web_search", query=q, max_results=max_results
            )
            sub_res.append(search)
            if writer is not None:
                writer(
                    {
                        "type": "stage",
                        "stage": OrchestrationStage.TOOL_COMPLETED,
                        "data": search.as_dict(),
                    }
                )
            return sub_res

        search_batches = await asyncio.gather(*[_execute_search_query(q) for q in queries], return_exceptions=True)
        for batch in search_batches:
            if isinstance(batch, list):
                tool_results.extend(batch)

        if active_settings.newsdata_api_key is not None:
            news = await run_news(user_text, settings=active_settings)
            tool_results.append(news)

    sources, evidence = extract_domain_sources_and_evidence(tool_results)

    return {
        "tool_results": [tr.as_dict() for tr in tool_results],
        "sources": [s.as_dict() for s in sources],
        "evidence": [e.as_dict() for e in evidence],
        "current_stage": "research_completed",
    }
