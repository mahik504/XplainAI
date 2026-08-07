# 1. Record architecture decisions

- Status: Accepted
- Date: 2026-01-01

## Context

Neural Navigator spans two languages, a shared contract layer, and a stateful agent
runtime. Decisions made early — transport choice, checkpoint storage, module
boundaries — are expensive to reverse and are otherwise only recoverable from commit
archaeology or the memory of whoever was in the room.

## Decision

We record every consequential architectural decision as an Architecture Decision
Record in `docs/adr/`, numbered sequentially and never rewritten once accepted.

A decision is "consequential" if reversing it would touch more than one package,
change a published contract, or alter operational behaviour under load.

## Consequences

- Reviewers can challenge the reasoning, not just the code.
- New contributors have a chronological narrative of how the system reached its shape.
- Superseding a decision requires a new ADR, which keeps the history honest.
