# Documentation

Written documentation that outlives any single pull request.

| Directory | Contents |
| --- | --- |
| `architecture/` | System context, container and component diagrams, data flow, threat model. |
| `adr/` | Architecture Decision Records — one immutable file per decision. |
| `api/` | Human-readable narrative for the HTTP and WebSocket surface, generated reference output. |
| `runbooks/` | On-call procedures: incident response, rollback, backfill, key rotation. |
| `guides/` | Contributor onboarding, local setup troubleshooting, coding standards. |

## ADR conventions

Files are named `NNNN-kebab-case-title.md` with a monotonically increasing number.
Each record states Context, Decision, Consequences, and a Status of
`Proposed`, `Accepted`, `Deprecated`, or `Superseded by NNNN`.

Never edit an accepted ADR to change its decision. Write a new one that supersedes it.
