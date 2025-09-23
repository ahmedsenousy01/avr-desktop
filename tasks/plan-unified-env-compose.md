## Unify Env Editor and Compose via a Single Planning Surface

### Goals

- One source of truth for "what services exist for this deployment" (names, order, variables).
- Env Editor UI always matches docker-compose results without bespoke mapping.
- Eliminate dead code and reduce renderer logic; move planning to main.
- Keep tests green with high confidence by targeting the planning surface.

### Current State (after recent changes)

- Introduced `compose:plan` IPC that returns `{ slug, services: [{ exampleServiceName, slugServiceName }] }`.
- `EnvEditor` prefers plan and falls back to `compose.generate`.
- `EnvEditor` still fetches registry and per-deployment env separately and computes provider presence in the renderer.
- Synthetic (empty) panels are rendered for compose services not present in the registry.

### Proposed Plan (Phased)

#### Phase 1 – Tighten the Plan Contract

- Extend plan response with optional details (no breaking changes):
  - `variablesMeta?: Record<exampleServiceName, { name: string; required: boolean; defaultValue?: string }[]>`
  - `values?: Record<exampleServiceName, Record<string, string>>` (current `DeploymentEnv` values)
  - `providerPresence?: Record<exampleServiceName, Record<providerId, boolean>>` (presence map only)
  - `displayName?: Record<exampleServiceName, string>` (precomputed `${slug}-suffix`)
- Source of truth for these comes from existing services:
  - `EnvRegistry` (variables meta)
  - `DeploymentEnv` (values)
  - `ProvidersStore` (presence)
  - `buildComposeObject` (service list/order)

Files:

- `src/shared/ipc.ts` – extend plan interfaces (optionals only)
- `src/main/ipc/compose.ts` – enrich plan using imports below
- `src/main/services/deployment-env-store.ts` – reuse `ensureDeploymentEnvSeeded`
- `src/main/services/env-registry.ts` – provide registry lookup by serviceName

#### Phase 2 – Renderer Slimdown

- Update `EnvEditor` to rely solely on `composePlan.plan` for:
  - Service list and display names
  - Variables meta and values (when provided)
  - Provider presence (when provided)
- Remove fallback to `compose.generate` entirely (no writes from UI).
- Remove `_validation` state and the `validatePresence` fetch (not used in UI badges; can be reintroduced later from plan if needed).
- Keep ability to operate when optional plan fields are absent (graceful degradation using current code paths).

Files:

- `src/renderer/components/env-editor.tsx` – drop fallback, drop `getDisplayName`, drop `validatePresence` call; use plan fields directly
- `src/renderer/components/env-service-panel.tsx` – consider extracting provider badges to a child component

#### Phase 3 – Tests and Dead Code Removal

- Adjust tests to assert against slugged headers and plan-driven rendering.
- Add unit tests for plan handler covering:
  - STS and modular deployments
  - Services not in registry (e.g., ElevenLabs TTS appears as synthetic)
  - Correct display names and service ordering
- Remove dead helpers in renderer if still present (`serviceOrderKey`, old filtering, etc.).

Files:

- `src/main/ipc/__tests__/compose.test.ts` – add `compose:plan` cases
- `src/renderer/components/__tests__/env-editor.test.tsx` – keep plan-first mocks

### Step-by-Step Tasks

1. Extend `ComposePlanResponse` with optional fields listed above.
2. Implement enrichment in `src/main/ipc/compose.ts`:
   - Read providers, registry, and deployment env
   - Build maps keyed by `exampleServiceName`
3. Refactor `EnvEditor`:
   - Replace registry/env fetches with plan usage when present
   - Remove `compose.generate` fallback
   - Remove `_validation` state and call
4. Extract `ProviderBadges` from `EnvServicePanel` (pure presentational component with `presence` props).
5. Update tests and add plan tests; ensure 100% pass.
6. Grep and remove dead helpers and imports in the renderer.

### Backward Compatibility

- All new plan fields are optional; the renderer should gracefully handle missing fields (current behavior is the fallback during the same session).

### Risks & Mitigations

- Risk: renderer and main diverge again if plan is under-specified.
  - Mitigation: keep plan as the only surface consumed by renderer; build regression tests comparing plan vs. compose-writer service names.
- Risk: performance on large registries
  - Mitigation: memoize registry maps; do minimal work per call; consider caching per deploymentId for session.

### Rollback Strategy

- Re-enable `compose.generate` fallback in `EnvEditor` behind a feature flag if plan endpoint regresses.

### Acceptance Criteria

- Env Editor renders exactly the services and order from `compose:plan`.
- No accidental file writes from Env Editor.
- Tests cover STS + modular service sets; compose and plan parity validated.
- No unused state/fetches remain in `EnvEditor`.

### Future Enhancements

- Plan could include a `warnings` array per service (e.g., missing required env) to power richer UI hints.
- Include port/volume info in plan to reuse plan for run panel previews.
