## Reactive Compose Generation and Environment Materialization

### Overview

Make compose planning and generation reactive to any deployment-related change and materialize resolved environment values back into `environment.json` so the Env Editor always shows up-to-date actual values. Provider secrets remain out of `environment.json` and are injected only at compose generation time.

This complements the single-source registry by ensuring the runtime env reflects the registry and current deployment state immediately.

### Goals

1. Trigger compose plan+generation automatically on any change to deployment/env/providers/asterisk.
2. Resolve `{{service:...}}` tokens and write materialized values back to `environment.json` (non-secrets only).
3. Keep provider secrets out of `environment.json`; inject during compose generation only.
4. Debounce and guard to avoid write loops and excessive I/O.
5. Ensure Env Editor shows actual values without special overlay logic.

### User Stories

- As a user, when I change a variable or provider key, the compose and env update within a second and the editor shows actual URLs.
- As a developer, I have a single flow that recomputes plan, writes compose, and materializes env safely without loops.

### Functional Requirements

1. Reactive Triggers (per deployment)
   - Env changes: after `upsertDeploymentEnvVar` and `removeDeploymentEnvVar` complete.
   - Provider changes: after provider key add/update/remove.
   - Deployment selection changes: type/providers changes in `deployment.json`.
   - Asterisk config changes: when config saved for a deployment.

2. Reactive Pipeline (sequence)
   1. Read latest providers, deployment selection, and `environment.json`.
   2. Build compose object and plan (slug map, services, values).
   3. Materialize env: resolve service tokens to current slugged names and compute core URLs (STS_URL or ASR/LLM/TTS URLs) as applicable.
   4. Write materialized `environment.json` if changed (non-secret fields only).
   5. Write `docker-compose.yml` if changed.
   6. Emit lightweight event/update so the renderer can refresh (optional if using request/response model).

3. Materialization Rules
   - Resolve `{{service:...}}` tokens to actual slug service names.
   - Overwrite only the derived fields:
     - For STS: `PORT` (if default), `STS_URL` in `avr-core`.
     - For modular: `ASR_URL`, `LLM_URL`, `TTS_URL` in `avr-core`.
   - Do not overwrite user-edited custom values outside these derived keys.
   - Never persist provider secrets into `environment.json`.

4. Debounce & Loop Prevention
   - Debounce per-deployment key by 150–300ms after last change.
   - Guard: if computed materialized env equals current file, skip write.
   - Guard: `writeDeploymentEnv` and subsequent pipeline should not re-trigger itself if no semantic changes are made.

5. Error Handling
   - If compose generation fails, surface non-blocking error; skip writing env/compose.
   - Partial failure must not corrupt `environment.json` or `docker-compose.yml` (write via temp + rename).

### Non-Functional Requirements

1. Performance: end-to-end reactivity under ~500ms for typical edits; large updates coalesced by debounce.
2. Security: provider secrets not written to `environment.json`.
3. Reliability: idempotent writes; no infinite loops; safe temp-file rename.

### Technical Design

1. Hook Points
   - `src/main/ipc/env.ts`: after upsert/remove, call `reactiveRebuild(deploymentId)`.
   - Providers IPC/service: after key changes, call `reactiveRebuild(deploymentId)` for affected deployments.
   - Deployments/Asterisk services: after save, call `reactiveRebuild(deploymentId)`.

2. Orchestrator
   - Implement `reactiveRebuild(deploymentId)` in a new module `src/main/services/reactive-compose.ts`:
     - Debounce by deploymentId.
     - Steps: load state → build plan → materialize → conditional write env → conditional write compose → notify.

3. Materialization Helper
   - Extend existing token resolution functions to operate over full env object and return a copy with resolved values.
   - Respect merge rules (only derived keys updated).

4. Compose Writer Integration
   - Reuse `buildComposeObject` + `writeComposeFile`.
   - Reuse `buildComposePlan` to get service name mapping and resolved values.

5. Env Editor Behavior
   - It continues to load `environment.json`; with materialization, displayed values will already be actual.
   - Optionally still load plan for display names/order.

### Open Questions

1. Should materialization also normalize `INTERRUPT_LISTENING` based on ASR choice (as dynamic default)? (Current logic varies by ASR.)
2. Should we emit an IPC event to the renderer to refresh automatically, or rely on user interactions to trigger re-fetch?

### Success Metrics

1. After any env/provider/deployment/asterisk change, `docker-compose.yml` and `environment.json` are updated within the debounce window.
2. Env Editor always shows actual resolved URLs without plan overlay.
3. No provider secrets in `environment.json`.
4. No event loops; writes are minimized when nothing changes.

### Test Plan

1. Unit tests for materialization: token resolution, merge rules, and guards.
2. Integration tests for reactive pipeline: simulate env upsert, provider key change, deployment type switch, asterisk config update.
3. Verify `docker-compose.yml` and `environment.json` changes only when inputs differ.
4. Verify secrets are absent from `environment.json`.
5. Renderer tests: editor reflects actual values after changes.
