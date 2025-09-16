## Relevant Files

- `src/shared/types/deployments.ts` — Types for deployment model and compose inputs.
- `src/shared/types/providers.ts` — Types for provider-derived env/options.
- `src/shared/types/asterisk.ts` — Asterisk mount/port info used by compose.
- `src/main/services/template-registry.ts` — Service fragments/templates lookup.
- `src/main/services/compose-writer.ts` — Compose generation from deployment + providers (new).
- `src/main/services/deployments-store.ts` — Load/save deployment to feed writer.
- `src/main/services/docker-cli.ts` — Run compose commands and fetch status/logs.
- `src/main/ipc/compose.ts` — IPC handlers: generate/up/down/status/logs (new).
- `src/main/ipc.ts` — Register compose IPC routes.
- `src/renderer/components/deployment-run-panel.tsx` — Start/Stop/status/logs UI (new).
- `src/renderer/pages/deployments-page.tsx` — Host run panel and actions.
- `src/renderer/lib/api.ts` — Bridge helpers to call compose IPC.
- `src/main/services/__tests__/compose-writer.test.ts` — Unit tests for writer (new).
- `src/main/ipc/__tests__/compose.test.ts` — IPC handler tests (new).
- `src/main/services/__tests__/docker-cli.test.ts` — Docker CLI wrapper tests.
- `src/renderer/components/__tests__/deployment-run-panel.test.tsx` — UI tests (new).

### Notes

- Compose version `3.9`; prefix resource names with the deployment slug.
- Inject provider env from JSON and mount `asterisk/` read-only. No `.env` files.
- Ensure deterministic YAML output: stable key ordering and service ordering.

## Tasks

- [x] 1.0 Build deterministic compose writer from `deployment.json` + provider settings
  - [x] 1.1 Define mapping from modular/STS selections to service fragments.
  - [x] 1.2 Generate service names with `${slug}-*` prefixes and consistent aliases.
  - [x] 1.3 Inject provider env vars from providers JSON; include only required keys.
  - [x] 1.4 Add Asterisk mounts (`asterisk/*.conf` read-only) and needed ports.
  - [x] 1.5 Normalize and sort YAML keys for deterministic output; snapshot-friendly.
  - [x] 1.6 Write `docker-compose.yml` into the deployment folder; idempotent writes.
  - [x] 1.7 Unit tests covering modular, STS, and mixed provider paths.

- [x] 2.0 Implement IPC + Docker CLI integration (`compose:generate`, `compose:up`, `compose:down`, `compose:status`, `compose:logs`)
  - [x] 2.1 `compose:generate` → runs writer, returns file path and summary.
  - [x] 2.2 `compose:up` → `docker compose up -d`; parse start results per service.
  - [x] 2.3 `compose:down` → `docker compose down`; report removed/stopped items.
  - [x] 2.4 `compose:status` → aggregate `docker ps/inspect` into typed status.
  - [x] 2.5 `compose:logs` → stream logs by service with cancel/follow controls.
  - [x] 2.6 Timeouts, cancellation, Windows-safe quoting, and robust error mapping.
  - [x] 2.7 Tests with mocks for command execution and IPC.

- [x] 3.0 Implement runtime status/health aggregation and service name mapping
  - [x] 3.1 Map `${slug}-*` container names back to logical services.
  - [x] 3.2 Parse healthchecks from inspect; fallback to running/exited states.
  - [x] 3.3 Polling/subscribe model to update renderer efficiently.
  - [x] 3.4 Tests for status mapping and health parsing.

- [x] 4.0 Implement `DeploymentRunPanel` UI with Start/Stop, per-service status, logs
  - [x] 4.1 Buttons for Generate, Start, Stop; disabled states and spinners.
  - [x] 4.2 Status list with per-service badges and overall rollup.
  - [x] 4.3 Logs viewer with follow and filter.
  - [x] 4.4 Error banners with remediation hints.
  - [x] 4.5 UI tests simulating IPC responses and log streams.

- [x] 5.0 Validation and error handling (env injection, mounts, ports)
  - [x] 5.1 Validate required env presence for selected providers.
  - [x] 5.2 Ensure Asterisk mounts and port ranges are included when needed.
  - [x] 5.3 Detect port conflicts and suggest alternative ports.
  - [x] 5.4 Standardize error shapes; surface actionable messages to UI.
  - [x] 5.5 Tests for validation paths and error mapping.

- [x] 6.0 Tests for compose writer, Docker CLI wrapper, IPC, and UI
  - [x] 6.1 Snapshot tests for YAML output across representative inputs.
  - [x] 6.2 CLI wrapper tests: command lines, quoting, and parsing.
  - [x] 6.3 IPC tests: request/response contracts and failure cases.
  - [x] 6.4 UI tests: Start/Stop flows, status rendering, logs follow.
