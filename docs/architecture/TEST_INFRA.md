# Test Infrastructure & Methodology Specification

**System**: XplainAI Autonomous Research Operating System (`neural-navigator` v2.2.0)  
**Document Version**: 1.0.0  
**Target Environment**: Python 3.11+ / FastAPI / SQLAlchemy 2.0 / pgvector / LangGraph  
**Authoritative Sources**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `docs/MASTER_PLAN.md`, `docs/EXECUTION_PLAN.md`

---

## 1. Testing Philosophy & Opaque-Box Architecture

XplainAI requires rigorous, requirement-driven, opaque-box testing. Tests treat the system under test (SUT) through public interfaces (REST APIs, WebSockets, StateGraph runtime, domain engines, parser registries, vector stores, and crawler orchestrators) without relying on internal private implementation details.

### Core Testing Pillars
1. **Determinism & Reproducibility**: All mock providers (`EchoProvider`, `InMemoryVectorStore`, mock robots/crawlers) yield deterministic outputs to guarantee zero test flakiness.
2. **Mathematical Precision**: Explicit verification of formulas (Reciprocal Rank Fusion, SimHash similarity, Cosine distance, Epistemic Grounding Index $EGI 2.0$, and rate limiter timing).
3. **No Facade Testing**: Every test exercises real business logic, parsers, algorithms, database models, and validation routines. No dummy assertions.
4. **Adversarial Resilience**: Boundary inputs, malformed frames, prompt injections, SSRF addresses, oversized payloads, and network degraded conditions are continuously probed.

---

## 2. Test Suite Taxonomy (4-Tier Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│               Tier 4: Real-World Application Workloads                 │
│  - Multi-Source Deep Research Task (Crawl -> Graph -> EGI -> Cite)    │
│  - Academic PDF Synthesis with Spatial Bounding Box Grounding          │
│  - Comparative Technology Dialectic Contradiction Synthesis            │
│  - Degraded Network & Upstream LLM Timeout Recovery                    │
│  - High-Concurrency Multi-Tenant Session Isolation                     │
├────────────────────────────────────────────────────────────────────────┤
│               Tier 3: Cross-Feature Pairwise Combinations              │
│  - Search + Crawl + Parse + Chunk + Embed + RAG + Claim + EGI + Cite   │
│  - Mode (Fast, Deep) × Query Complexity × Tool Execution Matrix        │
│  - Source Authority × Confidence × Contradictions × EGI Score Grid     │
│  - Format (HTML, PDF, MD) × RAG (Dense, Sparse, Hybrid) × Reranking   │
├────────────────────────────────────────────────────────────────────────┤
│               Tier 2: Boundary & Corner Cases                          │
│  - Empty / Whitespace Queries & 1-Character Minimal Inputs             │
│  - Extreme Length Documents & Massive Token Ingestion                  │
│  - Invalid / SSRF URLs & Non-existent Domains                          │
│  - Rate Limiting (HTTP 429), Robots.txt Disallow & Timeout Fallbacks   │
│  - Malformed WebSocket JSON & RFC 9457 Problem Details Validation     │
│  - Zero Evidence Grounding & Duplicate / Circular Citation Resolution  │
├────────────────────────────────────────────────────────────────────────┤
│               Tier 1: Feature Coverage (>=5 tests / feature)           │
│  - F1: LangGraph State Machine & Procedural Pipeline Elimination       │
│  - F2: PostgreSQL Relational Schema & Repository Persistence           │
│  - F3: pgvector, Hierarchical Chunking & Hybrid RAG (RRF + Reranker)   │
│  - F4: Deep Web Crawler, Robots.txt, Domain Rate Limiter & Dedup       │
│  - F5: Evidence Extraction, Dialectic Contradictions & EGI 2.0         │
│  - F6: Granular Event Streaming (WebSocket & SSE Protocols)           │
│  - F7: Tool Registry, Permissions (RBAC), Sanitizer & SSRF Filter      │
│  - F8: Research Workspace Backend Models (Topologies & LOD)            │
│  - F9: Multimodal Parsing (PDF Spatial Bounding Boxes & Registry)      │
│  - F10: Interactive Citation Engine & Inline Marker Resolution         │
│  - F11: Artifact Serialization (Markdown, JSON, Packs & Snapshots)     │
│  - F12: Visual Constellation Graph Topology & Layered 3D Stratification│
│  - F13: Automation Triggers & Task Decomposition Engine               │
│  - F14: Evaluation Metrics & Red-Teaming Injection Hardening           │
│  - F15: Redis Rate Limiting & Multi-Tenant Session Scoping             │
│  - F16: Developer REST API & Health Probes                             │
│  - F17: Full End-to-End System Integration                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Specification-Driven Testing Methodologies

### 3.1 Category-Partition Method
Parameters and environment conditions are partitioned into mutually exclusive equivalence classes:
- **Query Complexity**: `simple` (factual), `moderate` (explanatory), `complex` (comparative / scientific).
- **Run Mode**: `fast` (direct synthesis), `deep_research` (full crawl, dialectic critique, verification).
- **Document Format**: `HTML` (DOM tree), `PDF` (spatial text blocks with bbox `[x0, y0, x1, y1]`), `Markdown` (hierarchical heading tree).
- **Crawl Status**: `SUCCESS` (200 OK), `ROBOTS_DISALLOWED` (403), `RATE_LIMITED` (429), `SSRF_BLOCKED` (403), `TIMEOUT` (504), `DEDUPLICATED` (200 hash match).
- **Claim Status**: `SUPPORTED` (confidence >= 0.65), `WEAKLY_SUPPORTED` (0.45 <= conf < 0.65), `UNVERIFIED` (conf < 0.45, zero evidence).
- **Contradiction Severity**: `critical` (involves core claims), `moderate` (supporting claims / perspectives).

### 3.2 Boundary Value Analysis (BVA)
Exact boundary conditions tested:
- **Query Length**: $0$ chars (error), $1$ char (valid minimal), $50$ chars (nominal), $50,000$ chars (extreme load).
- **Token Limits**: $64$ tokens (minimum output), $2048$ tokens (standard), $8192$ tokens (maximum ceiling).
- **Temperature**: $0.0$ (deterministic), $0.7$ (balanced), $1.0$ (high entropy).
- **EGI Score**: $0.00$ (complete contradiction / zero grounding) to $1.00$ (perfect grounding).
- **Crawl Depth**: $0$ (single page), $1$ (direct links), $3$ (deep recursive).
- **SimHash Similarity**: $0.0$ (disjoint) to $1.0$ (exact duplicate).

### 3.3 Pairwise Combinatorics
Cross-feature interaction testing using orthogonal matrices:
$$\text{Matrix} = \text{Mode} \times \text{Query Domain} \times \text{Retrieval Mode} \times \text{Document Format}$$
Ensures that all 2-way and 3-way interactions between crawler, parsers, vector store, claim extractor, and citation engine are validated without exponential explosion.

### 3.4 Real-World Workload Modeling
Synthetic multi-step workflows mimicking actual user investigations:
- **Workflow A**: Academic literature ingestion, extraction of formulas and error rates, spatial bounding box verification, citation tagging, and EGI computation.
- **Workflow B**: Comparative market/technology analysis with opposing empirical sources (e.g. Speed vs Safety, PostgreSQL vs MongoDB), verifying automated polarity contradiction detection.
- **Workflow C**: Multi-tenant concurrent load testing ensuring zero cross-tenant session pollution.

---

## 4. Test Execution & Verification

### Running the Full Test Suite
```powershell
cd c:\projects\XplainAi\backend
.\.venv\Scripts\pytest.exe -v
```

### Running the Requirement-Driven E2E Suite Only
```powershell
cd c:\projects\XplainAi\backend
.\.venv\Scripts\pytest.exe tests/e2e/test_e2e_requirements.py -v
```

### Expected Output & Pass Criteria
- **Total Test Count**: > 250 test cases across all modules.
- **Pass Rate**: 100% passing, 0 failures, 0 errors.
- **Timing**: Clean execution within standard test timeouts (< 300s).
