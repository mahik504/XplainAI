# XplainAI ? Current State Architecture Audit

## 1. Overview
XplainAI (v2.2.0 baseline) is a full-stack web application designed to demonstrate explainability for streaming LLM responses. It captures user questions, routes them through a lightweight backend pipeline with optional tool steps, streams text chunks back to a React frontend, and analyzes the finished response text on the client to construct a 2D graph of claims, evidence markers, hedges, and connectors.

## 2. Component Architecture
```
??????????????????????????????????????????????????????????
?               Frontend (React 19 + Vite)               ?
?  - AppShell, TopNav, SettingsDrawer                    ?
?  - ChatPanel + AnimatedAnnotatedMessage                ?
?  - GraphPanel (@xyflow/react / React Flow 2D)          ?
?  - ExplainabilityPanel (MissingContext, Sources, etc.) ?
?  - Zustand Store (session-store.ts)                    ?
??????????????????????????????????????????????????????????
                            ? REST (/api/v1) & WS (/ws/v1)
??????????????????????????????????????????????????????????
?                  Backend (FastAPI)                     ?
?  - Routers: chat.py, conversations.py, websocket.py    ?
?  - Orchestration: pipeline.py, stages.py, tools.py     ?
?  - LLM Service: llm.py (OpenAI / Echo Provider)        ?
?  - Persistence: SQLite (ConversationStore)             ?
??????????????????????????????????????????????????????????
```

## 3. Data & State Flow
1. **User Turn**: User enters query in Composer with selected mode (`fast` | `balanced` | `deep_research`).
2. **WebSocket Session**: Initiates `/ws/v1/chat` connection.
3. **Backend Stage Execution**:
   - `analyze_query()` evaluates intent, complexity, ambiguity, and domain.
   - Emits `QUERY_ANALYZED`, `MODE_SELECTED`, `CONTEXT_CHECK` events over WebSocket.
   - For `balanced` and `deep_research`, runs heuristics to trigger calculator, weather, or DuckDuckGo web search.
   - Emits `TOOL_STARTED` and `TOOL_COMPLETED` events.
   - Augments system prompt with tool output text snippets.
   - Calls `llm.stream_chat()`.
   - Streams text delta tokens.
   - Emits `GENERATION_COMPLETED`.
   - Runs post-analysis (`detect_missing_context`, `build_counter_perspective`).
   - Emits `STRUCTURE_READY` and `COMPLETED`.
4. **Client-Side Graph Construction**:
   - On completion, `analyzeResponse()` in `response-analyzer.ts` runs regex heuristics across sentences to classify assertions, evidence cues, hedges, and connectors.
   - `buildResponseStructureGraph()` maps sentences into React Flow node objects.
   - User interactions (hovering over sentence, clicking claim) toggle `claimFocusActive` and highlight matching nodes in the 2D canvas.

## 4. Strengths & Good Elements
- Clean Separation: Frontend and backend have distinct boundaries with shared contracts in `shared/`.
- Safe Explainability Rule: Strict avoidance of pseudo-reasoning or internal chain-of-thought hallucination.
- Reliable Streaming: WebSocket and SSE implementations handle token deltas and cancellations cleanly.
- History Persistence: Local SQLite database stores conversation history cleanly.

## 5. Weaknesses & Technical Debt
1. **Client-Centric Explainability**: The majority of claim extraction and evidence classification relies on regex heuristics in JavaScript rather than a verified semantic extraction pipeline on the backend.
2. **2D-Only Visualization**: The graph is confined to a 2D node layout in React Flow. Complex research trees lack spatial depth, dynamic cluster layout, or 3D citation constellations.
3. **Basic Tooling & Scraping**: Web search relies on simple DuckDuckGo HTML scraping without semantic chunking, embedding similarity, or source domain authority scoring.
4. **Coupled Model Adapter**: LLM service is tailored to OpenAI chat completion format rather than a unified capability gateway supporting multiple model families.
5. **No Graph-Level Persistence**: Only messages are persisted in SQLite; full structured research runs and evidence graphs are lost on page refresh unless re-analyzed client-side.\n