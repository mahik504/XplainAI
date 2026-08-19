# XplainAI ? Data Flow & Event Protocol

## 1. End-to-End Execution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as XplainAI Workspace
    participant API as FastAPI Gateway
    participant Engine as Research Engine
    participant Tools as Tool Registry
    participant LLM as Model Gateway
    participant Store as Graph Store

    User->>Frontend: Submit Question + Mode
    Frontend->>API: Open WebSocket (/ws/v1/chat)
    API->>Engine: Initialize ResearchRun
    Engine-->>Frontend: event: research.started
    
    Engine->>Engine: Plan Research Tasks
    Engine-->>Frontend: event: research.plan (sub-queries)
    
    par Multi-source Discovery
        Engine->>Tools: Execute Web / Academic Search
        Tools-->>Engine: Raw web snippets / metadata
        Engine-->>Frontend: event: source.discovered (source_id, url, title)
    end
    
    Engine->>Engine: Normalize & Extract Evidence
    Engine-->>Frontend: event: evidence.extracted (evidence_id, text, source_id, score)
    
    Engine->>LLM: Synthesize Grounded Answer with Evidence
    loop Token Streaming
        LLM-->>Engine: Text chunks & citation anchors
        Engine-->>Frontend: event: answer.token (delta, citation_id)
    end
    
    Engine->>Engine: Extract Claims & Detect Contradictions
    Engine-->>Frontend: event: claim.mapped (claim_id, text, evidence_ids, status)
    Engine-->>Frontend: event: graph.topology (nodes, edges)
    
    Engine->>Store: Persist ResearchRun, Claims, Sources & Graph
    Engine-->>Frontend: event: run.completed (summary, trust_metrics)
    
    User->>Frontend: Click Claim [C1]
    Frontend->>Frontend: Highlight Claim Subgraph (2D/3D)
    Frontend->>Frontend: Open Source Snippet Inspector
```

## 2. Semantic Event Schema
- `research.started`: `{ run_id, mode, query, timestamp }`
- `research.plan`: `{ run_id, tasks: [{ task_id, query, intent }] }`
- `source.discovered`: `{ run_id, source_id, title, url, domain, authority_score }`
- `evidence.extracted`: `{ run_id, evidence_id, source_id, snippet, confidence }`
- `answer.token`: `{ run_id, delta, citation_id? }`
- `claim.mapped`: `{ run_id, claim_id, text, status: "supported"|"unverified"|"contradicted", evidence_ids: [] }`
- `graph.topology`: `{ run_id, nodes: [], edges: [] }`
- `run.completed`: `{ run_id, status: "completed", metrics: { claims_count, verified_ratio, source_count } }`\n