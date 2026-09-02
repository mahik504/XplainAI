# Infrastructure

Everything needed to run Neural Navigator somewhere other than a laptop. Application
code never reads from this directory at runtime.

| Directory | Contents |
| --- | --- |
| `docker/` | Compose overrides per environment (`docker-compose.prod.yml`), shared build args, `.dockerignore` sources. The base compose file stays at the repository root. |
| `k8s/` | Kustomize manifests. `base/` holds environment-agnostic Deployment, Service, HPA, and ConfigMap definitions; `overlays/{dev,staging,prod}/` patch replica counts, resource limits, ingress hosts, and secret references. |
| `terraform/` | Cloud resources: managed Postgres, Redis, object storage, DNS, IAM. `modules/` holds reusable components; `environments/` holds one composed root per environment with its own state backend. |
| `nginx/` | Reverse-proxy configuration for the production frontend image, including the WebSocket upgrade headers and long-lived proxy timeouts that streaming requires. |
| `observability/` | OpenTelemetry Collector pipelines (`otel/`), Prometheus scrape and alert rules (`prometheus/`), and provisioned Grafana dashboards (`grafana/`). |

## Deployment notes

The API is stateful in one specific way: WebSocket connections pin a user to a pod.
Scaling is safe only because `realtime/broker` fans messages out over Redis pub/sub —
if that component is ever bypassed, replicas above one will drop streamed frames.

Set generous ingress and proxy read timeouts (600s+) on the `/ws` path. The default
60s idle timeout on most load balancers will sever long agent runs mid-execution.

## Secrets

No secrets in this directory, ever. Terraform reads them from the cloud secret manager;
Kubernetes references them via `ExternalSecret` resources. `.env` files are for local
development only.
