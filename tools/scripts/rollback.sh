#!/usr/bin/env bash
# =============================================================================
# XplainAI — Zero-Downtime Rollback Script
# Description: Automates Kubernetes or Docker Compose rollback with health checks.
# =============================================================================

set -euo pipefail

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENV_TYPE="k8s"
NAMESPACE="xplainai-prod"
TARGET_TAG=""
HEALTH_URL="http://localhost:8000"
MAX_RETRIES=12
RETRY_INTERVAL_SECONDS=5
DRY_RUN=false
SKIP_DB=false

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

Zero-Downtime Rollback Automation for XplainAI.

Options:
  --env <k8s|docker>         Environment type to rollback (default: k8s)
  --namespace <name>         Kubernetes namespace (default: xplainai-prod)
  --target-tag <tag>         Git tag or commit SHA for Docker Compose rollback
  --health-url <url>         API base URL for health verification (default: http://localhost:8000)
  --skip-db                  Skip checking or running database schema downgrade
  --dry-run                  Simulate rollback steps without modifying resources
  -h, --help                 Show this help message and exit

Examples:
  ./rollback.sh --env k8s --namespace xplainai-prod
  ./rollback.sh --env docker --target-tag v2.2.0
  ./rollback.sh --env k8s --dry-run
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --env)
            ENV_TYPE="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --target-tag)
            TARGET_TAG="$2"
            shift 2
            ;;
        --health-url)
            HEALTH_URL="$2"
            shift 2
            ;;
        --skip-db)
            SKIP_DB=true
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
    log_info "Verifying required toolchain dependencies..."
    if [[ "$ENV_TYPE" == "k8s" ]]; then
        if ! command -v kubectl &> /dev/null; then
            log_error "kubectl is required for k8s rollback but was not found in PATH."
            exit 1
        fi
    elif [[ "$ENV_TYPE" == "docker" ]]; then
        if ! command -v docker &> /dev/null; then
            log_error "docker is required for docker rollback but was not found in PATH."
            exit 1
        fi
    fi
    if ! command -v curl &> /dev/null; then
        log_warn "curl not found in PATH; automated HTTP health probes will be skipped."
    fi
    log_success "Prerequisites verified."
}

rollback_kubernetes() {
    log_info "Initiating Kubernetes rolling update undo in namespace '${NAMESPACE}'..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would execute: kubectl rollout undo deployment/xplainai-api -n ${NAMESPACE}"
        log_info "[DRY-RUN] Would execute: kubectl rollout undo deployment/xplainai-web -n ${NAMESPACE}"
        log_info "[DRY-RUN] Would execute: kubectl rollout status deployment/xplainai-api -n ${NAMESPACE}"
        log_info "[DRY-RUN] Would execute: kubectl rollout status deployment/xplainai-web -n ${NAMESPACE}"
        return 0
    fi

    log_info "Rolling back Backend API deployment..."
    kubectl rollout undo deployment/xplainai-api -n "${NAMESPACE}"

    log_info "Rolling back Web Frontend deployment..."
    kubectl rollout undo deployment/xplainai-web -n "${NAMESPACE}"

    log_info "Awaiting rollout completion for Backend API..."
    kubectl rollout status deployment/xplainai-api -n "${NAMESPACE}" --timeout=120s

    log_info "Awaiting rollout completion for Web Frontend..."
    kubectl rollout status deployment/xplainai-web -n "${NAMESPACE}" --timeout=120s

    log_success "Kubernetes deployment rollout successfully restored."
}

rollback_docker_compose() {
    log_info "Initiating Docker Compose rollback..."

    if [[ -z "$TARGET_TAG" ]]; then
        log_error "--target-tag <tag/sha> must be specified when using --env docker"
        exit 1
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would checkout: git checkout ${TARGET_TAG}"
        log_info "[DRY-RUN] Would execute: docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml up -d --build"
        return 0
    fi

    log_info "Checking out target git reference: ${TARGET_TAG}"
    git checkout "${TARGET_TAG}"

    log_info "Rebuilding and recreating production containers..."
    docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml up -d --build --remove-orphans

    log_success "Docker Compose containers successfully updated."
}

verify_health_probes() {
    if ! command -v curl &> /dev/null; then
        log_warn "Skipping health probe verification (curl missing)."
        return 0
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would probe: ${HEALTH_URL}/health/live and ${HEALTH_URL}/health/ready"
        return 0
    fi

    log_info "Beginning post-rollback automated health checks on ${HEALTH_URL}..."
    local attempt=1
    local live_ok=false
    local ready_ok=false

    while [[ $attempt -le $MAX_RETRIES ]]; do
        log_info "Health verification probe (attempt $attempt / $MAX_RETRIES)..."
        
        # Test liveness probe
        if curl -fsS "${HEALTH_URL}/health/live" > /dev/null 2>&1; then
            live_ok=true
        else
            live_ok=false
        fi

        # Test readiness probe
        if curl -fsS "${HEALTH_URL}/health/ready" > /dev/null 2>&1; then
            ready_ok=true
        else
            ready_ok=false
        fi

        if [[ "$live_ok" == true && "$ready_ok" == true ]]; then
            log_success "All health probes PASSED! Service is fully operational and healthy."
            return 0
        fi

        log_warn "Health probes pending (live: $live_ok, ready: $ready_ok). Retrying in ${RETRY_INTERVAL_SECONDS}s..."
        sleep "$RETRY_INTERVAL_SECONDS"
        ((attempt++))
    done

    log_error "Health verification TIMED OUT after $((MAX_RETRIES * RETRY_INTERVAL_SECONDS)) seconds. Service may be degraded!"
    return 1
}

main() {
    echo "=================================================================="
    echo "         XplainAI Production Zero-Downtime Rollback               "
    echo "=================================================================="
    log_info "Target Environment: ${ENV_TYPE}"
    log_info "Dry Run Mode: ${DRY_RUN}"
    
    check_prerequisites

    if [[ "$ENV_TYPE" == "k8s" ]]; then
        rollback_kubernetes
    elif [[ "$ENV_TYPE" == "docker" ]]; then
        rollback_docker_compose
    else
        log_error "Unsupported environment: ${ENV_TYPE}. Choose 'k8s' or 'docker'."
        exit 1
    fi

    verify_health_probes

    log_success "Rollback workflow completed successfully."
}

main "$@"
