# RAG / Documents — extension point (deferred in v2.1)

P2 was deliberately not shipped in 2.1 to protect P0/P1 quality.

## Fit into existing pipeline

```
Upload → Parse → Chunk → Retrieve → (tool result / RetrievedSource)
  → Generation (canonical LLM path)
  → Response analysis (canonical XAI path)
  → Structure graph
```

## How to attach cleanly

1. Add a `document` tool beside `web_search` / `calculator` in `orchestration/tools.py`.
2. Emit results as `RetrievedSource` with `source_type: "document"` and stable `source_id`.
3. Surface in UI via existing `RetrievedSourcesCard` (“From your document”).
4. Never mark document snippets as factual proof — same honesty rules as web sources.

## Do not

- Duplicate the LLM or analysis path
- Call retrieval “evidence proof”
- Block token streaming on indexing
