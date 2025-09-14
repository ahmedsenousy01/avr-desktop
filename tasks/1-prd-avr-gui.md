## AVR GUI Configuration and Deployment Tool — PRD

### Introduction / Overview

A desktop GUI application (Electron) that enables a non‑developer, single user to configure, compose, and deploy AVR voice agent stacks on Windows. The tool supports two stack types:

- Modular pipeline: Asterisk → VAD/ASR → Transcriber → LLM → TTS
- STS: Asterisk ↔ STS

The app manages provider API keys, Asterisk configuration, stack composition (via dropdowns), per‑deployment configuration persistence (JSON), on‑the‑fly Docker Compose generation, running/stopping deployments, surface logs and container health, preflight conflict checks, and a “Test call” capability.

### Goals

- Provide an easy, template‑driven and custom composition flow to build either modular or STS stacks using the providers available in `src/main/infra/examples`.
- Manage provider credentials and Asterisk settings in one place, persisted to JSON on the local device.
- Let users create named deployments, each with its own folder, JSON config, generated `docker-compose.yml`, and Asterisk config files.
- Run `docker compose up/down` from within the GUI and stream logs and status.
- Perform preflight checks for port/name conflicts and missing prerequisites.
- Offer a one‑click “Test call” to validate basic end‑to‑end operation.
- Windows support first; platform abstractions kept simple to enable later macOS/Linux support.

### User Stories

- As a non‑technical user, I can select a template stack (e.g., OpenAI, Anthropic, Google/Gemini, Deepgram, ElevenLabs, Vosk, Ultravox, OpenAI Realtime, n8n) and deploy it with minimal input.
- As a non‑technical user, I can compose a custom modular pipeline by picking providers for LLM, ASR/Transcriber, TTS (and VAD where applicable) using dropdowns.
- As a user, I can enter API keys for providers (OpenAI, Anthropic, Google/Gemini, Deepgram, ElevenLabs, etc.) once and reuse them across deployments.
- As a user, I can configure Asterisk basics (PJSIP, IPs, protocols, ports, dialplan essentials) without editing files manually.
- As a user, I can create multiple deployments, start/stop them, and view health and logs.
- As a user, I can run a Test call to verify that audio flows through Asterisk and the ASR/LLM/TTS chain, seeing basic outputs.

### Functional Requirements

1. Templates and Custom Composition
   1.1 The app must list built‑in templates mirroring the example compose files under `src/main/infra/examples`: - `docker-compose-openai.yml`, `docker-compose-anthropic.yml`, `docker-compose-google.yml`, `docker-compose-gemini.yml` - `docker-compose-deepgram.yml`, `docker-compose-vosk.yml`, `docker-compose-elevenlabs.yml` - `docker-compose-openai-realtime.yml`, `docker-compose-ultravox.yml` - `docker-compose-n8n.yml` (optional template for integrations)
   1.2 The app must support building a Modular pipeline via dropdowns for each stage: - LLM: OpenAI, Anthropic, Google/Gemini (from examples) - ASR/Transcriber: Deepgram, Google, Vosk (from examples) - TTS: ElevenLabs, Google (from examples) - VAD: If required by the chosen ASR path, expose an option or use sensible defaults
   1.3 The app must support building an STS stack by choosing an STS provider (e.g., OpenAI Realtime, Ultravox) via dropdown.
   1.4 The app must prevent invalid combinations (e.g., missing required counterpart services).

2. Provider Credentials and Settings
   2.1 The app must provide forms to capture provider credentials (e.g., OpenAI key, Anthropic key, Google credentials, Deepgram key, ElevenLabs key).
   2.2 Credentials must be stored locally in JSON (no encryption required for MVP), and referenced when generating Compose/ENV for services.
   2.3 The app should validate presence/format of keys where feasible (non‑blocking).

3. Asterisk Configuration Management
   3.1 The app must expose essential Asterisk PJSIP configuration and related settings, using `src/main/infra/asterisk/conf` as defaults/templates. - Files: `ari.conf`, `pjsip.conf`, `extensions.conf`, `manager.conf`, `queues.conf`
   3.2 Users must be able to set network parameters (external/internal IPs, ports), protocols (PJSIP), RTP port range, DTMF mode, codecs (opinionated defaults acceptable), and dialplan basics.
   3.3 On deployment creation or update, the app must write Asterisk config files into the deployment’s folder structure for mounting into the container.

4. Deployment Management
   4.1 Users must be able to create, duplicate, rename, and delete deployments.
   4.2 Each deployment must be represented by a JSON file (`deployment.json`) within its own folder and include selected providers, Asterisk settings, and runtime options.
   4.3 The app must generate a `docker-compose.yml` inside the deployment folder based on the chosen stack and providers.

5. Compose Generation and Runtime Control
   5.1 The app must construct `docker-compose.yml` dynamically from the deployment JSON and chosen template fragments.
   5.2 The app must run `docker compose up -d` and `docker compose down` from the GUI.
   5.3 The app must display per‑service status (up, exited, healthy/unhealthy if healthchecks exist) and aggregate deployment status.
   5.4 The app must stream logs for each service with filtering/search and basic tail controls.

6. Preflight Validation
   6.1 Detect if Docker Desktop/engine is available and reachable.
   6.2 Detect conflicting container names, networks, and ports (e.g., already in use by running containers or the host).
   6.3 Validate required provider keys are present for the selected stack.
   6.4 Optionally pull images ahead of time and surface pull progress/errors.

7. Test Call
   7.1 Provide a “Test call” action once a deployment is running.
   7.2 Minimum behavior: present dial instructions (PJSIP endpoint/SIP URI, port, credentials) and confirm inbound call reaches the dialplan and traverses the configured pipeline; show a basic transcript and synthesized response sample.
   7.3 Stretch: optionally originate a loopback or internal call via ARI/AMI to validate media flow without an external softphone.

8. Persistence and File Layout
   8.1 All data must be stored locally as JSON (no .env files): - Global provider credentials/settings JSON - Per‑deployment `deployment.json`
   8.2 Recommended per‑deployment folder structure (under a user‑chosen workspace root):

```
/deployments/
  [deployment-slug]/
    deployment.json
    docker-compose.yml
    asterisk/
      ari.conf
      pjsip.conf
      extensions.conf
      manager.conf
      queues.conf
    logs/
```

8.3 The app must allow selecting the workspace root folder on first run and changing it later.

9. Platform Scope (MVP)
   9.1 Windows (PowerShell) is required for MVP.
   9.2 Code should avoid OS‑specific assumptions to ease later macOS/Linux enablement.

10. Error Handling and Observability
    10.1 Surface actionable errors (e.g., missing keys, port conflicts, compose failures) with guidance.
    10.2 Offer a diagnostics panel with preflight results, recent compose commands, and environment checks.

### Non‑Goals (Out of Scope for MVP)

- Multi‑user or team features; shared remote state; RBAC.
- End‑to‑end encrypted secret storage or cloud secret vaults.
- Advanced dialplan visual editor; complex Asterisk provisioning flows.
- Remote orchestration across hosts/kubernetes; distributed deployments.
- Complex graph editor/drag‑and‑drop pipeline UI (dropdowns only for MVP).
- Metrics dashboards and long‑term analytics.

### Design Considerations (UI/UX)

- Navigation: left sidebar with sections: Providers & Keys, Stacks (Templates/Custom), Asterisk, Deployments, Run, Logs, Settings.
- Templates view: grid/list of example‑based templates; selecting a template prepopulates a new deployment.
- Custom stack composer: dropdowns to select providers for each stage; inline validation and compatibility hints.
- Asterisk editor: simple forms for PJSIP and key network/audio parameters; show advanced options behind an "Advanced" toggle.
- Deployments manager: list of deployments with status badges; actions: Start/Stop, Test call, View logs, Edit, Duplicate, Delete.
- Logs: multi‑pane logs (per service) with follow/tail toggle and search.
- Validation banners: preflight warnings/errors with quick‑fix navigation.

### Technical Considerations

- Storage
  - JSON for all persisted data (per requirement). No `.env` files; secrets stored in local JSON files.
- Compose Generation
  - Compose files are generated per deployment from JSON. Optionally reuse fragments modeled after files in `src/main/infra/examples`.
  - Inject provider keys as environment variables and mount Asterisk configs.
  - Apply consistent container name prefixes using the deployment slug to avoid collisions.
- Asterisk Config
  - Seed from `src/main/infra/asterisk/conf` and write into each deployment’s `asterisk/` folder; allow overrides from the GUI.
- Docker Integration (Windows MVP)
  - Invoke Docker CLI commands from the Electron main process; collect stdout/stderr; stream to the renderer for logs.
  - Health status derived from `docker ps`/`docker inspect` and compose healthchecks where available.
- Suggested Deployment JSON Schema (illustrative)

```
{
  "id": "uuid",
  "name": "My Deployment",
  "type": "modular" | "sts",
  "providers": {
    "llm": "openai" | "anthropic" | "gemini",
    "asr": "deepgram" | "google" | "vosk",
    "tts": "elevenlabs" | "google",
    "sts": "openai-realtime" | "ultravox"
  },
  "asterisk": {
    "externalIp": "",
    "sipPort": 5060,
    "rtpStart": 10000,
    "rtpEnd": 20000,
    "pjsip": { /* minimal editable fields */ }
  },
  "ports": { /* any service port mappings */ },
  "env": { /* provider keys and options resolved at runtime */ },
  "compose": { "version": "3.9", "serviceNames": {} },
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

- File Locations
  - Default workspace root chosen by user; all deployments live under `/deployments/` within that root.

### Success Metrics

- A user can create a modular stack and an STS stack from the GUI and deploy each in under 10 minutes without manual file edits.
- Preflight catches conflicts (ports/names) before starting containers in 95%+ of cases.
- Test call completes successfully on first attempt in 80%+ of trials for a properly configured environment.
- Logs and health are visible for all services within 5 seconds of starting.

### Open Questions

- Exact VAD handling: Do we expose a separate VAD provider choice, or rely on ASR defaults per example images?
- Healthchecks: Should we author healthchecks for services lacking them, or rely on status + logs only?
- Test call: Prefer ARI/AMI‑initiated loopback vs. external softphone for MVP?
- Default workspace location on Windows (e.g., Documents/AVR Deployments)?
- Any specific codec preferences for MVP (e.g., OPUS) or keep defaults?
- Should we include the `docker-compose-n8n.yml` template in MVP navigation, or add later?
