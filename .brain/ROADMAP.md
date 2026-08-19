# XplainAI ? Flagship Transformation Roadmap

## Milestone Schedule

### Phase 1: Audit & Foundation Hardening (Current)
- [x] Environment & Toolchain bootstrap (Node 24, Python 3.11/3.14, uv, pnpm, Docker).
- [x] Repository clone & remote synchronization (`mahik504/XplainAI.git`).
- [x] Obsidian vault discovery & `.brain/` knowledge synchronization.
- [x] Complete codebase audit & fix broken test runner (`ship-qa.analysis.test.ts`).
- [x] Produce architecture artifacts & target state specification.

### Phase 2: Provider-Neutral Model Gateway & Domain Model
- [ ] Implement capability-based Model Gateway (`Capability.FAST`, `Capability.BALANCED`, `Capability.RESEARCH`, `Capability.REASONING`).
- [ ] Formalize typed domain entities: `ResearchRun`, `ResearchStep`, `Source`, `Evidence`, `Claim`, `Citation`, `Contradiction`, `Assumption`.
- [ ] Implement robust SQLite / relational persistence for full graph topologies and runs.

### Phase 3: Explainable Research Engine & Tool Registry
- [ ] Implement structured multi-step Research Pipeline: Planner -> Search -> Normalizer -> Evidence Extractor -> Claim Graph Builder -> Synthesizer.
- [ ] Add explicit Tool Registry with schema validation, timeouts, retries, and strict untrusted content sanitization.
- [ ] Add contradiction detection and evidence scoring algorithms.

### Phase 4: Synchronized 2D/3D Evidence Graph
- [ ] Build high-performance 3D WebGL / Three.js / React Three Fiber spatial evidence topology alongside 2D React Flow view.
- [ ] Implement bidirectional cross-highlighting: Chat Claim <-> Graph Node <-> Source Snippet <-> Inspector Drawer.
- [ ] Add semantic edge types (`SUPPORTS`, `CONTRADICTS`, `DERIVED_FROM`, `WEAKENS`, `DEPENDS_ON`).

### Phase 5: Swiss/Editorial UI/UX Polish & Motion
- [ ] Elevate visual hierarchy with custom typography, calibrated lighting, and zero-slop layout.
- [ ] Add Emil Kowalski-inspired micro-interactions, smooth layout morphs, and spring transitions.
- [ ] Implement accessibility fallbacks, keyboard navigation (ESC to exit focus, / to query), and responsive layouts.

### Phase 6: E2E Testing, Security Baseline & Browser QA
- [ ] Playwright E2E test suite covering full user journey (Query -> Research -> Tool -> Graph -> Claim Focus -> Evidence Demand -> Replay).
- [ ] Security audit & Strix scan integration for zero-vulnerability guarantee.
- [ ] Performance audit: 60fps WebGL rendering, sub-50ms UI response times.\n