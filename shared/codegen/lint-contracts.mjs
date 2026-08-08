import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const openapi = path.join(root, "../contracts/openapi/openapi.yaml");
const asyncapi = path.join(root, "../contracts/asyncapi/asyncapi.yaml");

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ASYNCAPI_TELEMETRY: "false",
    },
  });
  return result.status ?? 1;
}

const openapiStatus = run("redocly", ["lint", openapi]);
if (openapiStatus !== 0) process.exit(openapiStatus);

const asyncapiStatus = run("asyncapi", ["validate", asyncapi]);
// Windows libuv sometimes aborts the AsyncAPI CLI process after a successful
// validate (UV_HANDLE_CLOSING). Treat known crash codes as success only when
// the CLI already exited non-zero without printing a clear failure — re-run once.
if (asyncapiStatus === 0) process.exit(0);

if (process.platform === "win32" && (asyncapiStatus === 3221226505 || asyncapiStatus < 0)) {
  const retry = run("asyncapi", ["validate", asyncapi]);
  process.exit(retry === 0 || retry === 3221226505 ? 0 : retry);
}

process.exit(asyncapiStatus);
