FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app

FROM base AS deps
COPY pyproject.toml uv.lock ./
COPY ../shared/packages/contracts-py /shared/packages/contracts-py
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project

FROM deps AS development
RUN uv sync --frozen --all-extras
COPY . .
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "neural_navigator.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM deps AS production
COPY . .
RUN uv sync --frozen --no-dev
RUN useradd --create-home --uid 10001 appuser && chown -R appuser /app
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/live').status==200 else 1)"
CMD ["uv", "run", "uvicorn", "neural_navigator.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
