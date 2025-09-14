## Relevant Files

- `src/shared/types/providers.ts` - TS types, defaults, and runtime validators for providers config.
- `src/main/services/providers-store.ts` - Read/write `workspace/providers.json` with atomic writes and validation.
- `src/main/services/workspace-root.ts` - Resolve workspace root path used for persistence.
- `src/main/ipc/providers.ts` - IPC handlers for `providers:list|get|save|test`.
- `src/shared/ipc.ts` - Channel name constants and request/response types for providers IPC.
- `src/preload.ts` - Context bridge exposing `window.providers` typed API.
- `src/renderer/lib/api.ts` - Renderer wrappers for providers API.
- `src/renderer/pages/ProvidersPage.tsx` - Page to list/edit provider credentials.
- `src/renderer/components/ProviderForm.tsx` - Form for editing a single provider (masked inputs, copy, test).
- `src/renderer/styles/globals.css` - Minor styles for forms and status indicators.
- `src/shared/types/__tests__/providers.test.ts` - Unit tests for validators and defaults.
- `src/main/services/__tests__/providers-store.test.ts` - Unit tests for persistence logic (temp dir).
- `src/main/ipc/providers.test.ts` - Unit tests for IPC handlers (mock store).
- `src/renderer/components/ProviderForm.test.tsx` - Component tests for form behavior.

### Notes

- Place tests alongside the files they cover; pick your runner (Vitest recommended with Vite) and scripts.
- Secrets live only in JSON on disk; never log raw keys; mask values in UI by default.
- `providers:test` should be non-blocking and optional; for MVP, presence/format checks are sufficient.
- Workspace root selection/management may be handled elsewhere; this module should consume it via a service.

## Tasks

- [ ] 1.0 Define providers schema and TypeScript types
  - [x] 1.1 Create `src/shared/types/providers.ts` with `Providers` and `ProviderId` types and `createDefaultProviders()`.
  - [x] 1.2 Implement runtime validator `isValidProvidersShape(input): input is Providers` with detailed error messages.
  - [x] 1.3 Add helper `mergeProviders(base, partial)` to deep-merge partial updates safely.
  - [x] 1.4 Add minimal unit tests for defaults and validators.
- [ ] 2.0 Implement persistence layer for `workspace/providers.json` (workspace root resolution, file I/O safeguards)
  - [x] 2.1 Add `src/main/services/workspace-root.ts` with `getWorkspaceRoot()` consumed by this module.
  - [x] 2.2 Implement `src/main/services/providers-store.ts` with `getProvidersFilePath()` using workspace root.
  - [x] 2.3 Implement `readProviders()` → returns defaults on missing file; validates shape and backs up invalid files.
  - [x] 2.4 Implement `saveProviders(partial)` → merge, validate, and write atomically; ensure directories exist.
  - [x] 2.5 Serialize concurrent writes (simple in-process queue/lock) to prevent corruption.
  - [x] 2.6 Add unit tests using a temporary directory.
- [ ] 3.0 Add IPC handlers: `providers:list`, `providers:get`, `providers:save`, `providers:test` with validation
  - [x] 3.1 Define channels and types in `src/shared/ipc.ts` for providers requests/responses.
  - [x] 3.2 Implement `src/main/ipc/providers.ts` to register handlers; validate inputs and map to store.
  - [x] 3.3 Implement `providers:test` as non-blocking presence/format check; return `{ ok, message }`.
  - [x] 3.4 Register providers IPC from app startup alongside existing handlers.
  - [x] 3.5 Unit tests for IPC with mocked store.
- [ ] 4.0 Build renderer UI: `ProvidersPage` and `ProviderForm` (masked inputs, reveal/copy, test action)
  - [ ] 4.1 Add a sidebar/nav entry to open Providers page.
  - [x] 4.1 Add a sidebar/nav entry to open Providers page.
  - [x] 4.2 Create `ProvidersPage` to list providers with edit buttons and key status.
  - [x] 4.3 Implement `ProviderForm` with masked inputs, reveal toggle, copy-to-clipboard, and Test button.
  - [x] 4.4 Wire load-on-mount via `providers.list()` and save via `providers.save()` with optimistic UI.
  - [x] 4.5 Client-side presence/format validation and inline error messages; disable Save until changed.
  - [x] 4.6 Add basic accessibility (labels, focus order, keyboard) and form styles.
  - [x] 4.7 Show success/error toasts and inline statuses for `providers:test` results.
  - [ ] 4.8 Component tests if a test runner is configured.
- [ ] 5.0 Expose typed renderer API and integrate read access for compose/templates
  - [x] 5.1 Extend `src/preload.ts` to expose `window.providers.{list,get,save,test}` with types.
  - [x] 5.2 Add typed wrappers in `src/renderer/lib/api.ts` for renderer usage.
  - [ ] 5.3 Replace any direct IPC usages with the typed API wrappers in the renderer.
  - [ ] 5.4 Provide a helper to retrieve provider values for compose generation/templates consumption.
  - [ ] 5.5 Perform a manual smoke test: save values, re-open app, and verify persistence & retrieval.
