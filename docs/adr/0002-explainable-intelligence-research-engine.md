# ADR-0002: Explainable Intelligence Research Engine Architecture

## Status
Accepted

## Context
XplainAI requires an explainability model that is truthful, verifiable, performant, and secure. Displaying raw internal model chain-of-thought is neither safe nor reliable. We need a formal research pipeline that produces observable evidence and claim graphs.

## Decision
1. We establish a multi-stage research engine: Planner -> Web/Doc Tool -> Normalizer -> Evidence Extractor -> Claim Graph Builder -> Synthesizer.
2. We formalize typed domain entities for ResearchRuns, Sources, Evidence, Claims, and Citations.
3. We implement a dual 2D/3D visualization interface where all graphical elements map directly to observable entities.
4. We enforce strict untrusted data isolation on all retrieved web content.

## Consequences
- **Positive**: Clean architecture, true factual grounding, reproducible runs, superior UX for research and auditing.
- **Negative**: Requires structured processing and serialization across backend services and frontend stores.\n