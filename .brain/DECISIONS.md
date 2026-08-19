# XplainAI ? Architectural Decisions

## ADR-0001: Record Architecture Decisions
- Status: Accepted
- Context: Standardize ADR format.

## ADR-0002: Observable Explainability vs Model Chain-of-Thought
- Status: Accepted
- Context: Exposing raw internal model reasoning tokens is unreliable, prone to hallucination, and poses security/privacy risks.
- Decision: Base all explainability on observable, verifiable artifacts (research queries, retrieved web sources, extracted snippets, parsed factual assertions, and contradiction analysis).

## ADR-0003: Hybrid 2D/3D Evidence Visualization
- Status: Accepted
- Context: Complex research graphs with 50+ claims and sources become cluttered in flat 2D trees.
- Decision: Provide a dual-mode visualization engine: 2D React Flow for rapid linear reading and 3D WebGL / R3F for multi-cluster spatial topology and citation constellation mapping, with full accessibility fallback.\n