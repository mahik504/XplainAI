.DEFAULT_GOAL := help
.PHONY: help bootstrap services-up services-down dev dev-web dev-api lint typecheck test test-e2e contracts-lint contracts-gen migrate build clean

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

bootstrap: ## Install all frontend and backend dependencies
	pnpm install
	cd backend && uv sync --all-extras

services-up: ## Start Postgres, Redis and the observability stack
	docker compose up -d postgres redis otel-collector

services-down: ## Stop local infrastructure containers
	docker compose down

dev: ## Run frontend and backend together with hot reload
	docker compose up --build web api

dev-web: ## Run only the Vite dev server
	pnpm --filter @neural-navigator/web dev

dev-api: ## Run only the FastAPI dev server
	cd backend && uv run uvicorn neural_navigator.main:app --reload

lint: ## Lint every package
	pnpm -r lint
	cd backend && uv run ruff check . && uv run ruff format --check .

typecheck: ## Static type checks for both languages
	pnpm -r typecheck
	cd backend && uv run mypy src

test: ## Run unit and integration tests
	pnpm -r test
	cd backend && uv run pytest

test-e2e: ## Run Playwright end-to-end suite
	pnpm --filter @neural-navigator/web test:e2e

contracts-lint: ## Validate OpenAPI and AsyncAPI documents
	pnpm contracts:lint

contracts-gen: ## Regenerate typed clients from the contracts
	pnpm contracts:gen
	cd backend && uv run python ../tools/codegen/generate_python_models.py

migrate: ## Apply database migrations
	cd backend && uv run alembic upgrade head

build: ## Produce production artifacts
	pnpm build
	docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml build

clean: ## Remove build and cache artifacts
	rm -rf frontend/dist frontend/node_modules node_modules backend/.venv
	find . -name '__pycache__' -type d -prune -exec rm -rf {} +
