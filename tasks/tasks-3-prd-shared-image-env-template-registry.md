## Relevant Files

- `src/shared/registry/roles.ts` - Logical role taxonomy for images/services.
- `src/shared/registry/images.ts` - Single-source image registry with docker image, defaults, env schema, ports/volumes, wsPort.
- `src/shared/registry/providers-to-images.ts` - Provider → image-key mappings with role-constrained types.
- `src/shared/registry/templates.ts` - Templates built from available images; functional flags.
- `src/shared/registry/__tests__/typing.test.ts` - Type-level tests for role-constrained image keys and template image references.
- `src/main/services/compose-writer.ts` - Compose object/plan generation; refactor to consume registry.
- `src/main/services/env-registry.ts` - Replace hardcoded schemas with schemas derived from image registry.
- `src/main/services/deployment-env-store.ts` - Env seeding; derive defaults/STS URL from registry.
- `src/main/services/template-registry.ts` - Thin UI metadata; reference `TEMPLATES`; fix ElevenLabs to STS.
- `src/renderer/components/env-editor.tsx` - Read schemas from selected images; reflect functional template flags.
- `src/renderer/components/env-service-panel.tsx` - Provider presence display; field rendering from schema.
- `src/shared/types/providers.ts` - Provider ids/labels; used by provider→image mapping.
- `src/main/services/__tests__/compose-writer.test.ts` - Update tests to registry-driven compose.
- `src/main/services/__tests__/compose-writer-env-integration.test.ts` - Integration of env + compose using registry.
- `src/main/services/__tests__/env-registry.test.ts` - New tests for schemas derived from images registry.
- `src/main/services/__tests__/template-registry.test.ts` - Templates constrained to available images; functional flags.
- `src/renderer/components/__tests__/env-editor.test.tsx` - UI renders schema fields from images; ordering.

### Notes

- Use @examples/ as the authoritative source for image defaults, env schemas, and mounts.
- Do not persist provider secrets in `environment.json`.
- Strong typing is required: role-filtered image keys; compile-time failures on mismatches.

## Tasks

- [x] 1.0 Create shared registry modules (roles, images, providers-to-images, templates)
  - [x] 1.1 Add `src/shared/registry/roles.ts` with `LogicalRole` union and role helpers.
  - [x] 1.2 Add `src/shared/registry/images.ts` with `IMAGES` (as const) populated from `src/main/infra/examples/` (docker image, defaultEnv, envSchema, defaultPorts, defaultVolumes, wsPort for STS).
  - [x] 1.3 Define `ImageKey`, `ImageSpec`, and `KeysByRole<R>` conditional type for role-filtered keys.
  - [x] 1.4 Add `src/shared/registry/providers-to-images.ts` mapping provider ids to role-constrained image keys; include ASR (deepgram/google/vosk), TTS (google only), LLM (openai/anthropic/openrouter/n8n), STS (openai/deepgram/ultravox/gemini/elevenlabs).
  - [x] 1.5 Add `src/shared/registry/templates.ts` with `TEMPLATES` using image keys by role; include functional flag; rename ElevenLabs to `elevenlabs-sts`.
  - [x] 1.6 Export strict types for template ids and functional status; ensure removals in `IMAGES` break builds where referenced.

- [x] 2.0 Refactor compose generator to consume the registry exclusively
  - [x] 2.1 Remove `FRAGMENT_IMAGE` and `DEFAULTS_BY_FRAGMENT` from `compose-writer.ts`.
  - [x] 2.2 Build selected image keys from deployment providers using `PROVIDER_TO_IMAGE` (modular: asr/tts/llm; sts: sts).
  - [x] 2.3 For each selected image, set `service.image` from `IMAGES[imageKey].dockerImage`.
  - [x] 2.4 Apply image defaults: merge `defaultPorts`, `defaultVolumes`, and `defaultEnv` into service env.
  - [x] 2.5 Inject provider API keys where the image schema expects them (OpenAI/Anthropic/Gemini/Deepgram/ElevenLabs) without persisting to environment.json.
  - [x] 2.6 For STS, compute `STS_URL` using `IMAGES[stsImageKey].wsPort`; strip modular URLs. For modular, set ASR/LLM/TTS URLs; strip STS.
  - [x] 2.7 Keep Asterisk port-mapping function; preserve deterministic YAML output.
  - [x] 2.8 Update `buildComposePlan` to rely on the new mapping while keeping slug-to-example display name mapping.

- [x] 3.0 Centralize env schemas/defaults from images and update env seeding
  - [x] 3.1 Replace `ENV_REGISTRY` static service variables with schemas derived from `IMAGES` entries.
  - [x] 3.2 Update `deployment-env-store.buildSeedFromRegistry` to seed from image `defaultEnv` instead of hardcoded defaults.
  - [x] 3.3 Generate dynamic defaults (STS_URL or ASR/LLM/TTS URLs) from image specs and deployment selection; store tokens `{{service:avr-...}}` where appropriate.
  - [x] 3.4 Ensure read/write of `environment.json` remains stable with temp-file rename.
  - [x] 3.5 Keep provider secrets out of `environment.json` (no secret materialization).

- [x] 4.0 Update template metadata and renderer to respect registry constraints
  - [x] 4.1 Refactor `template-registry.ts` to a thin UI metadata layer that references `TEMPLATES` for composition and functional flags; rename ElevenLabs to STS.
  - [x] 4.2 Update `env-editor.tsx` to load schemas from selected images; maintain compose plan for ordering and display names.
  - [x] 4.3 Handle non-functional templates in UI (badge/disabled state) based on template functional flag.
  - [x] 4.4 Keep provider presence indicators; do not display provider secrets.

- [x] 5.0 Comprehensive tests for registry typing, compose output, and UI schema rendering
  - [x] 5.1 Typing tests: invalid template→image assignments fail; removing an image breaks dependent templates at build time.
  - [x] 5.2 Compose tests: verify each template’s compose spec matches @examples/ for images, ports, volumes, and default env.
  - [x] 5.3 Env seeding tests: seeded defaults and dynamic URLs match expectations from images/specs.
  - [x] 5.4 UI tests: Env Editor renders fields per image `envSchema` and respects service order; provider presence displayed.
  - [x] 5.5 Snapshot/update existing tests in `__tests__` to align with registry-driven behavior.
