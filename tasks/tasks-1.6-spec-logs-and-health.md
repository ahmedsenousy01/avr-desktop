## Relevant Files

- `src/main/ipc/compose.ts` - IPC handlers for compose actions, logs stream, and status watch.
- `src/main/services/docker-cli.ts` - Docker CLI runner and streaming primitive used by logs/status.
- `src/renderer/lib/api.ts` - Renderer helpers that call `window.compose.*` and expose events.
- `src/preload.ts` - Bridges `compose` methods and `composeEvents` to the renderer.
- `src/shared/ipc.ts` - Channel names, request/response types, and event payload types.
- `src/renderer/components/deployment-run-panel.tsx` - UI to surface logs/health within the run view.
- `src/renderer/components/__tests__/deployment-run-panel.test.tsx` - Unit tests for logs/health UI behaviors.
- `src/main/ipc/__tests__/compose.test.ts` - Tests for compose IPC including logs/status behaviors.
- `src/main/services/__tests__/docker-cli.test.ts` - Tests for streaming and error handling of Docker CLI.

### Notes

- Unit tests should live next to the files listed above, aligned with the existing structure.
- Use `pnpm test` to run tests, or filter by path with `pnpm test src/main/ipc/__tests__/compose.test.ts`.

## Tasks

- [x] 1.0 Implement IPC log streaming with backpressure and per-service ring buffers
  - [x] 1.1 Define `ComposeChannels.logsStart/logsStop` handlers in `src/main/ipc/compose.ts` using `runDockerStream(["compose","-f", path, "logs","-f", service?])`
  - [x] 1.2 Emit `ComposeEventChannels.logsData` chunks; on close emit `logsClosed` with exit code
  - [x] 1.3 Maintain in-memory ring buffers per `subscriptionId` (default 2000 lines) for resend-on-subscribe
  - [x] 1.4 Support aggregate logs when `service` is omitted; tag chunks with service name if needed
  - [x] 1.5 Ensure cancellation via `logsStop` kills the underlying process and cleans up buffers

- [x] 2.0 Implement Docker health/status polling and aggregate deployment status
  - [x] 2.1 Implement `statusStart/statusStop` IPC handlers that poll `docker compose ps` or `docker inspect` per service
  - [x] 2.2 Normalize to `ComposeServiceStatus { service, state, containerId?, health?, role? }`
  - [x] 2.3 Broadcast periodic updates via `ComposeEventChannels.statusUpdate`
  - [x] 2.4 Add single-shot `status` method returning current snapshot

- [x] 3.0 Build renderer Logs panel (tabs, follow, search) and Health badges
  - [x] 3.1 Add tabs per service with counts; “All” aggregate tab
  - [x] 3.2 Implement follow toggle and search filter over ring buffer (client-side)
  - [x] 3.3 Display `HealthBadge` using `health` and `state` from status updates
  - [x] 3.4 Wire to `compose.logsStart/Stop` and status subscribe/unsubscribe; manage lifecycles

- [x] 4.0 Integrate logs/health with deployment lifecycle and service selection
  - [x] 4.1 Start status watch after successful `compose.up`; stop on `compose.down`
  - [x] 4.2 Auto-start logs for the selected service; switch streams on tab change
  - [x] 4.3 Handle reconnection and closed events with user feedback

- [x] 5.0 Add optional log export and error surfacing; define tests and acceptance
  - [x] 5.1 Implement export-to-file for current tab buffer into `[deployment]/logs/`
  - [x] 5.2 Surface stream errors and restarts clearly in UI
  - [x] 5.3 Add unit tests for IPC handlers, ring buffer behavior, and UI follow/search
  - [x] 5.4 Satisfy acceptance: near real-time updates; badges reflect transitions promptly
