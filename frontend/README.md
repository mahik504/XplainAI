# Frontend

React 19 + Vite + TypeScript single-page application, styled with Tailwind CSS v4 and
shadcn/ui. Organised as feature slices rather than by file type.

## Directory responsibilities

```
frontend/
├── public/          Static assets served verbatim (favicon, robots.txt, manifest)
├── e2e/             Playwright specs and fixtures — runs against a real backend
└── src/
    ├── app/         Application shell: providers, router, layouts, global styles
    ├── pages/       Thin route components that compose feature modules
    ├── features/    Self-contained vertical slices (the bulk of the codebase)
    ├── components/  Cross-feature presentational components
    ├── hooks/       Generic reusable hooks with no domain knowledge
    ├── lib/         Framework-adjacent infrastructure: http, websocket, query, utils
    ├── stores/      Global client state that genuinely spans features
    ├── types/       Ambient declarations and app-wide type aliases
    ├── config/      Parsed, validated environment and feature flags
    ├── assets/      Bundled icons, images, fonts
    ├── i18n/        Locale catalogues and formatting setup
    └── test/        Vitest setup, MSW handlers, data factories
```

### `app/`

The composition root. `providers/` holds the nested context providers (query client,
router, theme, error boundary, WebSocket session). `router/` declares routes and lazy
boundaries. `layouts/` holds shell chrome such as sidebar and header frames.
`styles/globals.css` is where Tailwind v4 is configured — the `@theme` block there is
the design token source of truth, so there is no `tailwind.config.ts`.

### `features/`

Each feature owns `api/`, `components/`, `hooks/`, `stores/`, and `types/`, plus an
`index.ts` barrel that is its only public surface. Features may import from
`components/`, `hooks/`, and `lib/`, but never reach into another feature's internals;
ESLint enforces this. Shared logic that two features need is promoted upward rather
than imported sideways.

| Feature | Scope |
| --- | --- |
| `conversation/` | Message thread, composer, streaming token rendering, run controls |
| `graph-visualizer/` | Live LangGraph topology, node state, execution trace inspector |
| `agents/` | Agent catalogue, configuration, tool permissions |
| `auth/` | Sign-in, token refresh, session guard |

### `components/`

`ui/` is owned by the shadcn CLI — generated primitives, excluded from lint and
coverage, upgraded by re-running `pnpm ui:add`. Do not hand-edit; wrap instead.
`common/` holds composed application-level components, `charts/` the visualisation
wrappers.

### `lib/`

| Module | Responsibility |
| --- | --- |
| `api/` | Typed fetch wrapper, auth interceptor, error normalisation, generated client bindings |
| `ws/` | WebSocket transport: connection lifecycle, exponential-backoff reconnect, heartbeat, sequence-gap detection, typed message dispatch |
| `query/` | TanStack Query client, cache keys, default retry and staleness policy |
| `utils/` | The `cn` class merger and small pure helpers |
| `validation/` | Zod schemas re-exported from `@neural-navigator/contracts` plus form resolvers |

## State strategy

Server state lives in TanStack Query. Ephemeral UI state lives in `useState`.
Zustand is reserved for cross-cutting client state (active session, connection
status, layout preferences) — reach for it last, not first.

## Commands

```bash
pnpm dev          # Vite dev server on :5173
pnpm typecheck    # tsc, no emit
pnpm lint         # ESLint flat config, type-aware rules
pnpm test         # Vitest unit + component tests
pnpm test:e2e     # Playwright, boots its own dev server
pnpm ui:add card  # Pull a shadcn primitive into components/ui
```
