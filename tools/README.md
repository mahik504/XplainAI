# Tools

Repository-wide developer tooling. Nothing here is shipped or imported by the
application.

| Directory | Contents |
| --- | --- |
| `codegen/` | Language-specific generator entry points invoked by `make contracts-gen`, notably `generate_python_models.py`, which turns the OpenAPI and AsyncAPI documents into Pydantic models under `shared/packages/contracts-py/src/nn_contracts/generated/`. The TypeScript half is driven by the npm package in `shared/codegen/`. |
| `scripts/` | Maintenance utilities: local database reset, seed data loading, dependency audit, release notes assembly, git hook installation. |

Scripts are expected to be idempotent and safe to run against a local environment
without arguments. Anything that can touch production must require an explicit
`--env` flag with no default.
