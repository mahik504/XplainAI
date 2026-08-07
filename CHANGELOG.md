# Changelog

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
