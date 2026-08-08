# Changelog

## 2.1.0 — Deep capability upgrade

### Added
- Markdown display separated from analysis text (code fences never become fake claims)
- Structured retrieved sources vs response evidence markers
- Missing Context (“What’s missing”) and Alternative Perspective cards
- Stage timing (`duration_ms`) on orchestration stages
- Mode live status strip during research
- History relative time, mode indicator, rename

### Changed
- Stale `run_id` events ignored; new prompt cancels prior manual run
- Deep Research uses more research tasks / searches than Balanced/Fast
- Response Structure graph uses Question → Response hierarchy
- Claim Focus distinguishes retrieved sources vs evidence markers

### Deferred
- RAG / document upload, export JSON/PNG, thumbs feedback (P2)

## 2.0.0 — Prototype fusion

### Added
- Mode-aware orchestration (`fast` / `balanced` / `deep_research`) with observable stage events over WebSocket
- Tool abstraction (calculator, DuckDuckGo search; optional news/weather via env keys)
- SQLite conversation history API + ChatGPT-like history sidebar
- Composer mode selector, copy/retry actions, stage-driven execution graph
- Markdown-aware response segmentation for structure analysis

### Changed
- Desktop layout: History · Conversation (hero) · Explainability companion
- Trust panel labeled as Structural Signal (latency excluded)

## 1.0.0 — Initial release

### Added
- XplainAI branding and Explainability OS workspace
- OpenAI streaming via `LLM_PROVIDER=openai` + `OPENAI_API_KEY`
- Response structure analysis, structure graph, claim focus, evidence demand
- Demo Mode, Story Mode, Judge Mode, Replay
- Persistent annotation legend in chat when structure is available

### Changed
- Chat is the primary hero surface; graph is the companion
- Trust wording → honest “Signals” / “Response assessment” / “Structure”
- `LLM_PROVIDER=openai` fails immediately if `OPENAI_API_KEY` is missing (no Echo fallback)
- Default model `gpt-4.1-mini`

### Fixed
- Demo landing overlay blocking the composer (Skip to workspace)
- Story / Judge Mode stalling on thin or varied OpenAI outputs
