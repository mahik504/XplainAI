#!/usr/bin/env bash
# =============================================================================
# XplainAI — Staging Deployment & Validation Automation Script
# Description: Automates staging rollout, migrations, and health verification.
# =============================================================================

set -euo pipefail

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
DEPLOY_MODE="docker"
NAMESPACE="xplainai-staging"
HEALTH_URL="http://localhost:8000"
SKIP_MIGRATIONS=false
MAX_RETRIES=15
RETRY_INTERVAL_SECONDS=4
DRY_RUN=false
START_TIME=$(date +%s)

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

show_help() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Staging Deployment and Verification Automation for XplainAI.

Options:
  --mode <docker|k8s>        Deployment target engine (default: docker)
  --namespace <name>         Kubernetes namespace (default: xplainai-staging)
  --health-url <url>         API base URL for health verification (default: http://localhost:8000)
  --skip-migrations          Skip running database schema migrations
  --dry-run                  Simulate deployment actions without executing
  -h, --help                 Show this help message and exit

Examples:
  ./deploy-staging.sh --mode docker
  ./deploy-staging.sh --mode k8s --namespace xplainai-staging
  ./deploy-staging.sh --dry-run
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)
            DEPLOY_MODE="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --health-url)
            HEALTH_URL="$2"
            shift 2
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown argument: $1"
            show_help
            exit 1
            ;;
    esac
done

check_prerequisites() {
    log_info "Checking toolchain prerequisites for staging deployment..."
    if [[ "$DEPLOY_MODE" == "k8s" ]]; then
        if ! command -v kubectl &> /dev/null; then
            log_error "kubectl is required for k8s deployment but was not found in PATH."
            exit 1
        fi
    elif [[ "$DEPLOY_MODE" == "docker" ]]; then
        if ! command -v docker &> /dev/null; then
            log_error "docker is required for docker deployment but was not found in PATH."
            exit 1
        fi
    fi
    log_success "Prerequisites check passed."
}

run_migrations() {
    if [[ "$SKIP_MIGRATIONS" == true ]]; then
        log_info "Skipping database migrations as requested (--skip-migrations)."
        return 0
    fi

    log_info "Running Alembic database schema migrations (upgrade head)..."
    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would execute: cd apps/api && uv run alembic upgrade head"
        return 0
    fi

    if command -v uv &> /dev/null && [ -d "apps/api" ]; then
        (cd apps/api && uv run alembic upgrade head)
        log_success "Database migrations successfully applied."
    else
        log_warn "uv or apps/api directory not found locally; ensure migrations run in init container."
    fi
}

deploy_staging() {
    log_info "Deploying XplainAI Staging stack using mode: ${DEPLOY_MODE}..."
    
    if [[ "$DEPLOY_MODE" == "k8s" ]]; then
        if [[ "$DRY_RUN" == true ]]; then
            log_info "[DRY-RUN] Would execute: kubectl apply -k infrastructure/k8s/overlays/staging"
            return 0
        fi
        kubectl apply -k infrastructure/k8s/overlays/staging
        log_info "Awaiting rollout status for staging deployments..."
        kubectl rollout status deployment/staging-xplainai-api -n "${NAMESPACE}" --timeout=120s
        kubectl rollout status deployment/staging-xplainai-web -n "${NAMESPACE}" --timeout=120s
    elif [[ "$DEPLOY_MODE" == "docker" ]]; then
        if [[ "$DRY_RUN" == true ]]; then
            log_info "[DRY-RUN] Would execute: docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml up -d --build"
            return 0
        fi
        docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml up -d --build --remove-orphans
    fi

    log_success "Staging deployment manifest application completed."
}

verify_staging_health() {
    if ! command -v curl &> /dev/null; then
        log_warn "curl not found in PATH; skipping automated HTTP health probes."
        return 0
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would probe endpoints on ${HEALTH_URL}"
        return 0
    fi

    log_info "Validating staging endpoints on ${HEALTH_URL}..."
    local attempt=1
    local ready=false

    while [[ $attempt -le $MAX_RETRIES ]]; do
        log_info "Health readiness probe (attempt $attempt / $MAX_RETRIES)..."
        
        local response_code
        response_code=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}/health/ready" || echo "000")

        if [[ "$response_code" == "200" ]]; then
            ready=true
            log_success "Staging /health/ready returned HTTP 200 OK!"
            break
        fi

        log_warn "Readiness endpoint returned HTTP ${response_code}. Retrying in ${RETRY_INTERVAL_SECONDS}s..."
        sleep "$RETRY_INTERVAL_SECONDS"
        ((attempt++))
    done

    if [[ "$ready" != true ]]; then
        log_error "Staging health verification failed after $((MAX_RETRIES * RETRY_INTERVAL_SECONDS)) seconds."
        exit 1
    fi

    # Verify metrics endpoint
    log_info "Validating Prometheus telemetry endpoint (/metrics)..."
    if curl -fsS "${HEALTH_URL}/metrics" > /dev/null 2>&1; then
        log_success "Prometheus /metrics endpoint responding correctly."
    else
        log_warn "/metrics endpoint returned non-200 status."
    fi
}

main() {
    echo "=================================================================="
    echo "           XplainAI Staging Deployment & Validation               "
    echo "=================================================================="
    log_info "Mode: ${DEPLOY_MODE}"
    log_info "Dry Run: ${DRY_RUN}"

    check_prerequisites
    run_migrations
    deploy_staging
    verify_staging_health

    local elapsed=$(( $(date +%s) - START_TIME ))
    log_success "Staging deployment and verification completed successfully in ${elapsed}s."
}

main "$@"
