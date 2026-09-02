# CURRENT STATE AUDIT

**Date:** 2026-09-01
**Target:** XplainAI Codebase Baseline Freeze (Phase 0)

## Overview
The application correctly initializes a React/Vite frontend with a FastAPI/Uvicorn backend. Core WebSocket streaming is operational following the Phase 1 fixes (resolving FastAPI DI issues for WebSockets). The visual constellation (Three.js) and 2D DAG (React Flow) are present and functional. However, the system relies heavily on a monolithic procedural `pipeline.py` instead of the targeted LangGraph architecture, uses SQLite with unstructured JSON blobs, and lacks a vector store for RAG.

## Baseline Matrix

| Feature | Implementation Status | Tests | Known Bugs | Production Readiness | Priority |
|---|---|---|---|---|---|
| **Frontend Framework (React 19, Vite, TS)** | Fully Implemented | 68/68 Pass | None | Yes | P0 |
| **Styling & State (Tailwind, Zustand)** | Fully Implemented | Passing | None | Yes | P0 |
| **3D Constellation (R3F)** | Implemented | N/A | High polygon rendering drops FPS | No (Needs LOD) | P2 |
| **2D DAG (React Flow)** | Implemented | Passing | Missing semantic expand/collapse | Yes | P2 |
| **Backend Framework (FastAPI, Pydantic)** | Implemented | 131/131 Pass | None | Yes | P0 |
| **LLM Gateway (LiteLLM)** | Implemented | Passing | None | Yes | P1 |
| **WebSocket Streaming** | Implemented (Fixed DI) | Passing | Connection dropped heavily prior to limit fix | Yes | P0 |
| **Agent Orchestration** | Duplicated (Pipeline vs LangGraph) | Passing | LangGraph disconnected from streaming | No | P0 |
| **Persistence (SQLite)** | Implemented | Passing | Synchronous blocking; JSON blobs | No (Target: Postgres) | P0 |
| **Vector Store & RAG** | Missing | N/A | Completely absent; raw prompt stuffing | No | P0 |
| **Evidence & Claim Extraction** | Partial | Passing | Non-relational, regex-based | No | P1 |
| **Multimodal Support** | Partial | Failing | Image payloads dropped | No | P2 |
| **Secret Management** | Implemented | Passing | Prior API key exposure resolved | Yes | P0 |
| **Source Provenance / EGI** | Partial | Passing | Extracted but not fully relational | No | P1 |
| **Web Crawler / Ingestion** | Missing | N/A | No dedicated scraping infrastructure | No | P0 |

## Structural Blockers
1. **Procedural Orchestration:** `pipeline.py` intercepts core LLM execution, bypassing the LangGraph state machine (`research_graph.py`).
2. **Database Monolith:** `conversations.db` stores unstructured JSON without referential integrity for Claims, Evidence, or Citations.
3. **Data Ingestion:** No chunking, metadata extraction, or embedding pipeline exists.

## Next Steps
Proceed directly to **EXECUTION_PLAN.md** Phase 2 (Unifying Agent Architecture) and Phase 3 (PostgreSQL Migration). Phase 1 (Stability & Security) is complete.
