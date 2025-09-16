## Relevant Files

- `src/shared/ipc.ts` - Define `TestCallChannels`, `TestCallEventChannels`, request/response and event types, and `TestCallApi`.
- `src/preload.ts` - Expose `window.testCall` and `window.testCallEvents` bridges.
- `src/main/ipc/test-call.ts` - Register IPC handlers for `testCall:start`, `testCall:stop`, and emit `testCall:event` stream.
- `src/main/ipc.ts` - Call `registerTestCallIpcHandlers()`.
- `src/main/services/test-call.ts` - Detection via Docker logs (MVP), event mapping, summary builder.
- `src/main/services/deployments-store.ts` - Read/write `testcall.json` helpers (`readTestCallResultByDeploymentId`, `writeTestCallResultByDeploymentId`).
- `src/renderer/lib/api.ts` - Add `testCallStart`, `testCallStop` wrappers.
- `src/renderer/components/deployment-run-panel.tsx` - Add "Test Call" button and modal launcher.
- `src/renderer/components/test-call-modal.tsx` - New UI modal for instructions, live status, transcript, reply sample.
- `src/main/ipc/__tests__/test-call.test.ts` - IPC start/stop and event stream tests (mock docker stream).
- `src/main/services/__tests__/test-call.test.ts` - Log parser unit tests → events.
- `src/renderer/components/__tests__/test-call-modal.test.tsx` - Modal renders dial info; reacts to events.

### Notes

- Unit tests live next to code (e.g., `foo.ts` and `foo.test.ts`).
- Run tests: `pnpm test` (or target a file: `pnpm test -- src/main/services/__tests__/test-call.test.ts`).
- Dial instructions should be derived from `Deployment.asterisk` values (`externalIp`, `sipPort`, credentials if present). Avoid `.env`; persist JSON in the deployment folder [[memory:8556070]].
- MVP detection uses Docker logs for the `asterisk` service; ARI/AMI is optional and can be added behind a flag later.

## Tasks

- [ ] 1.0 Define IPC API and backend scaffolding for test-call
  - [ ] 1.1 In `src/shared/ipc.ts`, add `TestCallChannels = { start, stop }` and `TestCallEventChannels = { event }`.
  - [ ] 1.2 Add `TestCallStartRequest/Response` types (Response includes dial info: `sipUri`, `host`, `port`, `username?`, `password?`, `notes`).
  - [ ] 1.3 Add `TestCallEvent` union (`status|transcript|reply|error|done`) with payload shapes.
  - [ ] 1.4 Add `TestCallApi` to `window` shape.
  - [ ] 1.5 In `src/preload.ts`, expose `testCall` (invoke start/stop) and `testCallEvents.onEvent(cb)` bridge.
  - [ ] 1.6 Create `src/main/ipc/test-call.ts` with `registerTestCallIpcHandlers()`; implement `start/stop` and event emission.
  - [ ] 1.7 Register from `src/main/ipc.ts`.
  - [ ] 1.8 Tests: `src/main/ipc/__tests__/test-call.test.ts` covers start/stop parameter validation and event channel wiring.

- [ ] 2.0 Implement Asterisk call detection (log parsing MVP; ARI/AMI optional)
  - [ ] 2.1 Create `src/main/services/test-call.ts` with `startDetection(deploymentId, onEvent)` using `runDockerStream(["compose","logs","--no-color","--follow","asterisk"])`.
  - [ ] 2.2 Implement log parsing → events: `status:awaiting-call`, `status:ringing`, `status:answered`, `status:pipeline-started`, `status:pipeline-finished`, `error`.
  - [ ] 2.3 Add regexes for common lines (auth failed, address in use, no matching extension) to produce actionable `error` events.
  - [ ] 2.4 Optional ARI/AMI stubs: structure interfaces but return `not-implemented`.
  - [ ] 2.5 Tests: `src/main/services/__tests__/test-call.test.ts` for parser mappings and edge cases (partial lines, reconnect).

- [ ] 3.0 Add "Test Call" UI trigger on running deployments and modal shell
  - [ ] 3.1 In `src/renderer/lib/api.ts`, add `testCallStart`, `testCallStop` wrappers calling preload.
  - [ ] 3.2 In `src/renderer/components/deployment-run-panel.tsx`, add a "Test Call" button to open modal.
  - [ ] 3.3 Create `src/renderer/components/test-call-modal.tsx` showing dial instructions with copy, start/stop controls, and live event feed.
  - [ ] 3.4 Load last summary (if present) on open and display above the feed.
  - [ ] 3.5 Tests: `src/renderer/components/__tests__/deployment-run-panel.test.tsx` updated to assert button visibility; new `test-call-modal.test.tsx` for render and basic interactions.

- [ ] 4.0 Stream live status, transcript snippets, and reply sample in the modal
  - [ ] 4.1 In `src/preload.ts`, add `testCallEvents.onEvent` bridging `ipcRenderer.on(TestCallEventChannels.event, ...)`.
  - [ ] 4.2 In the modal, append events to a ring buffer with auto-scroll and a filter box (reuse pattern from logs panel where practical).
  - [ ] 4.3 Show transcript snippets as they arrive; show reply sample text (and audio when event includes `audioUrl` in the future).
  - [ ] 4.4 Define pass/fail verdict once `status:pipeline-finished` (pass) or `error` (fail) is received.
  - [ ] 4.5 Tests: modal state updates correctly on `status/transcript/reply/error` events.

- [ ] 5.0 Persist last test result JSON per deployment and show last run summary
  - [ ] 5.1 In `src/main/services/deployments-store.ts`, add `getTestCallFilePathByDeploymentId`, `readTestCallResultByDeploymentId`, `writeTestCallResultByDeploymentId` targeting `testcall.json`.
  - [ ] 5.2 From `registerTestCallIpcHandlers`, write a summary on `done`/`error` with timestamps, verdict, and short transcript/reply sample.
  - [ ] 5.3 In the modal, fetch and show the last summary; include a "Ran X mins ago" timestamp.
  - [ ] 5.4 Tests: round-trip read/write helpers and IPC persistence path.

- [ ] 6.0 Implement failure diagnostics and actionable remediation hints
  - [ ] 6.1 Add `computeTestCallHint(reasonOrMessage)` mapping to user-facing tips (auth failure, port blocked, no matching extension, asterisk not running).
  - [ ] 6.2 Render hints under the feed on failure; include a "Run Preflight" button that opens the Preflight panel.
  - [ ] 6.3 Track a small metrics object in the summary (counts for statuses, first error) for future UX.
  - [ ] 6.4 Tests: hints mapping yields expected titles/suggestions for simulated errors.
