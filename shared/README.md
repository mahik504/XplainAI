# Shared

The single source of truth for everything that crosses the frontend/backend boundary.
Nothing here imports from `frontend/` or `backend/`; the dependency arrow only ever
points inward.

```
shared/
├── contracts/    Hand-authored specifications (the source of truth)
├── packages/     Generated, publishable client packages per language
├── codegen/      Generator configuration
└── scripts/      Contract validation and diffing helpers
```

## contracts/

| Directory | Purpose |
| --- | --- |
| `openapi/` | OpenAPI 3.1 description of the REST surface. `openapi.yaml` is the entry document; reusable schemas, parameters and responses live in `components/` and are `$ref`-ed in. |
| `asyncapi/` | AsyncAPI 3.0 description of the WebSocket protocol: channels, message payloads, and the client/server operation directions. |
| `json-schema/` | Standalone schemas shared by both specs and used for runtime validation. |
| `events/` | Internal domain event payloads published on the message bus. Versioned separately from the public API. |

## packages/

| Package | Consumed by |
| --- | --- |
| `contracts-ts/` (`@neural-navigator/contracts`) | The frontend, via a pnpm workspace dependency. Emits TypeScript types plus Zod validators. |
| `contracts-py/` (`nn-contracts`) | The backend, via a local path dependency. Emits Pydantic v2 models. |

Each package splits `src/generated/` (machine-written, never edited by hand) from
`src/manual/` (hand-written helpers, discriminated-union narrowing, type guards).
`src/generated/` is committed so consumers do not need a generator to build.

## Changing a contract

1. Edit the spec under `contracts/`.
2. Run `make contracts-lint` and then `make contracts-gen`.
3. Commit the spec change and the regenerated output in the same commit.

CI regenerates and fails on any diff, so drift cannot reach `main`.

## Versioning

Breaking changes require a new path prefix (`/api/v2`) or a new WebSocket message
`type`, plus a deprecation window on the old surface. Additive, optional fields are
not breaking and ship without ceremony.
