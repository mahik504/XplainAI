import asyncio
import os
import json
from mcp.server.mcpserver import MCPServer
import mcp.types as types

from neural_navigator.orchestration.pipeline import run_orchestrated_chat, OrchestrationResult
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.schemas.base import ChatMessage, Role
from neural_navigator.core.config import get_settings
from neural_navigator.services.llm import LLMService, OpenAICompatibleProvider

app = MCPServer("xplainai-mcp", version="1.0.0", description="XplainAI Deep Research Tool")

@app.tool()
async def deep_research(query: str, mode: str = "deep_research") -> str:
    """Run an orchestrated deep research task using XplainAI. Supports web scraping, multi-step reasoning, and source grounding.
    
    Args:
        query: The research question or topic.
        mode: The operation mode, usually 'deep_research'.
    """
    settings = get_settings()
    
    # Initialize LLM
    provider = OpenAICompatibleProvider(
        base_url=settings.llm_api_base,
        api_key=settings.llm_api_key.get_secret_value() if settings.llm_api_key else "dummy",
        timeout_seconds=settings.llm_timeout_seconds,
    )
    llm = LLMService(
        provider=provider,
        settings=settings,
        idle_timeout_seconds=settings.llm_stream_idle_timeout_seconds
    )
    
    messages = [ChatMessage(role=Role.USER, content=query)]
    run_mode = RunMode.parse(mode)
    
    assistant_parts = []
    orchestration_data = None
    
    try:
        async for item in run_orchestrated_chat(
            messages=messages,
            mode=run_mode,
            llm=llm,
            settings=settings,
        ):
            if isinstance(item, OrchestrationResult):
                orchestration_data = item.as_dict()
                continue
            if item.delta:
                assistant_parts.append(item.delta)
                
        response_text = "".join(assistant_parts)
        
        # Format the output nicely
        result_content = response_text
        if orchestration_data and "response_analysis" in orchestration_data:
            analysis = orchestration_data["response_analysis"]
            result_content += "\n\n---\n**Analysis & Trust Score:**\n"
            if "trust_score" in orchestration_data:
                result_content += f"Trust Score: {orchestration_data['trust_score']}/100\n"
            result_content += f"Sentences analyzed: {len(analysis.get('sentences', []))}"
            
        return result_content
    except Exception as e:
        return f"Error executing deep research: {str(e)}"
    finally:
        await llm.aclose()

if __name__ == "__main__":
    app.run()
