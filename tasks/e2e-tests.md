## End-to-End (E2E) Test Suite

This document describes how to set up and run E2E tests for the Electron app and enumerates comprehensive scenarios spanning PRD specs 1.1 through 1.7.

### Goals

- Verify full flows across renderer UI, preload bridges, IPC handlers, and main services.
- Exercise Docker Compose control, status/health, and logs behavior end-to-end.
- Provide an optional path to run against real Docker, and a default mocked path for fast, deterministic CI.

### Prerequisites

- Node.js 20+, pnpm 9+
- Electron build works locally: `pnpm start`
- Optional for “real Docker” runs: Docker Desktop installed and running

### Install E2E tooling

We use Playwright for Electron app automation and Vitest for the test runner familiarity.

```bash
pnpm add -D @playwright/test
pnpm dlx playwright install chromium
```

Notes:

- Chromium installation is recommended for any auxiliary browser contexts used in tests.
- We launch the Electron app with Playwright’s Electron mode.

### Directory layout

```
e2e/
  fixtures/
    providers.valid.json          # sample providers JSON for seeded credentials
    providers.missing.json        # sample with missing/empty keys
  helpers/
    electron.ts                   # launch helpers, app bootstrap, window getters
    docker-mock.ts                # test-time Docker mocks (module stubs)
  specs/
    1.1-providers-and-keys.e2e.ts
    1.2-templates-and-composer.e2e.ts
    1.3-asterisk-config-editor.e2e.ts
    1.4-preflight-and-conflicts.e2e.ts
    1.5-compose-generation-and-control.e2e.ts
    1.6-logs-and-health.e2e.ts
    1.7-test-call.e2e.ts
playwright.config.ts
```

You can colocate under `src/` if preferred; keep it outside unit-test globs configured in `vitest.config.ts`.

### Launching Electron under Playwright

Minimal `e2e/helpers/electron.ts`:

```ts
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';

export async function launchApp(extraEnv: Record<string, string> = {}): Promise<{ app: ElectronApplication; page: Page }>{
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, ...extraEnv },
  });
  const page = await app.firstWindow();
  return { app, page };
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close();
}
```

### Mocked vs Real Docker

- Mocked mode (default): tests stub Docker CLI interactions at the module boundary to keep runs fast and hermetic. Use Playwright’s `app.evaluate` to inject stubs or load a custom preload that replaces `window.compose`/`window.preflight` calls where appropriate.
- Real Docker mode (optional): runs `compose:generate/up/down/status/logs` against a real daemon. Prefer running this locally or in gated CI jobs due to environment variability.

Recommended approach for mocking:

- Stub `@main/services/docker-cli` methods in the main process by preloading a tiny patch before app boot (e.g., via an environment toggle that your tests check to `vi.mock` the module). Alternatively, for UI-focused E2E, replace `window.compose` and `window.preflight` in the renderer by assigning test doubles before interactions.

Important: The app uses JSON-based provider storage; avoid `.env`-style configuration.

### Running E2E tests

Add a Playwright config (example):

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e/specs',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
});
```

Common scripts:

```bash
pnpm exec playwright test                        # run all E2E (mocked docker recommended)
pnpm exec playwright test e2e/specs/1.5-*.ts     # run a subset
```

### Data seeding and cleanup

- Providers: seed credentials via the UI (Providers page) or directly mock the `window.providers` bridge in tests to call `save`.
- Deployments: create from Templates page or via IPC through renderer bridges.
- Cleanup: ensure `compose:down` runs and no processes remain; for mocked mode this is a no-op.

---

## E2E Scenarios by Spec

Below scenarios are structured as high-level flows; implement with Playwright steps using stable queries and bridge calls from `src/renderer/lib/api.ts`.

### 1.1 Providers and Keys

- Save and persist keys
  - Open Providers, enter valid keys for OpenAI/Anthropic/Gemini/Deepgram/ElevenLabs.
  - Save; reload app; keys persist and Preflight “Provider API Keys” passes for required providers.

- Missing/invalid keys
  - Clear one required key; Preflight shows fail with remediation; Start is disabled or shows tooltip until fixed.

### 1.2 Templates and Composer

- Create from template
  - Choose template (e.g., Google modular or OpenAI Realtime STS) → Create.
  - Deployment appears in list with correct type and timestamp.

- Duplicate and rename
  - Duplicate deployment, rename it, verify updates and idempotency across reload.

### 1.3 Asterisk Config Editor

- Edit and validate RTP range
  - Set `rtpStart >= rtpEnd` → inline validation shows error; Preflight reflects fail.
  - Fix values; validation passes; Preflight turns to pass.

- Preview render
  - Trigger preview; confirm output lists expected files (pjsip.conf, extensions.conf, etc.).

### 1.4 Preflight and Conflicts

- Provider keys check
  - With keys present, Preflight shows pass; with missing, shows fail with remediation.

- Docker name collisions
  - Start a conflicting container/network/volume with the deployment slug prefix; Preflight detects and reports collisions.

- Host port availability
  - Occupy SIP port or a sample in RTP range; Preflight shows fail/warn accordingly.

#### Remediation & Auto-fix (Preflight)

- Docker unavailable (retry)
  - With Docker daemon stopped, run Preflight.
  - Expect failure item "Docker is not available" plus remediation with "Retry Preflight".
  - Start Docker, click Retry Preflight, expect pass item "Docker is available".

- Docker port mapping conflicts (auto-fix)
  - Create a running container mapping the planned SIP port or a port in the RTP range.
  - Run Preflight; expect failure item with list of conflicts, suggested SIP/RTP values, and buttons.
  - Click "Auto-fix"; verify Preflight re-runs and shows "No Docker port mapping conflicts".
  - Optionally navigate via "Change ports in Asterisk settings" and verify new values are persisted.

- Docker name collisions (cleanup)
  - Create Docker resources (container/network/volume) with the deployment slug prefix.
  - Run Preflight; expect collisions item listing the resources and a cleanup button.
  - Click "Clean up matching Docker resources"; verify Preflight re-runs and shows no collisions.

- Host port in use (guidance)
  - Bind a local process on SIP or a sampled RTP port.
  - Run Preflight; expect remediation panel with PowerShell guidance to identify the owning process.
  - Stop the process or adjust ports; re-run Preflight to see passes/warns cleared.

- Provider API keys missing (navigation)
  - Ensure a required provider key is empty; run Preflight.
  - Expect failure item with "Open Providers settings"; click and add the key.
  - Re-run Preflight; item should pass.

### 1.5 Compose Generation and Control

- Deterministic compose
  - Generate → record `docker-compose.yml`; re-generate → unchanged. Service names prefixed with slug; environment injected only where required.

- Start/Stop lifecycle
  - Start brings up services; Start again is idempotent; Stop shuts down; Stop again is safe.

- Error mapping
  - With Docker daemon down, Start/Logs show friendly error banner with remediation.

### 1.6 Logs and Health

- Status/health polling
  - While running, status table updates without manual refresh; health from `inspect` maps to badges.

- Logs viewer UX
  - Follow logs streams lines; Auto-scroll toggle; text filter narrows lines; Stop logs releases subscription.

### 1.7 Test Call

- Successful call
  - Start stack; verify SIP registration; place a test call (softphone or simulated). Hear prompt/greeting; hang up cleanly.

- DTMF routing
  - Press digits; IVR routes and prompts change accordingly.

- STS path (where applicable)
  - For STS deployments, confirm ASR/LLM/TTS interplay: live transcriptions observed and responses synthesized with acceptable latency.

- Failure and recovery
  - Simulate network or device issues (mic/output). UI surfaces clear messages; call initiation blocks appropriately; recovery path is verified.

---

## CI considerations

- Default to mocked Docker mode for determinism and speed.
- Gated “real Docker” job (nightly or manual) for Start/Stop/Logs/Status paths.
- Record videos/screenshots on failure via Playwright config; keep logs artifacts.

## Tips to reduce flakiness

- Prefer role- and label-based selectors; avoid brittle text assumptions where logs vary.
- Use explicit waits on UI state changes (status badges, rollups, banners) rather than arbitrary timeouts.
- Scope queries to regions (e.g., within status table) to avoid duplicate matches.
