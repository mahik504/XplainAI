# XPLAINAI — MASTER IMPLEMENTATION & EVOLUTION PLAN

## From Current Prototype → Production-Grade Autonomous Research & Agentic Intelligence Platform

**Source of truth:** Current XplainAI architecture/codebase audit supplied by the project.
**Target:** A publicly hostable, reliable, explainable research platform that can compete on research depth, evidence quality, web intelligence, agentic execution, and automation—not merely another AI chat UI.

---

# 0. NON-NEGOTIABLE PRODUCT VISION

XplainAI should **not** attempt to become “ChatGPT with more features.”

Build it as an:

> **Evidence-first Autonomous Research Operating System**

The fundamental unit is not a chat message.

It is:

**Question → Investigation → Sources → Evidence → Claims → Contradictions → Reasoning → Synthesis → Verification → Deliverable → Persistent Knowledge**

The product should differentiate through:

1. **Evidence-native answers**
2. **Explicit claim/evidence/citation relationships**
3. **Multi-agent research**
4. **Deep web investigation**
5. **Source credibility and provenance**
6. **Contradiction detection**
7. **Explainable reasoning topology**
8. **Persistent research memory**
9. **Agentic tools and workflows**
10. **Research automation**
11. **Multimodal research**
12. **Exportable professional deliverables**
13. **Reproducible research sessions**
14. **Human approval checkpoints**
15. **Model/provider independence**

Do not market it as “better at everything than ChatGPT.”

Market it as:

> **The research workspace where every important claim can be traced back to evidence, challenged, verified, and reused.**

---

# 1. CURRENT STATE → TARGET STATE

## Current strengths to preserve

* React 19 + TypeScript + Vite
* TailwindCSS
* Zustand
* React Flow 2D DAG
* Three.js / React Three Fiber 3D constellation
* FastAPI
* Pydantic
* LiteLLM
* OpenAI / Anthropic / Ollama adapters
* WebSocket streaming
* LangGraph foundation
* deterministic EGI scoring
* SSRF protection
* OpenTelemetry / Prometheus / Loguru
* existing modular component architecture
* existing research graph concept

## Current weaknesses to eliminate

* procedural pipeline vs LangGraph duplication
* WebSocket dependency-injection failure
* frontend build failure
* exposed API key
* Unicode corruption
* raw prompt stuffing instead of RAG
* missing vector store implementation
* synchronous SQLite persistence
* JSON blobs instead of relational research entities
* disconnected LangGraph
* non-streaming synthesis node
* regex-based critique
* dropped multimodal payload
* insufficient production security
* insufficient ingestion infrastructure
* insufficient source provenance
* insufficient agent/tool governance
* insufficient evaluation framework
* insufficient observability
* insufficient multi-user architecture

---

# 2. PHASE 0 — RECONNAISSANCE & CODEBASE FREEZE

Before adding features, establish the exact current baseline.

## Tasks

Run and document:
- pnpm install
- pnpm typecheck
- pnpm build
- pnpm test

Backend:
- pytest
- pytest --cov
- ruff check
- mypy

Also inspect:
frontend/, backend/, docs/, tests/, docker-compose*, .env*, .github/

Create:
docs/CURRENT_STATE.md, ARCHITECTURE.md, THREAT_MODEL.md, DATA_MODEL.md, API_CONTRACT.md, AGENT_SYSTEM.md, EVALUATION.md, DEPLOYMENT.md, ROADMAP.md

Create a baseline matrix: Feature, Implementation status, Tests, Known bugs, Production readiness, Owner, Priority.

Do not begin large refactors until this baseline is committed.

---

# 3. PHASE 1 — P0 STABILITY & SECURITY

## 3.1 Fix FastAPI WebSocket dependency injection
Fix runtime imports in websocket.py and chat.py. Ensure SettingsDep, WSPrincipalDep, LLMServiceDep, EventBusDep exist at runtime.
Acceptance: 131/131 backend tests passing, 0 WebSocket handshake failures, 0 dependency-resolution errors.

# 4. FRONTEND BUILD & TYPE SAFETY
Remove unused imports from AmbientShaderBackground.tsx, AsciiTerrainBackground.tsx.
Run pnpm typecheck, build, test.
Acceptance: 0 TypeScript errors, 0 build errors, 68/68 existing frontend tests passing. Enable CI.

# 5. SECRET MANAGEMENT — CRITICAL
Immediately remove every API key, token, credential, cookie, private endpoint credential, and provider secret from frontend source.
Architecture: Browser -> XplainAI Backend -> Provider Gateway -> OpenAI/etc.
Acceptance: No credentials in repository, client bundle, logs, error traces.

# 6. FIX DATA CORRUPTION
Clean conversation-export.ts, session-store.ts. Replace mojibake with valid UTF-8.
Add tests for emoji, Indian languages, CJK, Arabic, special symbols, Markdown, code blocks, citations, URLs, PDF export.

---

# 7. PHASE 2 — UNIFY THE AGENT ARCHITECTURE
Delete the conceptual duplication between pipeline.py and agents/graphs/research_graph.py. LangGraph becomes the single source of truth for orchestration.

# 8. STREAMING-FIRST LANGGRAPH RUNTIME
Rewrite synthesize_node.py, runtime.py to support event-driven execution. Use an async event bus.

# 9. RESEARCH STATE MODEL
Replace arbitrary JSON blobs with typed state. Use Pydantic models for boundaries. Use immutable/event-oriented updates wherever practical.

---

# 10. PHASE 3 — PRODUCTION DATABASE
Move from SQLite + JSON blobs to PostgreSQL + SQLAlchemy + Alembic. SQLite can remain as an explicit local-development mode.

# 11. PHASE 4 — REAL RAG / KNOWLEDGE FABRIC
Implement the currently missing vector layer. Implement VectorStore interface, PgVectorStore, InMemoryVectorStore, EmbeddingProvider, Retriever, Reranker.

# 12. BETTER CHUNKING
Create document-type-aware ingestion. Each chunk should retain document_id, chunk_id, source_url, title, author, publisher, publication_date, page_number, section, paragraph, token_count, content_hash, embedding. Use hierarchical retrieval.

# 13. HYBRID RETRIEVAL
BM25/lexical search + vector search + metadata filtering + semantic reranking. Support source filters.

---

# 14. EVIDENCE-FIRST RESEARCH ENGINE
Every meaningful claim must have Claim ID, text, Evidence IDs, Source IDs, Citation, Confidence, Support score, Contradiction status, Verification status, Timestamp.

# 15. UPGRADE EGI INTO A REAL EPISTEMIC SYSTEM
Keep deterministic EGI. Do not let an LLM arbitrarily invent the score. Define components. Every score must be decomposable.

# 16. SOURCE INTELLIGENCE SYSTEM
Every source receives a structured profile. Classify sources. Do not simply label sources “trustworthy/untrustworthy.” Show why.

# 17. WEB RESEARCH ENGINE
Build a dedicated research crawler. URL canonicalization, duplicate detection, redirect handling, robots compliance, rate limiting, timeouts.

# 18. SEARCH PROVIDER ABSTRACTION
Create SearchProvider with adapters. Allow multiple providers. Use query diversification.

---

# 19. AGENT TEAM ARCHITECTURE
Create specialized roles: Planner, Researcher, Source Analyst, Evidence Analyst, Contradiction Analyst, Critic, Synthesizer, Verifier, Artifact Agent.

# 20. DIALECTIC ENGINE
Replace the current regex heuristics completely. Thesis -> Antithesis -> Evidence comparison -> Contradiction extraction -> Resolution -> Synthesis.

# 21. VERIFICATION GATE
Before returning a high-rigor answer: Draft -> Claim extraction -> Citation mapping -> Evidence validation -> Contradiction check -> Freshness check -> Citation completeness -> Final answer.

# 22. CLAIM GRAPH + KNOWLEDGE GRAPH
The existing DAG should evolve into a real research graph.

---

# 23. FRONTEND — REDESIGN AROUND RESEARCH, NOT CHAT
Keep the existing visual identity and constellation concept, but restructure the application to a research workspace.

# 24. RESEARCH CANVAS
Core workspace modes: Overview, Research, Evidence, Graph, Sources, Timeline, Artifacts, Agents, Automation.

# 25. ANSWER EXPERIENCE
Each answer should support: Executive answer -> Key findings -> Claims -> Evidence -> Contradictions -> Methodology -> Sources.

# 26. CITATION UX
Citation numbers should be interactive. No dead citations.

# 27. 3D CONSTELLATION IMPROVEMENT
Add semantic clustering, zoom-to-evidence. Add performance controls (LOD, virtualization).

# 28. 2D DAG IMPROVEMENT
Add collapse/expand, edge filtering, claim-only mode, critical path, export SVG/PNG.

# 29. MULTIMODAL RESEARCH
Fix the current dropped image payload. Support PDF, images, tables, charts, video.

# 30. TABLE & FIGURE INTELLIGENCE
Detect tables, extract structure, normalize, analyze.

# 31. CODE & REPOSITORY RESEARCH
Add repository intelligence (GitHub repo ingestion, file tree, dependencies).

---

# 32. AGENTIC TOOL SYSTEM
Create a formal Tool Registry.

# 33. TOOL PERMISSION MODEL
Never give an agent unrestricted access. Require confirmation for destructive/external actions.

# 34. AGENT SANDBOX
Agent execution should occur in isolated environments.

# 35. BROWSER AGENT
Build browser automation as a controlled tool. Agent must cite pages it used.

# 36. DEEP RESEARCH MODE
Quick, Research, Deep Research, Autonomous Investigation modes.

# 37. RESEARCH BUDGET
Every agent run needs a budget. Show live time, sources, agent calls, tokens, estimated cost.

# 38. MODEL ROUTER
Create ModelRouter. Route based on task, latency, quality, cost.

# 39. MODEL INDEPENDENCE
Maintain provider abstraction through LiteLLM. Add automatic fallback, retries, circuit breaker.

# 40. MEMORY SYSTEM
Session memory, Project memory, User memory. Structured, retrievable, scoped.

# 41. RESEARCH PROJECTS
Users should create Projects with Research sessions, Sources, Knowledge, Notes, Claims, Artifacts.

# 42. RESEARCH TIMELINE
Every research session gets an immutable timeline.

# 43. REPRODUCIBLE RESEARCH
Clone session, Re-run research, Compare runs. Store model version, prompts, tools.

# 44. VERSIONED ANSWERS
Every major answer should have versions. Show what changed.

# 45. ARTIFACT GENERATION
Generate Markdown, PDF, DOCX, PPTX, CSV. Retain citations.

# 46. EXPORTABLE EVIDENCE PACK
Research Evidence Pack containing queries, sources, claims, evidence, EGI, etc.

# 47. COLLABORATION
Workspace, members, roles, comments, shared projects.

# 48. HUMAN-IN-THE-LOOP
Configurable checkpoints before expensive or dangerous tasks.

# 49. AUTOMATION ENGINE
Trigger -> Research workflow -> Agent execution -> Verification -> Action.

# 50. RESEARCH AUTOMATION EXAMPLES
Scheduled research, competitor monitoring, GitHub repository monitoring.

---

# 51. SECURITY ARCHITECTURE
Auth, RBAC, SSRF protection, URL allow/deny, encryption.

# 52. MULTI-TENANT SECURITY
Tenant boundaries at the database layer.

# 53. RATE LIMITING
Redis for distributed coordination. Apply to auth, research, search, LLM calls.

# 54. CACHE LAYER
Use Redis for cache, rate limiting, queues.

# 55. ASYNC JOB SYSTEM
API -> Job Queue -> Worker -> LangGraph -> Database -> Event Bus -> WebSocket/SSE.

# 56. API ARCHITECTURE
Versioned API, separate routes. OpenAPI documentation.

# 57. WEBSOCKET + SSE STRATEGY
WebSocket for interactive, SSE for streaming, REST for CRUD.

# 58. OBSERVABILITY
OpenTelemetry. Dashboards for system health, LLM health, cost, performance.

# 59. STRUCTURED LOGGING
Never log API keys, tokens, or private document content.

# 60. EVALUATION SYSTEM
Benchmark suites for research quality, agent performance, retrieval.

# 61. GOLDEN DATASET
Private benchmark containing real research questions.

# 62. RED-TEAMING
Prompt injection, poisoned documents, fake citations, SSRF, data exfiltration.

# 63. PROMPT INJECTION DEFENSE
Explicitly label untrusted external content.

# 64. COST CONTROL
Stop or ask approval when budget exceeds threshold.

# 65. PERFORMANCE TARGETS
API p95 < 500ms, WebSocket < 1s.

# 66. FRONTEND PERFORMANCE
Code splitting, virtualized lists, LOD, debounced search.

# 67. ACCESSIBILITY
WCAG 2.2 AA. Keyboard navigation, ARIA, reduced motion.

# 68. RESPONSIVE DESIGN
Desktop, tablet, mobile.

# 69. DESIGN SYSTEM
Formal tokens. Reusable components.

# 70. DESIGN PRINCIPLE
Scientific, premium, technical, calm. Avoid cliché interfaces.

# 71. COMMAND CENTER
Global command palette (Cmd+K).

# 72. RESEARCH COPILOT
Contextual assistant over the current research graph.

# 73. SOURCE READER
Document reading interface with outline, highlights, notes.

# 74. KNOWLEDGE SYNTHESIS
Compare sources -> Agreement, Differences, Contradictions, Consensus.

# 75. TEMPORAL RESEARCH
Time-aware conclusions (latest, historical, between dates).

# 76. CHANGE DETECTION
New sources -> Change detection -> Affected claims -> Updated EGI.

# 77. RESEARCH SUBSCRIPTIONS
Subscribe to topics for meaningful updates.

# 78. BROWSER EXTENSION
Save text as evidence, send to XplainAI.

# 79. SHAREABLE RESEARCH
Secure share links (xplain.ai/r/id).

# 80. TEAM RESEARCH
Assignments, reviewers, approvals, shared notes.

# 81. DEVELOPER API
Expose research endpoints.

# 82. MCP SUPPORT
XplainAI as MCP client and MCP server.

# 83. PLUGIN ARCHITECTURE
Extension interfaces for future-proofing.

# 84. TESTING STRATEGY
Unit, Integration, E2E, Security tests.

# 85. CI/CD
GitHub Actions pipeline enforcing quality.

# 86. DOCKER ARCHITECTURE
Multi-stage images for Frontend, Backend API, Worker, DB, Redis, etc.

# 87. STORAGE
S3-compatible storage for files, Postgres for metadata.

# 88. BACKGROUND WORKERS
Handle crawling, PDFs, embeddings, async jobs.

# 89. FAILURE RECOVERY
Retry, timeout, fallback, resume.

# 90. IDEMPOTENCY
Idempotency keys for actions.

# 91. DATA RETENTION
Export data, delete cascading.

# 92. PRIVACY
Explicit controls over training, retention, public visibility.

# 93. ADMIN CONSOLE
Dashboard for users, usage, health, abuse.

# 94. BILLING FOUNDATION
Track minutes, tokens, storage, agent executions.

# 95. PRODUCT DIFFERENTIATION
Evidence-first autonomous research with a persistent claim/evidence graph.

# 96. WHAT NOT TO BUILD
No avatars, crypto, generic themes, custom LLMs before PMF.

# 97. FINAL TARGET ARCHITECTURE
React/Vite -> FastAPI -> Research Session Manager -> LangGraph -> Sub-agents.

# 98. FINAL TECHNOLOGY STACK
React 19, Python 3.12, FastAPI, Postgres, pgvector, Redis, Docker.

# 99. IMPLEMENTATION ORDER
Phase 0 -> Phase 18.

# 100. DEFINITION OF DONE
Comprehensive checklist of stability, architecture, and feature requirements.

# 101. THE FINAL PRODUCT LOOP
Never allow generation to outrun evidence.

# FINAL EXECUTION DIRECTIVE — XPLAINAI
Perform a complete repository-wide audit against this plan. Identify anything missing. Produce a single updated execution plan. For every major change require: implementation -> tests -> integration verification -> regression check -> documentation. Verify the complete application end-to-end before completion.
