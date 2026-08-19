# XplainAI ? Architecture Bridge

## Monorepo Layout
```
XplainAI/
??? .brain/                     # Curated bridge to Obsidian vault & project intelligence
??? backend/                    # FastAPI service (Python 3.12/3.14 + asyncpg/sqlite + httpx)
?   ??? src/neural_navigator/   # Core backend package
?   ?   ??? api/                # HTTP & WebSocket endpoints (/api/v1, /ws/v1)
?   ?   ??? core/               # Configuration, logging, security, telemetry
?   ?   ??? domain/             # Typed domain models & semantic events
?   ?   ??? llm/                # Provider-neutral model gateway & adapters
?   ?   ??? orchestration/      # Research planner, tools, pipeline, post-analysis
?   ?   ??? services/           # Conversation store, event bus, cache
?   ?   ??? utils/              # Constants & helpers
?   ??? tests/                  # Unit, integration, & e2e test suites
??? frontend/                   # React 19 + TypeScript + Vite + Tailwind CSS + R3F + React Flow
?   ??? src/
?   ?   ??? app/                # Shell, router, layout, styles
?   ?   ??? components/         # Common UI, brand, node inspector
?   ?   ??? features/           # Modular feature domains
?   ?   ?   ??? conversation/   # Chat, composer, streaming message renderer
?   ?   ?   ??? demo/           # Showcase / story mode walkthrough
?   ?   ?   ??? explainability/ # Counter-perspectives, missing context, source drawer
?   ?   ?   ??? graph-visualizer/ # 2D Flow + 3D WebGL Evidence Graph
?   ?   ?   ??? history/        # SQLite session manager
?   ?   ?   ??? trust/          # Observable structural signals
?   ?   ??? lib/                # Graph layout, claim focus, analyzers, client state
??? shared/                     # Cross-stack contracts (OpenAPI & AsyncAPI specs + codegen)
??? docs/                       # Architectural specifications, ADRs, UX specs, research logs
```

## Core Architectural Invariants
1. **No Vendor Leaks in Domain Logic**: Model calls use capability abstractions (`fast`, `balanced`, `research`, `reasoning`).
2. **Untrusted Data Isolation**: Web search results and scraped snippets are treated as untrusted data inputs, never executed as prompt instructions.
3. **Structured Realtime Protocol**: Realtime events follow strict typed schemas (`research.*`, `tool.*`, `source.*`, `claim.*`, `synthesis.*`).
4. **Observable Proofs Over Hidden Reasoning**: No raw internal reasoning tokens are displayed or faked.\n