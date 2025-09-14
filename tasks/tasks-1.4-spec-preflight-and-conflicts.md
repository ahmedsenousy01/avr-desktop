## Relevant Files

- `src/shared/ipc.ts` - Add `preflight:run` and `preflight:last` channels with typed requests/responses.
- `src/main/services/preflight.ts` - New: Preflight checks engine (docker, ports, names, provider keys) and result shaping.
- `src/main/services/__tests__/preflight.test.ts` - Unit tests for preflight checks engine.
- `src/main/ipc/preflight.ts` - New: Register IPC handlers delegating to the preflight service.
- `src/main/ipc/__tests__/preflight.test.ts` - Tests for IPC handlers (happy/error paths).
- `src/main/services/deployments-store.ts` - Persist last preflight results next to `deployment.json`.
- `src/main/services/__tests__/deployments-store.test.ts` - Extend tests to cover preflight results persistence.
- `src/main/services/workspace-root.ts` - Resolve paths to `[deployment]/` for reading/writing results.
- `src/renderer/lib/api.ts` - Add typed wrappers for `preflight.run()` and `preflight.last()`.
- `src/renderer/components/preflight-panel.tsx` - New: UI panel showing grouped checks with pass/warn/fail and remedies.
- `src/renderer/components/__tests__/preflight-panel.test.tsx` - Component tests for rendering states and actions.
- `src/renderer/pages/deployments-page.tsx` - Integrate panel and disable Start until preflight passes; add re-run button.
- `src/renderer/pages/__tests__/deployments-page.test.tsx` - Extend tests to assert Start gating and panel visibility.
- `src/shared/types/preflight.ts` - Define `PreflightSeverity` and `PreflightItem` shared types.
- `src/main/services/docker-cli.ts` - Docker CLI helper `runDocker(args, opts)` with timeouts and stderr capture.
- `src/main/services/__tests__/docker-cli.test.ts` - Tests for Docker CLI wrapper and availability.

### Notes

- Use Vitest; place tests alongside the files they cover. Run: `pnpm test`.
- Persist preflight results as JSON next to `deployment.json`; do not use `.env` files [[memory:8556070]].
- On Windows, execute Docker via CLI from the main process and handle stderr/exit codes.
- Group results as pass/warn/fail with human-friendly messages and remediation links.

## Tasks

- [x] 1.0 Implement preflight checks engine in main process
  - [x] 1.1 Define `PreflightSeverity = 'pass' | 'warn' | 'fail'` and `PreflightItem` shape `{ id, title, severity, message, remediation?, data? }` in shared types.
  - [x] 1.2 Create check runner orchestrator: run checks sequentially with timeouts; collect results and summary.
  - [x] 1.3 Implement provider keys check: read providers JSON; report missing keys for selected providers.
  - [x] 1.4 Implement container/name collision check using deployment slug prefix; inspect existing containers/networks.
  - [x] 1.5 Implement result grouping and sorting (fails first, then warns, then passes) for UI consumption.

- [x] 2.0 Add Docker and environment detection (CLI wrappers, error handling)
  - [x] 2.1 Implement a `runDocker(args, opts)` helper (spawn) with Windows compatibility, timeouts, and stderr capture.
  - [x] 2.2 Add `checkDockerAvailable()` using `docker version --format '{{.Server.Version}}'` with friendly failure messages.
  - [x] 2.3 Add unit tests for CLI wrapper (mock spawn) and docker availability parsing/edge cases.

- [x] 3.0 Detect host port availability and container/name collisions
  - [x] 3.1 Build list of ports to probe: SIP and RTP from deployment `asterisk` (or defaults); plus any declared service ports.
  - [x] 3.2 Implement host port check using Node `net` to attempt bind/connect to each port; mark used vs free.
  - [x] 3.3 Query Docker for container port mappings; detect conflicts with planned service/compose ports.
  - [x] 3.4 Implement container/name collision check for `${slug}-*` resources (containers, networks, volumes) pre-existence.
  - [x] 3.5 Emit `fail` for hard conflicts; emit `warn` for soft issues (e.g., large RTP overlaps).

- [x] 4.0 Persist and expose preflight results via IPC (`preflight:run`, `preflight:last`)
  - [x] 4.1 Define IPC request/response types in `src/shared/ipc.ts`.
  - [x] 4.2 Add `ipcMain.handle('preflight:run')` to execute checks and write `preflight.json` next to `deployment.json`.
  - [x] 4.3 Add `ipcMain.handle('preflight:last')` to read the stored results if present.
  - [x] 4.4 Extend `deployments-store.ts` with helpers to resolve paths and persist results atomically.
  - [x] 4.5 Add tests for both handlers (happy/error paths) and persistence layer.

- [x] 5.0 Build renderer `PreflightPanel` and integrate Start gating on Deployments page
  - [x] 5.1 Implement `PreflightPanel` to render grouped checks (Docker, Ports, Names, Provider Keys) with pass/warn/fail badges.
  - [x] 5.2 Add actions: Run Preflight, View Details, Copy diagnostics; show last run timestamp and elapsed time.
  - [x] 5.3 Disable Start/Compose actions when any `fail` exists; allow start on only `warn`/`pass`.
  - [x] 5.4 Integrate with `deployments-page.tsx`; surface banners and remediation links.
  - [x] 5.5 Component and page tests covering gating and rendering states.

- [x] 6.0 Consume Asterisk config values in preflight (from 1.3 spec, task 5.3)
  - [x] 6.1 Read `asterisk` block from `deployment.json`; fall back to schema defaults when missing.
  - [x] 6.2 Use `sipPort`, `rtpStart`, and `rtpEnd` to populate the port probe list for host checks.
  - [x] 6.3 Validate RTP range bounds and ensure no overlaps with reserved/used ports; emit actionable messages.
  - [x] 6.4 Add tests ensuring Asterisk values influence detected conflicts and reported messages.
