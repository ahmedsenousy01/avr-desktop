## Relevant Files

- `src/shared/types/providers.ts` - Provider enums and shared types for selection/validation.
- `src/shared/types/__tests__/providers.test.ts` - Unit tests for provider enums and validation helpers.
- `src/shared/types/deployments.ts` - Deployment schema/types shared by main and renderer (new).
- `src/shared/types/__tests__/deployments.test.ts` - Unit tests for `deployments.ts` (new).
- `src/shared/ipc.ts` - Define `deployments:*` channel names to use across app (extend).
- `src/shared/types/validation.ts` - Selection types and helpers for modular/STS validation (new).
- `src/shared/types/__tests__/validation.test.ts` - Unit tests for selection helpers (new).

- `src/main/infra/examples/` - Example compose files used to derive built‑in templates.
- `src/main/services/template-registry.ts` - Template registry mapping IDs to metadata and defaults (new).
- `src/main/services/__tests__/template-registry.test.ts` - Tests for template registry (new).

- `src/main/services/deployments-store.ts` - Filesystem CRUD for deployments (new).
- `src/main/services/__tests__/deployments-store.test.ts` - Tests for deployments store (new).
- `src/main/ipc/deployments.ts` - IPC handlers: create/list/update/duplicate/delete (new).
- `src/main/ipc/__tests__/deployments.test.ts` - Tests for deployments IPC (new).
- `src/main/ipc.ts` - Register `deployments:*` channels (extend).
- `src/main/services/workspace-root.ts` - Workspace root resolution used by deployments store.

- `src/renderer/lib/api.ts` - Client wrappers for `deployments:*` IPC (extend).
- `src/renderer/components/templates-grid.tsx` - Grid of example templates with create actions (new).
- `src/renderer/components/__tests__/templates-grid.test.tsx` - Tests for templates grid (new).
- `src/renderer/components/composer-form.tsx` - Modular/STS composer with validation (new).
- `src/renderer/components/__tests__/composer-form.test.tsx` - Tests for composer form (new).
- `src/renderer/pages/templates-page.tsx` - Page that hosts `TemplatesGrid` (new).
- `src/renderer/pages/deployments-page.tsx` - List of deployments with actions (new).
- `src/renderer/App.tsx` - Add navigation/routes for Templates, Composer, Deployments (extend).

### Notes

- Unit tests live alongside code, executed with Vitest. Run: `npx vitest` or `pnpm test`.
- Persist all data to JSON; do not use `.env` files.
- Keep Windows compatibility in mind; shell commands will run via PowerShell.

## Tasks

- [x] 1.0 Establish provider enums and selection validation
  - [x] 1.1 Define provider IDs and display labels in `src/shared/types/providers.ts`
  - [x] 1.2 Add `isValidModularSelection` and `isValidStsSelection` helpers (new `src/shared/types/validation.ts`)
  - [x] 1.3 Implement a compatibility matrix to prevent invalid mixes (e.g., missing roles)
  - [x] 1.4 Unit tests for enums and validation helpers
- [x] 2.0 Create template registry from example compose files
  - [x] 2.1 Implement `template-registry.ts` with template metadata derived from `src/main/infra/examples`
  - [x] 2.2 Provide `templateToDeployment` to generate a default `Deployment` skeleton
  - [x] 2.3 Add display data (name, summary, badges) for UI
  - [x] 2.4 Unit tests for registry mapping and `templateToDeployment`
- [x] 3.0 Implement TemplatesGrid UI and template selection flow
  - [x] 3.1 Create `TemplatesGrid` listing templates with Create action
  - [x] 3.2 Extend `src/renderer/lib/api.ts` with `deploymentsCreateFromTemplate(templateId, name?)`
  - [x] 3.3 Add `templates-page.tsx` route and nav entry in `App.tsx`
  - [x] 3.4 Show success/error toasts; navigate to Deployments on success
  - [x] 3.5 Component tests: renders, filters, click creates (assert IPC call)
- [x] 4.0 Implement ComposerForm UI for modular/STS with compatibility checks
  - [x] 4.1 Create `ComposerForm` with dropdowns for LLM, ASR, TTS or STS
  - [x] 4.2 Wire validation to disable invalid combos and show inline hints
  - [x] 4.3 Add `deploymentsCreateFromSelection(selection, name?)` in `api.ts`
  - [x] 4.4 Page route for Composer; link from nav
  - [x] 4.5 Component tests for validation and create flow
- [x] 5.0 Add IPC + filesystem to create deployment and write deployment.json
  - [x] 5.1 Add `Deployment` types in `src/shared/types/deployments.ts`
  - [x] 5.2 Implement `deployments:create` handler in `src/main/ipc/deployments.ts`
  - [x] 5.3 Implement `deployments-store.ts` to ensure folder, id/slug, timestamps, JSON write
  - [x] 5.4 Integrate `workspace-root.ts` to resolve the deployments root
  - [x] 5.5 Unit tests for store and IPC (temp dir, JSON structure)
- [x] 6.0 Implement deployments list/update/duplicate/delete flows (IPC + renderer)
  - [x] 6.1 Implement `deployments:list`, `deployments:update`, `deployments:duplicate`, `deployments:delete` in main
  - [x] 6.2 Add `DeploymentsPage` with list view, actions, and rename dialog
  - [x] 6.3 Extend `api.ts` for list/update/duplicate/delete
  - [x] 6.4 Tests for IPC and UI list/actions
