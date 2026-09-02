# Standard Operating Procedure (SOP): Zero-Downtime Rollback

**Document ID**: SOP-REL-001  
**Version**: 3.0.0  
**Target Systems**: Kubernetes (`infrastructure/k8s/`), Docker Compose (`infrastructure/docker/`), PostgreSQL 16 (`apps/api/migrations`), Redis 7  
**Owner**: Release Engineering & SRE  

---

## 1. Objective & Scope

This Standard Operating Procedure defines the exact, deterministic steps required to execute a zero-downtime rollback of XplainAI services in the event of a production or staging incident (e.g., fatal unhandled exceptions, memory leaks, high error rates, or data integrity regressions).

---

## 2. Incident Classification & Trigger Criteria

| Severity | Threshold / Symptoms | Rollback Authority | Action Window |
|---|---|---|---|
| **P0 — Critical** | Service outage (5xx > 5%), database migration lockup, severe security regression, continuous pod crashloop (`CrashLoopBackOff`). | Any SRE / On-call Engineer | Immediate (< 5 min) |
| **P1 — High** | Elevated latency (p99 > 5s), WebSocket streaming connection failures, Redis rate-limiting false positives blocking > 10% users. | Lead Engineer / SRE | < 15 min |
| **P2 — Medium** | Non-critical frontend UI rendering glitches, canvas visualizer defects with healthy core API. | Engineering Lead | Scheduled / Evaluated |

---

## 3. Pre-Rollback Diagnostics & State Preservation

Before executing a rollback, capture diagnostics from the failing environment for post-incident root cause analysis (RCA):

```bash
# 1. Capture Kubernetes failing pod logs and events
kubectl logs -n xplainai-prod -l app.kubernetes.io/name=xplainai --tail=500 > /tmp/xplainai_incident_logs.txt
kubectl get events -n xplainai-prod --sort-by='.metadata.creationTimestamp' | tail -n 50 > /tmp/xplainai_k8s_events.txt

# 2. Capture Docker Compose logs (if running on standalone VM)
docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml logs --tail=500 > /tmp/xplainai_compose_incident.log

# 3. Capture current Alembic migration version
cd apps/api && uv run alembic current
```

---

## 4. Rollback Execution Procedures

### Option 1: Automated Script Execution (Recommended)

Execute the standardized rollback automation script:

```bash
# Kubernetes Production Rollback with automated readiness validation:
./tools/scripts/rollback.sh --env k8s --namespace xplainai-prod

# Docker Compose Production Rollback to previous stable tag:
./tools/scripts/rollback.sh --env docker --target-tag v2.2.0
```

---

### Option 2: Kubernetes Zero-Downtime Rollout Undo

Kubernetes deployments for `xplainai-api` and `xplainai-web` specify `RollingUpdate` with `maxSurge: 1` and `maxUnavailable: 0`. Rolling back will spin up previous pods and verify `/health/ready` before terminating the problematic pods.

```bash
# 1. Rollback API Deployment
kubectl rollout undo deployment/xplainai-api -n xplainai-prod

# 2. Rollback Web Frontend Deployment
kubectl rollout undo deployment/xplainai-web -n xplainai-prod

# 3. Monitor rollout progress until completion
kubectl rollout status deployment/xplainai-api -n xplainai-prod --timeout=120s
kubectl rollout status deployment/xplainai-web -n xplainai-prod --timeout=120s

# 4. Verify pod status
kubectl get pods -n xplainai-prod -l app.kubernetes.io/name=xplainai
```

---

### Option 3: Docker Compose Rollback

If operating in a containerized single-host or multi-host Docker Compose environment:

```bash
# 1. Identify previous stable release commit or tag
git checkout <PREVIOUS_STABLE_TAG>  # e.g., v2.2.0 or previous commit SHA

# 2. Re-pull / Re-build production images
docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml build

# 3. Re-create containers with zero-downtime recreation
docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml up -d --remove-orphans

# 4. Check container health status
docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml ps
```

---

### Option 4: Database Schema Rollback (Alembic)

> **WARNING**: Only perform database downgrades if the newly applied migration introduced a breaking schema defect. If data was written to new columns, take a point-in-time snapshot before downgrading.

```bash
# 1. Check current applied migration
cd apps/api
uv run alembic current

# 2. Downgrade exactly 1 revision
uv run alembic downgrade -1

# 3. Or downgrade to a specific historical revision ID
uv run alembic downgrade <REVISION_ID>

# 4. Confirm schema state
uv run alembic current
```

---

### Option 5: Redis Cache & State Invalidation

If the incident was caused by poisoned cache keys, corrupted session state, or stale rate-limit counters:

```bash
# Purge sliding-window rate limit and cost circuit breaker keys
redis-cli -u "$REDIS_URL" --scan --pattern "budget:*" | xargs -r redis-cli -u "$REDIS_URL" del
redis-cli -u "$REDIS_URL" --scan --pattern "ratelimit:*" | xargs -r redis-cli -u "$REDIS_URL" del

# Complete DB flush (if safe and non-persistent session memory only)
redis-cli -u "$REDIS_URL" FLUSHDB ASYNC
```

---

## 5. Post-Rollback Verification & Smoke Testing

After rollback completes, perform mandatory health checks across all tiers:

### 5.1 Container Liveness Check
```bash
curl -fsS http://localhost:8000/health/live
# Expected: HTTP 200 {"status":"ok","service":"xplainai-api","version":"...","uptime_seconds":...}
```

### 5.2 Deep Readiness Check (Database + Redis Probe)
```bash
curl -fsS http://localhost:8000/health/ready
# Expected: HTTP 200 {"status":"ok","database":"connected","redis":"connected","llm_service":"ready"}
```

### 5.3 Prometheus Telemetry
```bash
curl -fsS http://localhost:8000/metrics | grep http_requests_total
# Expected: Valid Prometheus metric lines returned
```

### 5.4 WebSocket Chat Handshake
Verify that WebSocket clients can establish connections to `/ws/v1/chat` without immediate closure or 1006 abnormal disconnects.

---

## 6. Post-Mortem & Incident Closure

1. **Notify Stakeholders**: Post incident resolution update in `#incident-response` channel with rollback confirmation and current system health status.
2. **Schedule Root Cause Analysis (RCA)**: Schedule blameless post-mortem within 24 hours.
3. **Quarantine Build**: Add failing commit SHA / tag to release blocker list in GitHub Issues / Releases.
