## PRD: Environment Editor and Service Env Mapping

### Introduction / Overview

Build a robust, visual Environment Editor for per-deployment service variables, backed by a canonical env mapping derived from the Docker Compose examples in `src/main/infra/examples`. The editor should show each service grouped with its environment variables, initialize recommended defaults for new deployments, validate presence-only for required variables, and reflect the actual env used when generating Compose. A single JSON file per deployment will store the effective env. The examples folder provides the baseline template for each service; users can freely add/override/remove variables beyond the baseline.

### Goals

- Provide a visual, grouped editor by service for environment variables.
- Derive initial env templates from the Compose examples and auto-generate recommended defaults on deployment creation.
- Validate presence-only for required variables and warn when baseline variables are missing.
- Ensure the editor reflects the actual env used by Compose generation.
- Support a single JSON profile per deployment; users can add/override/remove variables freely.
- Avoid .env usage and favor JSON-based storage for profiles.

### User Stories

- As a user, I can create a deployment and have a default recommended env generated from examples per service.
- As a user, I can view and edit env variables grouped by service, with values masked by default and a global "reveal all" option.
- As a user, I am warned when required baseline variables are missing for any service.
- As a user, I can add arbitrary variables to any service, beyond the baseline template.
- As a user, I can see that the editor’s env matches what Compose will run with.

### Functional Requirements

1. Canonical Env Registry
   1. Build a registry derived from `src/main/infra/examples/*.yml`, producing per-service env templates (name, description if derivable, required flag where determinable, default if present).
   2. The registry must be versionable and extensible; it acts as the starting template for new deployments.
   3. Where multiple examples define the same service differently, do not auto-resolve; leave open questions and default to union of keys with undefined defaults.

2. Deployment Env Storage
   1. Maintain exactly one JSON env file per deployment capturing effective variables per service.
   2. On deployment creation, pre-populate this file from the registry’s recommended defaults per service.
   3. Users can add/override/remove variables for any service. These user changes persist only in the deployment JSON.

3. Validation (Presence-Only)
   1. For each service, if a baseline variable is marked required, warn when its value is empty or missing.
   2. No regex or cross-field validations in v1.

4. Masking and Security
   1. All variables are masked in the UI by default, with a global "reveal all" toggle.
   2. No encryption at rest in v1.

5. UI/UX
   1. Provide a page or panel that groups vars by service with search/filter.
   2. Show status badges per service (e.g., OK, Missing N vars).
   3. Allow inline add/remove/edit of variables. Non-baseline variables are clearly labeled as "custom".
   4. Show a diff badge between baseline and current (added/removed/missing) at the service level.
   5. Provide actions: "Reset to baseline defaults" per service and for the whole deployment.

6. Integration
   1. Compose generation must consume the effective env from the deployment JSON, ensuring WYSIWYG between editor and runtime.
   2. Provide IPC endpoints (main ↔ renderer) for reading/writing/validating deployment env and for retrieving the registry.

7. Provider Keys
   1. Provider key(s) are injected by the system without duplicating them in deployment env JSON, yet the editor should surface their presence/read-only source for clarity.
   2. Missing provider key(s) should surface as warnings in the UI when a service depends on them.

### Non-Goals (Out of Scope)

- No remote sync or third-party secrets management in v1.
- No encryption-at-rest or KMS integration.
- No schema inference from arbitrary user-provided Compose files beyond the curated examples.
- No advanced validation (regex, cross-field, conditional logic) in v1.

### Design Considerations

- Group by service with expandable panels; indicate missing required variables prominently.
- Mask all variables by default; include a global reveal-all.
- Provide a read-only sidebar or header that depicts the active deployment and quick navigation between services.
- Keep baseline vs effective env differences visible via badges and counts.

### Technical Considerations

- Registry Generation
  - Parse `src/main/infra/examples/*.yml` to collect services and their env keys. If defaults are present in examples, record them. When multiple examples conflict, record a union of keys and leave defaults undefined for conflicting keys (see Open Questions).
  - Persist the generated registry as a TypeScript constant or JSON artifact that is source-controlled for determinism.

- Types (illustrative; finalized in implementation)
  - `EnvVariableMeta`: `{ name: string; required: boolean; defaultValue?: string | number | boolean; description?: string; }`
  - `ServiceEnvTemplate`: `{ serviceName: string; variables: EnvVariableMeta[]; dependsOnProviders?: string[]; }`
  - `EnvRegistry`: `{ services: ServiceEnvTemplate[]; version: string; source: 'examples'; }`
  - `DeploymentEnv`: `{ deploymentId: string; services: Record<string, Record<string, string>> }`

- Services (modules)
  - Env Registry Service (main): generate/load the registry from examples; expose read-only fetch to renderer.
  - Deployment Env Store (main): CRUD on deployment JSON; merge with registry for diff/validation; expose via IPC.
  - Compose Writer Integration: source env from Deployment Env Store to guarantee parity with runtime.

- IPC API (examples)
  - `envRegistry:get()` → returns `EnvRegistry`
  - `deploymentEnv:get(deploymentId)` → returns `DeploymentEnv`
  - `deploymentEnv:upsert(deploymentId, payload)` → writes merged changes
  - `deploymentEnv:validate(deploymentId)` → returns missing required vars by service

- Renderer UI
  - Env Editor page/component per deployment pulling from the store via IPC.
  - Service panels with editable key/value pairs, badges for missing, and controls to add/remove.
  - Provider key presence surfaced as read-only indicators when applicable.

- Storage
  - One JSON file per deployment under the existing deployments data directory (same convention as other per-deployment stores). No `.env` files.

### Success Metrics

- 100% of required baseline variables present prior to run for selected deployment.
- Time to configure a new provider-backed service from defaults to runnable under 5 minutes.
- Zero mismatches between editor env and compose runtime env across smoke tests.

### Acceptance Criteria

- Creating a deployment generates a default env JSON seeded from the registry templates.
- The editor displays services and their baseline variables; missing required variables render warnings.
- Variables can be added/edited/removed; custom variables are clearly labeled.
- All variables are masked by default with a global reveal-all control.
- Compose generation uses the deployment JSON so that runtime matches editor values.
- IPC endpoints exist for fetching registry, reading/writing deployment env, and validating presence-only requirements.
- Provider keys are injected by the system and surfaced read-only in the UI; missing keys produce warnings when relevant.

### Open Questions

- Example Conflicts: When multiple examples define the same service with differing env keys/defaults, should we:
  - Prefer a specific example as authoritative per provider, or
  - Maintain a union and mark ambiguous variables as optional without defaults?
- Naming Conventions: Preferred names for types (e.g., `EnvRegistry`, `DeploymentEnvStore`), IPC channels, and UI components?
- Provider Dependencies: Formal list of which services depend on provider keys (OpenAI, Anthropic, etc.) for system-injected behavior.

### Appendix: Scope Confirmation

- In-scope examples: all `src/main/infra/examples/*.yml` in v1.
- Validation: presence-only.
- Storage: one JSON per deployment; users can freely add/override/remove vars.
- No remote sync or third-party integrations in v1.
