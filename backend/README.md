# Backend

FastAPI application with a LangGraph agent runtime and a WebSocket streaming surface.
Layered so that the dependency arrow always points inward: `api → services → domain`,
with `infrastructure` plugged in at the edges through the interfaces in `domain/ports`.

## Layout

```
backend/
├── src/neural_navigator/
│   ├── main.py           ASGI app factory, lifespan, router mounting
│   ├── api/              Transport layer — HTTP and WebSocket
│   ├── core/             Cross-cutting concerns with no business meaning
│   ├── domain/           Pure business model. Imports nothing outward.
│   ├── services/         Application use cases; orchestrates domain + ports
│   ├── agents/           LangGraph runtime
│   ├── llm/              Model provider abstraction
│   ├── infrastructure/   Concrete adapters: database, cache, vectors, queue, HTTP clients
│   ├── realtime/         Connection registry and pub/sub fan-out for WebSockets
│   ├── workers/          Background job definitions
│   ├── schemas/          Request/response DTOs re-exported from nn-contracts
│   └── utils/            Small, dependency-free helpers
├── migrations/           Alembic environment and revision history
├── tests/                unit | integration | e2e, mirroring the src tree
└── scripts/              Operational one-offs: seeding, backfills, key rotation
```

## Layer responsibilities

### `api/`

Owns serialisation, status codes, and nothing else. Route handlers stay thin: validate,
delegate to a service, map the result.

- `v1/routes/` — one module per resource (`sessions.py`, `runs.py`, `knowledge.py`, `health.py`).
- `v1/dependencies/` — FastAPI `Depends` providers for the current user, DB session, and service instances.
- `ws/handlers/` — WebSocket endpoints, one per channel.
- `ws/protocol/` — frame envelope, discriminated-union message parsing, close codes, sequence numbering.
- `middleware/` — request ID, structured access logging, rate limiting, CORS, timing.
- `errors/` — domain exception to HTTP problem-detail mapping, registered once at startup.

### `core/`

`config/` holds pydantic-settings classes that parse and validate the environment at
import time so misconfiguration fails at boot, not at first request. `logging/`
configures structlog with request-scoped context. `security/` handles password hashing,
JWT encode/decode, and scope checks. `telemetry/` wires OpenTelemetry tracing and
metrics. `exceptions/` defines the application exception hierarchy.

### `domain/`

The part of the system that would still make sense on paper. `models/` holds entities
and aggregates, `events/` the domain events they emit, and `ports/` the `Protocol`
definitions (`ConversationRepository`, `VectorIndex`, `EventPublisher`) that
`infrastructure/` implements. This package imports no framework and no driver.

### `services/`

One module per use case family. Services own transactions, coordinate repositories,
invoke the agent runtime, and publish events. This is where business rules that span
more than one entity live.

### `agents/`

The LangGraph runtime, kept separate from `services/` because its concerns — graph
topology, step budgets, checkpointing — are orthogonal to application use cases.

| Directory | Contents |
| --- | --- |
| `graphs/` | Graph assembly: node registration, edge wiring, compilation |
| `nodes/` | Individual node callables, one concern each |
| `edges/` | Conditional routing predicates |
| `state/` | `TypedDict` state schemas and reducer functions |
| `tools/` | Tool definitions and argument schemas exposed to the model |
| `prompts/` | Versioned prompt templates, kept out of code for reviewability |
| `memory/` | Short-term buffers and long-term retrieval strategies |
| `checkpointers/` | Persistence adapters for graph state and resumable runs |

### `realtime/`

Separate from `api/ws/` on purpose: `api/ws/` is the transport endpoint, `realtime/` is
the machinery behind it. `connection/` tracks live sockets and their auth context,
`channels/` maps sessions to subscriber sets, and `broker/` fans messages out over Redis
pub/sub so any worker can reach a socket held by any other worker. Without the broker,
horizontal scaling silently breaks streaming.

### `infrastructure/`

Every adapter that touches the outside world. `db/models/` holds SQLAlchemy ORM models —
deliberately distinct from `domain/models/` so a schema change does not ripple into
business logic. `db/repositories/` implements the domain ports.

## Testing

`tests/` mirrors the `src/` tree. Unit tests never touch I/O; integration tests spin up
Postgres and Redis via testcontainers; e2e tests drive the running app over HTTP and
WebSocket. Markers let you select a tier: `uv run pytest -m unit`.

## Commands

```bash
uv sync --all-extras
uv run uvicorn neural_navigator.main:app --reload
uv run alembic revision --autogenerate -m "add sessions table"
uv run alembic upgrade head
uv run pytest -m unit
uv run ruff check . && uv run mypy src
```
