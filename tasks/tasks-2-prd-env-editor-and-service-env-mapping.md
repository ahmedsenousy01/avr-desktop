## Relevant Files

- `src/main/services/env-registry.ts` - Static Env Registry baseline derived from examples (no runtime parsing).
- `src/main/services/deployment-env-store.ts` - Per-deployment JSON env read/write/validate; seed from registry.
- `src/main/services/compose-writer.ts` - Ensure compose generation uses DeploymentEnv values.
- `src/main/ipc/env.ts` - IPC channels for registry and deployment env CRUD/validation.
- `src/renderer/lib/api.ts` - Client helpers to call env IPC endpoints.
- `src/renderer/components/env-editor.tsx` - Main editor UI; grouped by service; mask by default; reveal-all.
- `src/renderer/components/env-service-panel.tsx` - Per-service panel with status badges and diff indicators.
- `src/renderer/pages/environment-page.tsx` - Page wiring and navigation to the editor (extend existing page).
- `src/shared/types/env.ts` - TS types and schema for `DeploymentEnv` storage and IPC contracts.
- `src/main/services/__tests__/env-registry.test.ts` - Unit tests for registry derivation from examples.
- `src/main/services/__tests__/deployment-env-store.test.ts` - Tests for JSON storage, seeding, CRUD, validation, interpolation.
- `src/main/ipc/__tests__/env.test.ts` - IPC handler registration test with mocks.
- `src/renderer/components/__tests__/env-editor.test.tsx` - UI behavior (masking, reveal-all, warnings).
- `src/main/services/__tests__/compose-writer-env-integration.test.ts` - Compose uses DeploymentEnv.

### Notes

- All variables are masked by default in UI with a global reveal-all; no per-field secret flag in v1.
- One JSON file per deployment; presence-only validation; provider keys injected by system and surfaced read-only.

## Tasks

- [x] 1.0 Implement Env Registry derivation from `src/main/infra/examples/*.yml` (deterministic, versioned)
  - [x] 1.1 Parse all example compose files and collect per-service `environment` keys
  - [x] 1.2 Normalize service names and deduplicate env var names across files
  - [x] 1.3 Extract defaults where present; mark required when default missing
  - [x] 1.4 Produce `EnvRegistry` structure and persist as a versioned artifact
  - [x] 1.5 Add unit tests covering multiple examples, unions, and conflict handling

- [x] 2.0 Implement per-deployment Env Store (seed on creation, CRUD, presence validation)
  - [x] 2.1 Define storage path/convention and JSON schema for `DeploymentEnv`
  - [x] 2.2 Implement create/seed from `EnvRegistry` with recommended defaults
  - [x] 2.3 Implement read/update with support for add/remove custom vars
  - [x] 2.4 Implement presence-only validation against `EnvRegistry`
  - [x] 2.5 Add unit tests for seeding, CRUD, and validation
  - [x] 2.6 Implement service-name template interpolation for intra-stack URLs (e.g., `http://{{service:avr-ami}}:6006`) during seeding and compose write

- [x] 3.0 Add IPC API for Env Registry and Deployment Env (get/upsert/validate)
  - [x] 3.1 Define IPC channels and request/response types in `src/shared/types/env.ts`
  - [x] 3.2 Implement handlers in `src/main/ipc/env.ts`
  - [x] 3.3 Implement client helpers in `src/renderer/lib/api.ts`
  - [x] 3.4 Add IPC contract tests

- [x] 4.0 Build Env Editor UI (group by service, masking, reveal-all, warnings, custom vars)
  - [x] 4.1 Create `env-editor.tsx` and wire to environment page
  - [x] 4.2 Implement per-service panels listing key/value pairs
  - [x] 4.3 Mask all values by default; add global reveal-all toggle
  - [x] 4.4 Show service status badges (OK / Missing N)
  - [x] 4.5 Indicate baseline vs current diffs (added/removed/missing)
  - [x] 4.6 Support add/remove/edit of variables; label custom vars
  - [x] 4.7 Add tests for masking, reveal-all, warnings, and CRUD UX

- [x] 5.0 Integrate Compose generation with DeploymentEnv (runtime parity with editor)
  - [x] 5.1 Update compose writer to source environment from `DeploymentEnv`
  - [x] 5.2 Add integration tests ensuring runtime env equals editor values

- [x] 6.0 Surface provider key injection/read-only state and related warnings in UI
  - [x] 6.1 Indicate when provider keys are present/missing without exposing values
  - [x] 6.2 Show warnings on dependent services when keys are missing
  - [x] 6.3 Add tests for provider key indicators and warnings
