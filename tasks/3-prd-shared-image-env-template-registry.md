## Shared Image, Env, and Template Registry (Single Source of Truth)

### Introduction / Overview

We will introduce a typesafe, centralized registry that defines, in one place, all supported runtime images, their Docker image names, roles, default environment variables, env schemas, default ports/volumes, and the set of valid templates that can be composed from those images. This becomes the single source of truth for the application’s deployment composition logic and UI configuration. The compose generator and UI will consume this registry to produce consistent, validated outputs.

Source of truth for defaults, schemas, and available images/templates will be derived from the reference compose examples in `src/main/infra/examples/` (hereafter “@examples/”).

### Goals

1. Centralize image metadata (Docker image name, role, defaults, env schema) in `src/shared/registry/`.
2. Ensure templates can only be built from available images, with compile-time type safety.
3. Ensure each image carries its default env/ports/volumes as defined in @examples/.
4. Compose generation reads entirely from this registry and merges provider keys and user overrides deterministically.
5. UI Env Editor renders fields based on image env schemas; templates indicate functional/non-functional status based on available images.
6. Backward-incompatible pieces (legacy fragment maps) are replaced wholesale (“go all in”).

### User Stories

- As a developer, I have one place to add a new image and its env schema, and everything else (templates, compose) updates automatically with strong typing.
- As a user, when I pick a template, it only uses supported images and exposes the correct env fields in the editor.
- As a tester, I can validate that each template and image generates a correct compose file using the registry’s defaults and schemas.

### Functional Requirements

1. Registry Modules
   1. Create `src/shared/registry/roles.ts` defining logical roles: `core | asterisk | ami | asr | tts | llm | sts`.
   2. Create `src/shared/registry/images.ts` exporting a `const IMAGES` map and associated types:
      - Keyed by a stable `ImageKey` (e.g., `"asr/avr-asr-deepgram"`).
      - Each entry includes: `role`, `dockerImage`, `defaultEnv`, `envSchema`, `defaultPorts`, `defaultVolumes`, and for STS, `wsPort`.
      - Populate using @examples/ as the authoritative reference. Include all images present in @examples/:
        - Core/Infra: `agentvoiceresponse/avr-core`, `agentvoiceresponse/avr-asterisk`, `agentvoiceresponse/avr-ami`.
        - ASR: deepgram, google-cloud-speech, vosk.
        - TTS: google-cloud-tts.
        - LLM: openai, anthropic, openrouter, n8n.
        - STS: openai, deepgram, ultravox, gemini, elevenlabs.
        - Exclude images not present in @examples/ (e.g., modular `tts-elevenlabs`).
   3. Create `src/shared/registry/providers-to-images.ts` mapping provider selections to image keys by role with role-filtered type constraints.
   4. Create `src/shared/registry/templates.ts` exporting `TEMPLATES` with template ids and their constituent image keys (by role). Mark templates as functional only when all referenced images exist in `IMAGES`. Rename current ElevenLabs template to STS-only (`elevenlabs-sts`).

2. Compose Generator Integration
   1. `compose-writer.ts` must source image name, defaults, ports, volumes from `IMAGES` instead of local constants.
   2. For modular deployments, map `asr/tts/llm` to image keys using `PROVIDER_TO_IMAGE`. For STS, map `sts` to image key similarly.
   3. Apply image defaults in order: `defaultEnv` -> provider API keys (if applicable) -> per-deployment env overrides. Maintain existing STS-vs-modular core env shaping.
   4. For STS, compute `STS_URL` via selected STS image’s `wsPort`. For modular, ensure `ASR_URL`, `LLM_URL`, `TTS_URL` remain and `STS_URL` is omitted.
   5. Retain dynamic Asterisk port mapping logic and deterministic YAML rendering.

3. Env Registry and Env Editor
   1. Replace hardcoded env schemas in `env-registry.ts` with schemas derived from `IMAGES` per selected images. Core service schema may be defined in the `IMAGES` entry for core.
   2. `deployment-env-store.ts` seeds per-service env using `defaultEnv` from selected images and computes any cross-service values (e.g., STS URL).
   3. Env Editor reads env schemas from the selected images to drive field rendering/order (order can be stable by the schema array order).

4. Templates & Metadata
   1. `template-registry.ts` becomes a thin UI metadata layer (displayName, summary, badges, exampleCompose path for reference) and must reference `TEMPLATES` for composition. Functional status should be derived from images’ existence.
   2. Rename “ElevenLabs” to “ElevenLabs (STS)” with id `elevenlabs-sts`; mark as functional because `sts/avr-sts-elevenlabs` is present in @examples/.
   3. Keep `llm-openrouter` for Gemini LLM scenarios as per confirmation.

5. Type Safety Guarantees
   1. Role-filtered image keys: `KeysByRole<R>` conditional type yields only image keys with role `R`.
   2. `PROVIDER_TO_IMAGE` and `TEMPLATES` must use role-filtered keys; removal/rename of images in `IMAGES` causes compile-time errors.
   3. Compose generator consumes these types so invalid role/image usage fails at build time.

6. Back-Compat & Migration
   1. Replace legacy constants (`FRAGMENT_IMAGE`, `DEFAULTS_BY_FRAGMENT`, fragment mappers) entirely.
   2. Existing deployments are not auto-migrated; new logic applies to new deployments only. Existing remain readable; new registry drives creation going forward.
   3. Mark any template that references a non-existent image as not functional until implemented (hard typed as optional with a `functional: false`).

7. Validation & Provider Keys
   1. Continue using existing provider validation endpoints; injection occurs only when an image’s schema expects a provider key.
   2. No `.env` files; persist only in JSON store.

### Non-Goals (Out of Scope)

1. Implementing new images not present in @examples/ (e.g., modular ElevenLabs TTS).
2. Changing provider validation logic or adding new endpoints.
3. Auto-migration of existing deployment files.

### Design Considerations

- The registry must exactly mirror @examples/ for defaults and env schemas. Divergence is forbidden.
- Image keys should be stable, readable, and role-qualified (e.g., `sts/avr-sts-openai`).
- Deterministic generation: key sorting and stable arrays for repeatable YAML output.

### Technical Considerations

- Strong typing via `as const` registries, `keyof typeof`, and conditional role-filtering types.
- Compose generator must not silently fallback when an image is missing; it should produce a compile-time or explicit runtime error depending on context.
- STS `wsPort` is defined on the image spec and used to populate `STS_URL` in core.

### Runtime Env Lifecycle and Visibility (Clarifications)

- Env seeding timing and storage
  - On first access for a deployment, the system seeds an `environment.json` under `deployments/<slug>/environment.json` using registry defaults and dynamic values derived from the deployment selection (type/providers). Subsequent reads use this persisted file.
- Service-name templating and resolution
  - Seeded defaults can include `{{service:avr-...}}` tokens (derived from @examples/ service names). At compose time, these are resolved to the actual slugged service names to form working `ASR_URL/LLM_URL/TTS_URL` or `STS_URL`.
- Provider keys injection and editor visibility
  - Provider API keys are stored in the providers store and injected into service environments at compose generation time (based on the selected images/roles). Keys are not persisted into `environment.json` by default. The Env Editor shows values from `environment.json` and indicates provider key presence separately; it does not display provider secrets unless explicitly added by the user.
- Centralization with the new registry
  - After this change, the seed source for defaults and schemas is the shared image registry. Dynamic URL computation (including STS websocket ports) also derives from image specs, ensuring a single source of truth.

### Success Metrics

1. All templates generate compose files with image/env/volumes/ports matching @examples/.
2. Type errors occur if a template references a non-existent image or wrong role.
3. Env Editor fields align exactly with image `envSchema`.
4. Test coverage across all templates/images passes.

### Open Questions

1. Field ordering in Env Editor: use `envSchema` order or alphabetical? (Default: schema order.)
2. Display logic for non-functional templates in UI (badge or disabled state)?

### Implementation Plan (High-Level)

1. Add `src/shared/registry/roles.ts`, `images.ts`, `providers-to-images.ts`, `templates.ts` with complete data from @examples/.
2. Refactor `compose-writer.ts` to consume the registry for image names, defaults, ports/volumes, and env injection.
3. Update `env-registry.ts` and `deployment-env-store.ts` to derive schemas/defaults from `IMAGES` and compute STS URLs via `wsPort`.
4. Update `template-registry.ts` to reference `TEMPLATES`, rename ElevenLabs to STS variant, and add functional status.
5. Update renderer components to read env schemas from the selected images; adjust template lists to show functional/non-functional states.
6. Tests: add end-to-end compose generation tests for every template; unit tests for registry typings; UI tests for Env Editor schema rendering.

### Test Plan (Cover All)

1. Modular Templates
   - OpenAI LLM: verify `llm/avr-llm-openai` image, tools mount, env defaults, and AMI references.
   - Anthropic LLM: verify env defaults and volumes as in @examples/.
   - Google Modular: verify ASR (google-cloud-speech) and TTS (google-cloud-tts) images, credentials mount.
   - Deepgram ASR: verify deepgram ASR image and env defaults.
   - Vosk ASR: verify model volume mount.

2. STS Templates
   - OpenAI Realtime: verify `sts/avr-sts-openai` image, `PORT=6030`, `STS_URL` routing.
   - Gemini Live: verify `sts/avr-sts-gemini`, `PORT=6037`, phone static mount in Asterisk example.
   - Ultravox: verify `sts/avr-sts-ultravox`, `PORT=6031`.
   - Deepgram STS: verify `sts/avr-sts-deepgram`, `PORT=6033`.
   - ElevenLabs STS: verify `sts/avr-sts-elevenlabs`, `PORT=6035` and env keys.

3. Integration Template
   - n8n integration: verify `llm/avr-llm-n8n` image with env defaults.

4. Typing Tests
   - Ensure invalid template-image assignments fail TypeScript.
   - Removing an image from `IMAGES` breaks templates using it at build time.

5. UI Tests
   - Env Editor renders exactly the `envSchema` fields for selected images in a modular stack and for STS stacks.

### Rollout

“Go all in”: replace legacy mappings and wire all consumers to the registry in one change set. Non-functional templates are flagged in UI until their images exist.
