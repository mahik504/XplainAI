# XplainAI — Product Requirements Document (PRD)

> **Document Version**: 2.2.0  
> **Author**: MAHI (<gehlot.mahisingh2006.102@gmail.com>)  
> **Project Name**: XplainAI (Autonomous Epistemic & Explainable Intelligence Workspace)  
> **Status**: Production-Ready / Academic Defense Grade  

---

## 1. Executive Summary & Problem Statement

### 1.1 The Epistemic Crisis in Generative AI
Large Language Models (LLMs) have achieved superhuman synthesis speeds, but their deployment in high-stakes domains (scientific research, healthcare, engineering, legal compliance, and defense) is severely bottlenecked by the **"Black Box Hallucination Dilemma"**:
1. **Unverifiable Assertions**: Models present synthesized facts with uniform linguistic confidence regardless of empirical grounding.
2. **Post-Hoc Rationalization**: Traditional Explainable AI (XAI) relies on attention heatmaps or saliency maps that explain *where tokens look*, not *why logical assertions hold true*.
3. **Information Overload**: Researchers lack real-time visual decomposition of complex multi-premise arguments into structured claim graphs.

### 1.2 The XplainAI Solution
**XplainAI** is an autonomous, open-architecture Explainable AI workspace that decomposes generative AI outputs into **atomic verifiable claims**, scores their **epistemic grounding** against live empirical sources (ArXiv, Wikipedia, Web APIs), and visualizes the underlying logic as an interactive **3D Celestial Knowledge Galaxy** and **2D Directed Acyclic Flow DAG**.

---

## 2. Core Value Proposition & Competitive Differentiation

| Capability | Standard LLM Chatbots (ChatGPT / Claude) | Standard Search AI (Perplexity) | **XplainAI Workspace** |
| :--- | :--- | :--- | :--- |
| **Output Format** | Linear Markdown text | Text with inline URL citations | **Dialectic Claim Breakdown + AST Decomposition** |
| **Explainability** | None (Opaque) | URL Links only | **Mathematical Epistemic Grounding Index ($EGI$)** |
| **Visual Topology** | None | Static Source Cards | **Dual-Engine Interactive 3D Orbit Galaxy & 2D DAG** |
| **Multi-Agent Research** | Opaque background chain | Linear Web Scraper | **LangGraph-driven Intent → Crawler → Verification Pipeline** |
| **Privacy & BYOK** | Cloud lock-in | Cloud lock-in | **Client-Side Zero-Retention Ephemeral Mode & Local vLLM/Ollama Support** |

---

## 3. User Personas & Target Market

1. **Academic Researchers & Scientists**:
   - *Need*: Rapid literature cross-referencing, claim validation, detecting contradictions in preprint literature.
2. **AI & Machine Learning Engineers**:
   - *Need*: Verifying model output reasoning paths, testing local models via BYOK OpenAI-compatible endpoints.
3. **Legal, Compliance & Financial Analysts**:
   - *Need*: Transparent audit trails proving where each factual claim originated.

---

## 4. Operational Modes: Defensible Structural Differences

To provide clear operational clarity for academic defense, XplainAI implements two distinct pipeline engines:

### 4.1 Fast Mode (`fast`)
- **Target Use Case**: Rapid conversational QA, mathematical calculation, code formatting.
- **Execution Architecture**: Direct single-pass LLM invocation bypasses multi-agent crawler latency.
- **Explainability**: Client-side AST heuristic claim extraction and token stream analysis (<200ms latency).

### 4.2 Deep Research / Complex Mode (`deep_research`)
- **Target Use Case**: High-stakes scientific literature analysis, multi-source contradiction detection.
- **Execution Architecture**:
  1. **Intent Decomposition**: Breaks user query into 3–5 orthogonal sub-inquiries.
  2. **Concurrent Multi-Source Crawlers**: Dispatches parallel scrapers to ArXiv preprints, Wikipedia Knowledge Graph, and Web endpoints.
  3. **Epistemic Scoring Engine**: Computes authority weights and cross-validates claims.
  4. **Dialectic Synthesis**: Emits supporting evidence alongside counter-perspectives and missing context.
  5. **3D/2D Graph Generation**: Renders full interactive topological DAG.

---

## 5. Technical Specifications & Functional Requirements

### 5.1 Frontend Requirements
- **Framework**: React 19 + TypeScript + Vite.
- **Visual Engine**: Three.js WebGL for high-performance 3D Spatial Knowledge Galaxy; WebGL Aurora Shaders.
- **State Architecture**: Zustand reactive stores with sub-millisecond selector isolation.
- **Design Language**: Obsidian Void (`#030712`), Electric Cyan (`#00F0FF`), Sapphire Blue (`#1EA5FA`), and Aetheric Indigo (`#6366F1`).

### 5.2 Backend Requirements
- **Framework**: FastAPI (Python 3.12+) asynchronous ASGI engine.
- **Transport**: Full-duplex WebSocket with sequence-numbered server frames for zero-loss stream recovery.
- **Pipeline Orchestration**: LangGraph-compatible state machine with deterministic stage transitions (`QUERY_ANALYZED` → `RESEARCH_STARTED` → `TOOL_COMPLETED` → `SYNTHESIS` → `POST_ANALYSIS`).

---

## 6. Product Roadmap & Future Scope (Post-Funding / Scaling)

- **Phase 1 (Current)**: Multi-agent Web/ArXiv crawlers, AST Claim extraction, 3D Galaxy & 2D DAG, BYOK local endpoints.
- **Phase 2 (Q3 2026)**: Fine-grained Attention Weights overlay via HuggingFace Inference Endpoints for open-weight models (Llama-3, DeepSeek-R1).
- **Phase 3 (Q4 2026)**: Collaborative research rooms with synchronized multi-user 3D graph exploration.
- **Phase 4 (2027)**: Enterprise On-Premises Air-Gapped deployment with custom PDF/ArXiv vector datastore embeddings.
