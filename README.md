# XplainAI — Autonomous Research Operating System & Epistemic Intelligence

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg?style=for-the-badge)](https://github.com/mahik504/XplainAI)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.0+-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-FF6F00.svg?style=for-the-badge)](https://langchain-ai.github.io/langgraph/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_+_pgvector-4169E1.svg?style=for-the-badge&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Redis](https://img.shields.io/badge/Redis-7.x-DC382D.svg?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)

---

## 1. What Problem Are We Solving?

Contemporary conversational LLMs (such as ChatGPT, Claude, and Gemini) suffer from four fundamental flaws when applied to scientific research, intelligence analysis, and critical engineering:

1. **Ungrounded Hallucinations**: Generative LLMs prioritize conversational fluency over epistemic truth, stating unverified facts with total confidence.
2. **Superficial Citations**: Generic link lists appended to the bottom of answers that do not mathematically ground the specific claims made in individual sentences.
3. **Hidden Dialectic Contradictions**: When primary sources conflict, black-box models arbitrarily average them out instead of flagging the epistemic dispute.
4. **Zero Auditability**: No verifiable provenance chain exists from raw web/PDF document chunks to proposition extraction to final synthesis.

---

## 2. How We Solve It & Our Approach

**XplainAI** is an **Evidence-First Autonomous Research Operating System**. It does not treat interaction as a simple conversational chat; instead, it executes a rigorous, multi-step epistemic pipeline:

$$\text{Research Query} \longrightarrow \text{Multi-Source Crawl} \longrightarrow \text{Evidence Chunking} \longrightarrow \text{Proposition Extraction} \longrightarrow \text{Contradiction Analysis} \longrightarrow \text{EGI 2.0 Calculation} \longrightarrow \text{3D Graph Visualizer}$$

Every synthesized sentence is decomposed into atomic claims, scored against raw text chunks with bounding box coordinates, evaluated for domain credibility, and visualized on an interactive canvas.

---

## 3. Product Visual Walkthrough

### 3.1 Hero Prompt Studio
Configure research targets, select reasoning models, and launch multi-source investigations with real-time ambient shader feedback.

![Hero Workspace Canvas](docs/images/01_hero_workspace_canvas.png)

### 3.2 Live Research Cockpit (4-View Canvas)
Monitor live LangGraph execution across **Overview** (Synthesis & Citations), **Evidence** (Raw Chunks with Bounding Boxes), **Graph** (3D WebGL Constellation & 2D ReactFlow DAG), and **Sources** (Domain Politeness & Provenance).

![Live Research Cockpit](docs/images/02_live_research_cockpit.png)

### 3.3 3D Evidence Constellation
Explore an interactive 3D WebGL knowledge galaxy rendering epistemic clustering and claim-evidence topology in real time.

![3D Evidence Constellation](docs/images/03_3d_evidence_constellation.png)

### 3.4 Model Selection & Omni Router Configuration
Granular control over LLM inference providers (OpenAI, Anthropic, Gemini, DeepSeek, local Ollama), sliding-window cost counters, and export formats.

![Settings and Model Configuration](docs/images/04_settings_and_models.png)

---

## 4. MVP Features & Unique Selling Propositions (USP)

| Category | Capability / USP |
|---|---|
| **Deterministic EGI 2.0** | Mathematical Grounding Index combining vector cosine similarity, lexical overlap, domain reputation weights, and contradiction penalties. |
| **4-View Workspace Canvas** | Instant switching between Overview, Evidence Passage Inspector, 3D/2D Graph Topology, and Source Provenance. |
| **Omni Router & Cost Circuit Breaker** | Server-side API key isolation with distributed Redis Lua sliding-window budget limits ($10/day, $2/hr, $0.50/IP) for zero-risk public testing. |
| **Model Context Protocol (MCP)** | Native stdio & SSE endpoints exposing `deep_research`, `search_evidence`, `extract_claims`, and `calculate_egi` tools to external agents (Cursor, Claude Code, Antigravity). |
| **Multi-Target Deep Web Crawler** | Polite, SSRF-protected asynchronous scraper targeting ArXiv preprints, Wikipedia API, YouTube transcripts, and live HTML. |

---

## 5. System Architecture & Topology

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    XplainAI V3 Monorepo                                 │
├──────────────────────────┬───────────────────────────────┬──────────────────────────────┤
│  Frontend (apps/web)     │  Backend API (apps/api)       │  Data & Infra (infrastructure)│
│  • React 19 + Vite 6     │  • FastAPI + LangGraph Agents │  • PostgreSQL 16 + pgvector   │
│  • 4-View Canvas UI      │  • Deterministic EGI 2.0      │  • Redis 7 Rate Limiter/Bus  │
│  • 3D WebGL / 2D Flow    │  • Omni Router + Breakers     │  • OpenTelemetry + Prometheus│
│  • Strict BYOK / Local   │  • Model Context Protocol     │  • Nginx + Docker / K8s      │
└──────────────────────────┴───────────────────────────────┴──────────────────────────────┘
```

For complete C4 models and deep specifications, see the [Architecture Guide](docs/architecture/ARCHITECTURE.md).

---

## 6. Quickstart & Local Development

### Prerequisites
* **Node.js**: >= 20.0.0
* **pnpm**: >= 9.0.0
* **Python**: >= 3.11
* **Docker & Docker Compose**: (Optional, for PostgreSQL + pgvector and Redis)

### 1. Clone & Configure
```bash
git clone https://github.com/mahik504/XplainAI.git
cd XplainAI

# Copy environment template
cp .env.example .env
```

### 2. Start Full Stack via Docker Compose
```bash
docker compose up -d
```
* **Frontend Web App**: `http://localhost:5173`
* **Backend API & Swagger Docs**: `http://localhost:8000/docs`
* **Health Readiness Probe**: `http://localhost:8000/health/ready`

### 3. Or Run Locally

```bash
# Start Backend
cd apps/api
python -m venv .venv
# On Windows: .venv\Scripts\activate | On Unix: source .venv/bin/activate
pip install -e .
uvicorn neural_navigator.main:app --reload --port 8000

# Start Frontend (in a new terminal)
cd apps/web
pnpm install
pnpm dev
```

---

## 7. Running the Automated Test Suite

```bash
# Backend unit & integration test suite (165 tests)
cd apps/api
pytest tests/unit

# Frontend UI component test suite (82 tests)
cd apps/web
pnpm test

# Production build validation
pnpm build
```

---

## 8. MVP API Reference

| Method | Path | Description |
|---|---|---|
| `WS` | `/ws/v1/chat` | Real-time LangGraph streaming, claim emission, and EGI updates |
| `POST` | `/api/v1/research/jobs` | Asynchronous research batch job creation |
| `GET` | `/api/v1/research/jobs/{id}` | Job status, claims, citations, and EGI payload |
| `POST` | `/api/v1/export/pdf` | Export synthesized research as a branded evidence pack PDF |
| `GET` | `/health/live` | Kubernetes liveness probe |
| `GET` | `/health/ready` | Kubernetes readiness probe (checks DB, Redis, LLM) |
| `MCP` | `stdio / SSE (:8000/mcp)` | Model Context Protocol server exposing research tools |

---

## 9. License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
