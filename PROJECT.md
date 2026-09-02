# Project: XplainAI V3 Final Release, Restructure, and Deployment

## Architecture
XplainAI V3 is a production-grade autonomous research operating system featuring a multi-agent LangGraph backend, PostgreSQL/pgvector relational store, deterministic Evidence-Grounding Indicator (EGI 2.0) engine, Omni Router backend integration with hard cost circuit breakers, and a specialized React 19/Vite Research Workspace Canvas frontend.

```
[ Web App: apps/web ] (React 19, Vite, Tailwind 4, Radix, Three.js, React Flow)
  ├── 4-View Canvas: Overview, Evidence, Graph, Sources
  ├── Interactive EGI 2.0 Gauge & Citation Popovers
  └── 3D WebGL Constellation & 2D ReactFlow DAG
          │
          │ WebSocket (/ws/v1/chat) + REST APIs (/api/v1/*) + MCP (/mcp/*)
          ▼
[ API Service: apps/api ] (FastAPI, Python 3.12, LangGraph, SQLAlchemy, pgvector, Redis)
  ├── Middleware: Rate Limiting, API Key Auth, Cost Circuit Breakers
  ├── LLM Service: Omni Router (backend-only key), OpenAI, Anthropic, Gemini, DeepSeek
  ├── Evidence Engine: EGI 2.0 deterministic calculator, claim extractor, citation linker
  ├── Multimodal Engine: PDF bounding-box parser, chunker, vector embedding
  ├── Exporters: Markdown, PDF, structured JSON Evidence Pack
  ├── Developer API: Research jobs, evidence search, citation verification
  └── MCP Server: Model Context Protocol (Tools, Resources, Prompts) over stdio & SSE
          │
          ▼
[ Shared Packages: packages/ ]
  ├── contracts/ (OpenAPI 3.1, AsyncAPI 3.0)
  ├── contracts-ts/ (@neural-navigator/contracts)
  ├── contracts-py/ (nn-contracts)
  └── codegen/ (Code generation tooling)
          │
          ▼
[ Infrastructure: infrastructure/ ]
  ├── docker/ (Dockerfiles, production compose)
  ├── k8s/ (Kubernetes manifests & overlays)
  ├── nginx/ (Reverse proxy & load balancing)
  ├── observability/ (OTel collector, Prometheus, Grafana)
  ├── postgres/ (PostgreSQL 16 + pgvector init DDL)
  └── terraform/ (Cloud deployment definitions)
```

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Pre-Restructure Safeguard | Backup snapshot branch and git tag before moving codebase files | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Reference & Dependency Audit | Verify zero broken cross-package imports/scripts before file deletion | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Monorepo Restructure | Reorganize to standard `apps/web`, `apps/api`, `packages/`, `infrastructure/` | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Untracked Stress Test Preservation | Retain and commit empirical adversarial & concurrency stress test suites | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Secure Omni Router Backend | Backend-only `OMNI_ROUTER_API_KEY` configuration, zero key leakage to web | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Unauthenticated Public Demo Mode | Fix default UI state so public users run demo research jobs seamlessly | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Hard Cost Circuit Breakers | Redis + in-memory sliding window budget limits ($10/day, $2/hr, $0.50/IP) | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Pre-Flight Budget Checks & WS Frames | ProblemDetail HTTP 429 & WebSocket `budget_exceeded` frames | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Engineering-Grade README.md | Comprehensive technical documentation with C4 & workflow diagrams | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Clean V3 .env.example | Production configuration template covering all services and models | M3 | ORIGINAL_REQUEST §R3 |
| 11 | MIT License Verification | Standard open-source MIT License verified at root | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Deep Secret Scanning & Git Hygiene | Zero API keys or credentials across repository files and git history | M3 | ORIGINAL_REQUEST §R3 |
| 13 | Staging Build & Test Verification | Validate staging docker-compose and container runtime health | M4 | ORIGINAL_REQUEST §R4 |
| 14 | Canvas UI / EGI / Graph E2E Pass | 100% test pass rate across all tiers (unit, integration, stress, UI) | M4 | ORIGINAL_REQUEST §R4 |
| 15 | Zero-Downtime Rollback SOP | Documented and verified production rollback mechanism | M4 | ORIGINAL_REQUEST §R4 |
| 16 | v3.0.0 Release Tagging | Final release commit and annotated git tag `v3.0.0` | M4 | ORIGINAL_REQUEST §R4 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Monorepo Restructure & Baseline Verification | Pre-restructure backup, monorepo restructure (`apps/api`, `apps/web`, `packages/`, `infrastructure/`), import & dependency preservation | none | DONE |
| M2 | Secure Omni Router & Cost Circuit Breaker | Backend-only Omni Router API key, public demo mode UI fix, Redis/in-memory cost circuit breakers ($10/day, $2/hr, $0.50/IP), pre-flight budget checks & WS frames | M1 | IN_PROGRESS |
| M3 | Open-Source Polish & Safe Git Hygiene | Engineering README.md with diagrams, comprehensive .env.example, MIT license, automated secret scan across history | M1 | PLANNED |
| M4 | Staging/Prod Deployment & v3.0.0 Release | Staging container validation, full E2E test suite execution (100% green), rollback SOP, v3.0.0 release tag | M1, M2, M3 | PLANNED |

---

## Code Layout

```
c:\projects\XplainAi\
├── apps/
│   ├── web/                     # Frontend (React 19 + Vite + Tailwind 4)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── features/ (workspace, graph-visualizer, vision, conversation)
│   │   │   └── stores/ (session-store.ts, conversation-store.ts, ui-store.ts)
│   │   ├── package.json, vite.config.ts, tsconfig.json
│   │   └── Dockerfile
│   └── api/                     # Backend (FastAPI + LangGraph + pgvector + Redis)
│       ├── src/
│       │   ├── mcp_server.py
│       │   └── neural_navigator/
│       │       ├── api/ (middleware, routes, websocket)
│       │       ├── agents/ (graphs, nodes, edges, state)
│       │       ├── orchestration/ (egi.py, citations.py, exporters.py)
│       │       ├── services/ (llm.py, crawler.py, circuit_breaker.py)
│       │       ├── infrastructure/ (cache, parsers, db)
│       │       └── core/ (config.py, logging.py)
│       ├── tests/ (unit, stress, e2e)
│       ├── pyproject.toml, alembic.ini, Dockerfile
│       └── Dockerfile
├── packages/
│   ├── contracts/               # OpenAPI & AsyncAPI schemas
│   ├── contracts-ts/            # @neural-navigator/contracts TS package
│   ├── contracts-py/            # nn-contracts Python package
│   └── codegen/                 # Type & schema generator
└── infrastructure/
    ├── docker/ (docker-compose.prod.yml)
    ├── k8s/ (base, overlays)
    ├── nginx/ (default.conf)
    ├── observability/ (grafana, otel, prometheus)
    ├── postgres/ (01_init_pgvector.sql)
    └── terraform/
```
