## Relevant Files

- `src/main/infra/asterisk/conf/ari.conf` - Default ARI config template (seed for rendering).
- `src/main/infra/asterisk/conf/pjsip.conf` - Default PJSIP config template.
- `src/main/infra/asterisk/conf/extensions.conf` - Default dialplan template.
- `src/main/infra/asterisk/conf/manager.conf` - Default AMI config template.
- `src/main/infra/asterisk/conf/queues.conf` - Default queues template.
- `src/shared/types/asterisk.ts` - New: Asterisk config types and Zod schema.
- `src/shared/types/__tests__/asterisk.test.ts` - Unit tests for `asterisk.ts` schema and defaults.
- `src/shared/ipc.ts` - Add Asterisk IPC channels and typed requests/responses.
- `src/main/services/asterisk-config.ts` - New: Render/validate Asterisk configs from templates + tokens.
- `src/main/services/__tests__/asterisk-config.test.ts` - Unit tests for render/validate logic.
- `src/main/ipc/asterisk.ts` - New: Register `asterisk:render-config` and `asterisk:validate-config` handlers.
- `src/main/ipc/__tests__/asterisk.test.ts` - Tests for Asterisk IPC handlers (happy/error paths).
- `src/main/ipc.ts` - Register Asterisk IPC with existing handler bootstrap.
- `src/main/services/deployments-store.ts` - Persist `asterisk` settings and emit files under `[deployment]/asterisk/`.
- `src/main/services/__tests__/deployments-store.test.ts` - Expand tests to cover `asterisk` persistence/emit.
- `src/main/services/workspace-root.ts` - Ensure target paths resolve within selected workspace root.
- `src/preload.ts` - Expose `window.asterisk` API for renderer.
- `src/renderer/components/asterisk-editor.tsx` - New: Form component (Basic/Advanced) for editing Asterisk.
- `src/renderer/components/__tests__/asterisk-editor.test.tsx` - Tests for form validation and events.
- `src/renderer/pages/asterisk-page.tsx` - New: Page wrapper hosting the editor + actions.
- `src/renderer/pages/__tests__/asterisk-page.test.tsx` - Route/page render tests.
- `src/renderer/routes.tsx` - Add nav link and route for Asterisk editor.
- `src/renderer/lib/api.ts` - Optional helpers wrapping `window.asterisk` calls.
- `src/shared/types/deployments.ts` - Extend `Deployment` schema with `asterisk` block.
- `src/shared/types/__tests__/deployments.test.ts` - Update tests for the extended schema.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `AsteriskEditor.tsx` and `AsteriskEditor.test.tsx` in the same directory).
- Use `pnpm test [optional/path/to/test/file]` to run tests. Running without a path executes all tests (Vitest).
- Persist all configuration in local JSON only; do not introduce `.env` files.
- On Windows, use `path.join`/`path.resolve` to handle paths under the workspace root.

## Tasks

- [ ] 1.0 Define Asterisk config templates and token schema
  - [x] 1.1 Create `src/shared/types/asterisk.ts` with `AsteriskConfig` Zod schema and defaults (fields: `externalIp`, `sipPort`, `rtpStart`, `rtpEnd`, `codecs[]`, `dtmfMode`, minimal `pjsip` object).
  - [x] 1.2 Enumerate supported `dtmfMode` and sane codec defaults (e.g., `opus`, `ulaw`).
  - [x] 1.3 Define token names and mapping strategy (e.g., `{{EXTERNAL_IP}}`, `{{SIP_PORT}}`, `{{RTP_START}}`, `{{RTP_END}}`, `{{CODECS}}`, `{{DTMF_MODE}}`).
  - [x] 1.4 Implement a safe token renderer (no partial token collisions; escape braces) and tests in `src/main/services/__tests__/asterisk-config.test.ts`.
  - [x] 1.5 Document the token map and defaults in code-level docstrings.

- [ ] 2.0 Implement IPC: `asterisk:render-config` and `asterisk:validate-config`
  - [x] 2.1 Extend `src/shared/ipc.ts` with `AsteriskChannels = { renderConfig, validateConfig }` and typed request/response payloads.
  - [x] 2.2 Implement `src/main/services/asterisk-config.ts` with `renderAsteriskConfig(config, sourceDir, targetDir)` and `validateAsteriskConfig(config)`.
  - [x] 2.3 Add `src/main/ipc/asterisk.ts` to register `ipcMain.handle` for both channels, delegating to the service.
  - [x] 2.4 Update `src/main/ipc.ts` to call `registerAsteriskIpcHandlers()`.
  - [x] 2.5 Update `src/preload.ts` to expose `window.asterisk` with typed methods: `renderConfig(req)`, `validateConfig(req)`.
  - [x] 2.6 Add IPC tests in `src/main/ipc/__tests__/asterisk.test.ts` (valid config writes files; invalid returns issues).

- [ ] 3.0 Build `AsteriskEditor` form in renderer (Basic/Advanced)
  - [x] 3.1 Create `src/renderer/components/asterisk-editor.tsx` with controlled inputs for external IP, SIP port, RTP range, codecs (multi-select), DTMF mode, and an Advanced section for minimal PJSIP overrides.
  - [x] 3.2 Validate on change/blur with the shared Zod schema; show inline errors.
  - [x] 3.3 Add actions: Save (persist to `deployment.json` and emit files) and Preview (render to strings without writing; modal view of `pjsip.conf`/`extensions.conf`).
  - [x] 3.4 Create `src/renderer/pages/asterisk-page.tsx` and integrate the editor; provide a dropdown of deployments to edit (or respect current selection).
  - [x] 3.5 Update `src/renderer/routes.tsx` to add the `/asterisk` route and left-nav link.
  - [x] 3.6 Add component/page tests under `src/renderer/components/__tests__/` and `src/renderer/pages/__tests__/`.

- [ ] 4.0 Persist settings to `deployment.json` and emit files to `[deployment]/asterisk/`
  - [x] 4.1 Extend `src/shared/types/deployments.ts` to include an optional `asterisk: AsteriskConfig` block with validation.
  - [x] 4.2 Update `DeploymentsUpdateRequest` in `src/shared/ipc.ts` to accept `asterisk` updates.
  - [x] 4.3 Update `src/main/services/deployments-store.ts` to persist `asterisk` and, on save, ensure `[deployment]/asterisk/` exists and call `renderAsteriskConfig` to write `ari.conf`, `pjsip.conf`, `extensions.conf`, `manager.conf`, `queues.conf`.
  - [x] 4.4 Ensure path resolution uses `workspace-root.ts`; create directories as needed.
  - [x] 4.5 Extend store tests to assert file emission and idempotency on repeated saves.
  - [x] 4.6 Update duplication logic to copy `asterisk` settings and emitted files.

- [ ] 5.0 Integrate with deployment lifecycle and compose mounts; add tests
  - [ ] 5.1 Ensure compose generation (when implemented) mounts `[deployment]/asterisk/*.conf` read-only.
  - [x] 5.2 Add an "Edit Asterisk" entry point from the Deployments UI to navigate to the editor for the selected deployment.
  - [ ] 5.3 Verify preflight (conflicts/ports) will consume values from `asterisk` (handoff to preflight task).
  - [x] 5.4 Add integration tests covering an edit-save cycle and subsequent file writes.
