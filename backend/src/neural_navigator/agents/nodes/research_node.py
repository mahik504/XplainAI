"""Tool execution and evidence retrieval node for the LangGraph research state machine."""

from __future__ import annotations

from typing import Any

from neural_navigator.agents.state.research_state import (
    ResearchState,  # noqa: TC001 - Required for LangGraph node type hint reflection
)
from neural_navigator.core.config import Settings
from neural_navigator.orchestration.extractors import extract_domain_sources_and_evidence
from neural_navigator.orchestration.modes import RunMode
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
    *,
    settings: Settings | None = None,
    tool_registry: ToolRegistry | None = None,
) -> dict[str, Any]:
    """Execute domain tools, web search, ArXiv, Wikipedia, and calculate structured sources."""
    active_settings = settings or Settings()
    active_registry = tool_registry or ToolRegistry(active_settings)

    user_text = state.get("user_text", "")
    mode = RunMode.parse(state.get("mode"))
    research_tasks = state.get("research_tasks", [])

    tool_results: list[ToolResult] = []

    # 1. Calculator Tool
    math_expr = detect_math_expression(user_text)
    if math_expr:
        calc = await active_registry.execute("calculator", expression=math_expr)
        tool_results.append(calc)

    # 2. Weather Tool
    city = detect_weather_city(user_text)
    if city and mode is RunMode.DEEP_RESEARCH:
        weather = await run_weather(city, settings=active_settings)
        tool_results.append(weather)

    # 3. URL Ingestion Tool
    detected_urls = extract_urls_from_text(user_text)
    for url in detected_urls[:3]:
        url_res = await active_registry.execute("url_ingest", url=url)
        tool_results.append(url_res)

    # 4. Deep Research multi-query execution
    if mode is RunMode.DEEP_RESEARCH:
        queries = research_tasks or [user_text]
        for query in queries[:4]:
            search = await active_registry.execute("web_search", query=query, max_results=5)
            tool_results.append(search)

            arxiv_res = await active_registry.execute("arxiv", query=query, max_results=3)
            if arxiv_res.status == "ok":
                tool_results.append(arxiv_res)

            wiki_res = await active_registry.execute("wikipedia", query=query)
            if wiki_res.status == "ok":
                tool_results.append(wiki_res)

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
