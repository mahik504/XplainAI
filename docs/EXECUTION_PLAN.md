# XPLAINAI EXECUTION PLAN

**Goal:** Transform the XplainAI prototype into a production-grade, evidence-first autonomous research operating system.

## Phase 0: Baseline & Architecture Freeze (COMPLETED)
- **Objective:** Establish the current state of the codebase.
- **Tasks:**
  - Audited `frontend/` and `backend/`.
  - Generated `CURRENT_STATE.md`.
  - Saved `MASTER_PLAN.md` as the authoritative architecture document.

## Phase 1: P0 Stability & Security (COMPLETED)
- **Objective:** Fix immediate bugs, secure secrets, and stabilize builds.
- **Tasks:**
  - Fixed FastAPI WebSocket dependency injection (`WSPrincipalDep`, `WSLLMServiceDep`, etc.).
  - Stripped hardcoded `sk-or-...` OpenRouter keys from `ui-store.ts`.
  - Removed unused imports (`useUIStore`) from `AmbientShaderBackground.tsx` and `AsciiTerrainBackground.tsx`.
  - Increased WS connection limit to prevent 403 / dropped sockets.
  - Verified `pnpm build` and `pnpm typecheck` pass.

## Phase 2: Unify the Agent Architecture
- **Objective:** Establish LangGraph as the single source of truth for orchestration.
- **Tasks:**
  - Delete `pipeline.py` procedural generator.
  - Refactor `agents/graphs/research_graph.py` to handle all routing logic.
  - **Testing:** Integration verification ensuring old pipeline parity.

## Phase 3: Production Database
- **Objective:** Migrate from SQLite to PostgreSQL.
- **Tasks:**
  - Introduce `SQLAlchemy` models for: User, ResearchSession, Query, Source, Document, Claim, Evidence, Citation.
  - Setup `Alembic` for migrations.
  - Retain SQLite strictly for local dev modes.
  - **Missing Details (Added):** Implement DB indexing for session history and concurrent transaction handling for agent writes.

## Phase 4: Document Ingestion + pgvector + Hybrid RAG
- **Objective:** Build real RAG architecture to replace raw prompt stuffing.
- **Tasks:**
  - Integrate `pgvector` into Postgres schema.
  - Implement Document Parsers (HTML, PDF, MD) with metadata-aware chunking.
  - Implement `VectorStore` interface supporting multiple embedding providers.
  - Build BM25 + Vector Search hybrid retrieval layer with semantic reranking.

## Phase 5: Evidence, Claim, Citation & Contradiction Engine
- **Objective:** Transition to evidence-native answers.
- **Tasks:**
  - Build Extraction Agent to map chunks to Evidence.
  - Build Contradiction Analyst to find conflicting Evidence.
  - Map every Claim to specific Evidence IDs.
  - Ensure Citations point to exact document pages/passages.

## Phase 6: Streaming Event Architecture
- **Objective:** Enable robust asynchronous updates.
- **Tasks:**
  - Re-write LangGraph nodes to emit granular events (`search.started`, `claim.created`, `token.delta`).
  - Wire async event bus to WebSocket and SSE outputs.

## Phase 7: Deep Web Research Engine
- **Objective:** Reliable and polite web ingestion.
- **Tasks:**
  - Implement dedicated Research Crawler with robots.txt compliance, URL canonicalization, and deduplication.
  - Establish `SearchProvider` interfaces (Google, DuckDuckGo, Academic).
  - Add domain rate-limiting and timeouts.

## Phase 8: Verification + EGI 2.0
- **Objective:** Decomposable, deterministic evidence-grounding indicator.
- **Tasks:**
  - Implement the Verification Gate to check freshness, citation completeness, and contradictions before answering.
  - Calculate EGI based on weighted components (source quality, coverage, agreement) minus contradiction penalties.

## Phase 9: Agent/Tool Registry + Permissions + Sandbox
- **Objective:** Safe, governable tool execution.
- **Tasks:**
  - Build strict Tool Registry with RBAC permissions (`READ`, `WRITE`, `EXECUTE`).
  - Implement human-in-the-loop approvals for external side effects.
  - Execute code (Python/Shell) in secure isolated Docker containers (sandbox).

## Phase 10: Research Workspace Frontend Redesign
- **Objective:** Evolve UI from "chat" to "workspace".
- **Tasks:**
  - Implement Research Canvas with Overview, Evidence, Graph, and Sources tabs.
  - Revamp 3D Constellation with LOD and semantic clustering.
  - Enhance 2D DAG with expand/collapse logic and critical path filters.
  - Ensure WCAG 2.2 AA accessibility and keyboard navigation.

## Phase 11: Multimodal Research
- **Objective:** Process non-text data intelligently.
- **Tasks:**
  - Add vision-model support for chart and table parsing.
  - Fix broken image upload payload.
  - Ensure PDFs retain spatial bounding boxes for citations.

## Phase 12: Research Memory + Projects + Versioning
- **Objective:** Persistent, scoped knowledge.
- **Tasks:**
  - Introduce Project-level containers for scoping sessions.
  - Version major answers and track EGI changes over time.

## Phase 13: Artifacts + Sharing + Collaboration
- **Objective:** Professional deliverables.
- **Tasks:**
  - Implement Artifact Generators (PDF, PPTX, Markdown, Evidence Packs).
  - Add secure public sharing (`xplain.ai/r/<id>`).
  - *Future:* Real-time team collaboration with Roles/Permissions.

## Phase 14: Automation Engine
- **Objective:** Scheduled and triggered autonomous research.
- **Tasks:**
  - Build workflow engine linking Triggers (time/webhook) to Research Agents.
  - Enable continuous competitor/topic monitoring.

## Phase 15: Evaluation & Red Teaming
- **Objective:** Automated quality benchmarks.
- **Tasks:**
  - Build "Golden Dataset" of hard research questions.
  - Test citation precision, hallucination rate, and retrieval nDCG.
  - Red-team prompt injection and SSRF vectors.

## Phase 16: Production Deployment
- **Objective:** Resilient cloud hosting.
- **Tasks:**
  - Containerize services into multi-stage Docker builds.
  - Deploy Telemetry (OpenTelemetry, Grafana) and Rate Limiting (Redis).
  - Finalize Disaster Recovery and Backup procedures.

## Phase 17: Public Beta
- **Objective:** Secure, scalable launch.
- **Tasks:**
  - Enable multi-tenant auth and billing primitives (minute/token tracking).
  - Monitor abuse and limit API exhaustion.

## Phase 18: Scale + API + MCP Ecosystem
- **Objective:** Extensibility and platform scale.
- **Tasks:**
  - Launch Developer API for programmatic research.
  - Expose XplainAI capabilities as an MCP Server.
  - Support external MCP Clients within the tool registry.
