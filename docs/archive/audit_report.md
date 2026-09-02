# XplainAI Architecture & Codebase Audit Report

**Document Version**: 1.0.0  
**Date**: September 1, 2026  
**Audited Target**: XplainAI Autonomous Explainable Research Workspace (`neural-navigator` v2.1.0 / Frontend v0.1.0)  
**Authors**: Architecture Audit & Orchestration Team  

---

## 1. Executive Summary

XplainAI is designed as an autonomous, high-rigor research workspace that delivers explainable artificial intelligence (XAI). It provides verifiable evidence grounding through an Epistemic Grounding Index ($EGI$), interactive 2D DAG and 3D WebGL constellation graph visualizers, and multi-agent synthesis.

This comprehensive audit evaluated the codebase against the Product Requirement Document (`docs/PRD.md` v2.2.0), Architecture Specifications (`docs/ARCHITECTURE.md`), and ADR records (`docs/adr/`).

### Overall Health Assessment
- **Frontend**: **Strong foundation with 2 critical blockers**. High-quality React 19 + Three.js 3D visualization and 100% unit test coverage (68/68 passing). However, production builds (`pnpm build`) fail due to unused import strictness (`TS6133`), and a live OpenRouter API key is exposed in client source.
- **Backend**: **Solid domain models with 1 critical transport bug and architectural divergence**. Strong deterministic $EGI$ scoring and SSRF protections (109/131 tests passing). However, 22 WebSocket E2E tests fail due to FastAPI dependency injection type resolution errors. Furthermore, a dual architecture exists: the system runs on a monolithic procedural generator (`pipeline.py`) while an advanced LangGraph state machine (`agents/graphs/research_graph.py`) remains disconnected due to missing token-level streaming callbacks.
- **Data & Vector Layer**: **Significant PRD gap**. `infrastructure/vectorstore/` contains only placeholder files (`.gitkeep`). Document ingestion dumps raw unchunked text directly into prompts, and research state is serialized as unstructured JSON blobs into SQLite.

---

## 2. Current Architecture & Technology Stack

| Layer | Audited Technologies | Status | Key Characteristics |
|---|---|---|---|
| **Frontend UI** | React 19, TypeScript, Vite, TailwindCSS, Lucide Icons | Active | Component-driven, modular UI layouts |
| **Visualizations** | Three.js (`@react-three/fiber`), React Flow (`@xyflow/react`) | Active | Dual-mode: 3D Constellation Galaxy & 2D Dependency DAG |
| **Client State** | Zustand | Active | Isolated stores for sessions, UI settings, graph filtering |
| **Backend API** | FastAPI, Uvicorn, Starlette WebSockets, Pydantic v2 | Active | Async REST + full-duplex WebSocket endpoints |
| **Orchestration** | Procedural Pipeline (`pipeline.py`) & LangGraph v0.2 | Fragmented | Dual implementation; procedural active, LangGraph unlinked |
| **LLM Gateway** | LiteLLM, OpenAI, Anthropic, Ollama, Echo Provider | Active | Unified client interface with token streaming & fallback |
| **Persistence** | SQLite (`sqlite3` with thread locks) | Active | Single-file database with unindexed JSON text blobs |
| **Vector Database** | `pgvector` (Docker Compose provisioned) | Inactive | Empty implementation directories; no SQLAlchemy models |
| **Observability** | OpenTelemetry, Prometheus exporter, Loguru | Configured | Docker Compose telemetry stack ready |

---

## 3. Detailed Audit Findings

### 3.1 Critical Bugs & Build Blockers (P0)

1. **FastAPI Dependency Injection Failure on WebSockets (Backend)**
   - **Location**: `backend/src/neural_navigator/api/websocket.py:52-60` and `backend/src/neural_navigator/api/chat.py:36-44`
   - **Mechanism**: Dependency aliases (`SettingsDep`, `WSPrincipalDep`, `LLMServiceDep`, `EventBusDep`) are imported under `if TYPE_CHECKING:`. At runtime, FastAPI inspects function signatures using `get_type_hints()`. Because these types exist only at type-check time, FastAPI fails to resolve `Depends()` and defaults to treating them as required URL query parameters.
   - **Impact**: All WebSocket handshakes are rejected with `WebSocketDisconnect(code=1008, reason="Field required: principal, settings")`, causing **22 out of 131 backend tests to fail**.
   - **Resolution**: Move dependency type definitions to top-level runtime imports in `websocket.py` and `chat.py`.

2. **TypeScript Compilation Failure (`TS6133`) (Frontend)**
   - **Location**: `frontend/src/components/common/AmbientShaderBackground.tsx:3` and `AsciiTerrainBackground.tsx:2`
   - **Mechanism**: `useUIStore` is imported but never referenced in component bodies. `tsconfig.app.json` enforces `"noUnusedLocals": true`.
   - **Impact**: `pnpm build` (`tsc --build && vite build`) and `pnpm typecheck` abort with exit code 2.
   - **Resolution**: Remove unused imports from background component files.

3. **Hardcoded API Key Secret Leak (Frontend Security)**
   - **Location**: `frontend/src/stores/ui-store.ts:70-73`
   - **Mechanism**: Plaintext OpenRouter API key (`sk-or-v1-0261963a32af97fbc...`) is hardcoded as default state.
   - **Impact**: Critical security vulnerability; leaks private credentials in production bundles.
   - **Resolution**: Reset default configuration fields to empty strings.

4. **Corrupted Unicode Mojibake (Frontend)**
   - **Location**: `frontend/src/lib/conversation-export.ts:73-118` and `frontend/src/stores/session-store.ts:167`
   - **Mechanism**: Incorrect UTF-8 encoding converted markdown emojis and symbols into mojibake (`dY"S`, `s-,?`).
   - **Impact**: Degrades visual quality of exported research reports and session transcripts.
   - **Resolution**: Replace corrupted character sequences with clean standard UTF-8 characters.

---

### 3.2 Architectural Inefficiencies & Tech Debt (P1)

1. **Orchestration Divergence (Monolithic Pipeline vs. LangGraph)**
   - `backend/src/neural_navigator/orchestration/pipeline.py` contains 450 lines of procedural async generator code managing tool calls, state assembly, and token yielding.
   - Concurrently, `backend/src/neural_navigator/agents/graphs/research_graph.py` implements a 7-node LangGraph state machine (`analyze` → `research` → `synthesize` → `claim` → `citation` → `critique` → `topology`).
   - **The Bottleneck**: `synthesize_node.py` buffers the entire LLM response into a single string. `agents/runtime.py` therefore cannot stream tokens incrementally. Consequently, `websocket.py` remains pinned to the procedural `pipeline.py`.
   - **Redesign**: Refactor `synthesize_node.py` with an async streaming queue/callback mechanism, allowing `agents/runtime.py` to stream tokens in real time and completely replace `pipeline.py`.

2. **Vector Store & Document Grounding Vacuum**
   - Ingested URLs and papers (`url_ingest.py`) are downloaded, truncated to 8,000 characters, and inserted directly into the system prompt.
   - No vector embeddings, chunking strategy, or similarity retrieval exist in `infrastructure/vectorstore/`.
   - **Impact**: Large documents exceed context limits, multi-document research cannot perform cross-source synthesis, and claim-evidence semantic similarity cannot be verified at scale.
   - **Redesign**: Implement `VectorStore` (supporting in-memory cosine search and `pgvector` integration) with recursive character chunking and embedding generation.

3. **Synchronous SQLite Database with Unindexed JSON Blobs**
   - `services/conversations.py` uses synchronous `sqlite3` operations wrapped in Python `threading.Lock()`.
   - Research graphs, claims, and citations are dumped as unstructured text in `messages.pipeline_state`.
   - **Impact**: Database writes block the async event loop under concurrent load; claims and evidence cannot be queried or cross-referenced across research sessions.
   - **Redesign**: Define relational SQLAlchemy / Alembic models for `ResearchSession`, `Claim`, `Evidence`, and `Citation`.

4. **Hardcoded Post-Analysis Heuristics**
   - `orchestration/post_analysis.py` matches queries against fixed regexes (`"react"`, `"postgres"`, `"quantum"`) to produce static pre-written counter-arguments.
   - **Redesign**: Replace regex lookup with model-driven dialectic critique agents.

---

## 4. PRD v2.2.0 vs. Codebase Gap Analysis

| PRD Section | Required Capability | Current Implementation | Gap / Status |
|---|---|---|---|
| **§3.1 Dialectic Engine** | Multi-agent Thesis / Antithesis / Synthesis | Procedural pipeline with regex heuristics | Partially implemented; LangGraph critique node exists but is unlinked |
| **§3.2 Epistemic Grounding** | Mathematical $EGI \in [0, 1]$ metric | Python $EGI$ scoring function implemented | Complete and passing unit tests |
| **§3.3 Dual Graph UI** | 3D Constellation + 2D Interactive DAG | Three.js + React Flow fully implemented | Complete; 68/68 Vitest tests passing |
| **§4.1 Vector Store** | pgvector indexing for document retrieval | Empty `.gitkeep` files in `vectorstore/` | Missing; RAG relies on raw prompt stuffing |
| **§4.2 Streaming Telemetry** | Live WebSocket stage & token events | Active via `pipeline.py` (FastAPI DI bug blocked tests) | Unblock via DI fix; migrate to LangGraph |
| **§4.3 Multimodal Input** | Optical camera capture & PDF attachment | UI captures frame, but AppShell drops `_imgUrl` | Payload dropped before reaching backend |

---

## 5. Strategic Architecture Redesign Proposals

### Proposal 1: Unified LangGraph Streaming Pipeline
```
[Client WebSocket]
       │  ▲ (token.delta / stage.started)
       ▼  │
[ChatSocketSession]
       │
       ▼
[LangGraph StateGraph Runner]
       ├──> [Analyze Node]
       ├──> [Research Node (ArXiv, Wiki, VectorStore)]
       ├──> [Synthesize Node] ──(Async Queue)──> [Token Streamer]
       ├──> [Claim Extraction Node]
       ├──> [Citation Grounding Node]
       ├──> [Dialectic Critique Node]
       └──> [Topology Generator Node]
```

### Proposal 2: Hybrid RAG & PgVector Architecture
- **Chunking**: Recursive text splitter (500 tokens with 50-token overlap).
- **Embedding**: Modular embedding adapter (`text-embedding-3-small`, `all-MiniLM-L6-v2`, or local Ollama).
- **Storage**: `pgvector` container with `HNSW` cosine similarity index for sub-10ms retrieval over millions of claim/evidence vectors.

### Proposal 3: Full Containerization & DevEx
- Dockerfile multi-stage builds for frontend (Nginx alpine) and backend (Python 3.12 slim).
- `docker-compose.yml` pre-configured for one-command startup of `backend`, `frontend`, `pgvector`, `redis`, and `otel-collector`.

---

## 6. Selected Proof-of-Concept Prototype Implementation

To prove out the redesign and restore system stability, the following changes are implemented in the codebase:

1. **Dependency Injection & Transport Layer (Stability PoC)**:
   - Fix runtime imports in `backend/src/neural_navigator/api/websocket.py` and `backend/src/neural_navigator/api/chat.py`.
   - Verify that all 131 backend tests pass without error.

2. **Frontend Type Safety & Secret Scrubbing (Build PoC)**:
   - Remove unused imports in `AmbientShaderBackground.tsx` and `AsciiTerrainBackground.tsx`.
   - Clean up leaked API key in `ui-store.ts` and fix unicode mojibake in `conversation-export.ts` and `session-store.ts`.
   - Verify `pnpm build` and `pnpm test` pass with 0 errors.

3. **LangGraph Streaming Synthesis Modernization (Architecture PoC)**:
   - Enhance `agents/nodes/synthesize_node.py` and `agents/runtime.py` to support real-time async token streaming callbacks during LangGraph graph execution.

---

## 7. Prioritized Implementation Roadmap

```
[P0 - Immediate Fixes] (Done in Prototype)
├── Fix FastAPI WebSocket Dependency Imports
├── Fix Frontend Unused Imports (Restore pnpm build)
├── Scrub Exposed API Keys from Client Stores
└── Clean Unicode Encoding Mojibake

[P1 - Core Architecture]
├── LangGraph Streaming Token Integration in WebSocket Gateway
├── PgVector & Chunked RAG VectorStore Implementation
└── Connect Multimodal Camera Capture & File Upload to LLM Gateway

[P2 - Persistence & Rigor]
├── Relational SQLAlchemy Models for Claims, Evidence, ResearchSessions
└── Dynamic LLM-driven Dialectic Critique Node (Replacing Regex Heuristics)

[P3 - Production Readiness]
├── Multi-stage Production Dockerfiles
└── Automated E2E CI/CD Pipeline (GitHub Actions)
```

---

## 8. Conclusion

The XplainAI system possesses exceptional core algorithms and frontend visualization capabilities. Resolving the identified dependency injection defect and build issues restores the codebase to 100% test passing health. Modernizing the pipeline orchestrator with LangGraph streaming synthesis and integrating pgvector positions XplainAI as a state-of-the-art autonomous explainable intelligence platform.
