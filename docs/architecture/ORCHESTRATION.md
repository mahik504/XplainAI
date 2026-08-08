# XplainAI Orchestration

XplainAI keeps a single WebSocket chat transport and a single OpenAI-compatible LLM abstraction.

## Pipeline

```
USER → chat.send(mode)
  → query_analyzed
  → mode_selected
  → context_check
  → research_started (skipped in Fast)
  → tool_started / tool_completed (Balanced selective · Deep multi-query)
  → generation_started → run.token*
  → generation_completed
  → completed
```

Frontend then runs the **canonical** client-side response analyzer and morphs the stage graph into the Response Structure graph.

## Honesty rules

- Stages are system progress, not private chain-of-thought.
- Retrieved web/news items are **SOURCE RETRIEVED**, not automatic claim proof.
- Structural Signal ≠ trustworthiness / factual verification.
