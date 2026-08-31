from mcp.server.mcpserver import MCPServer

from neural_navigator.core.config import get_settings
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.pipeline import OrchestrationResult, run_orchestrated_chat
from neural_navigator.schemas.base import ChatMessage
from neural_navigator.utils.constants import Role
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
        base_url=settings.llm_base_url,
        api_key=settings.openai_api_key.get_secret_value() if settings.openai_api_key else "dummy",
        timeout_seconds=settings.llm_request_timeout_seconds,
    )
    llm = LLMService(
        provider=provider,
        settings=settings,
    )
    
    messages = [ChatMessage(role=Role.USER, content=query)]
    run_mode = RunMode.parse(mode)
    
    assistant_parts = []
    orchestration_data = None
    
    from typing import Any
    async def dummy_emit_stage(stage: Any, data: Any = None) -> None:
        pass
        
    try:
        async for item in run_orchestrated_chat(
            messages=messages,
            mode=run_mode,
            llm=llm,
            settings=settings,
            emit_stage=dummy_emit_stage,
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
        return f"Error executing deep research: {e!s}"
    finally:
        await llm.aclose()

if __name__ == "__main__":
    app.run()
