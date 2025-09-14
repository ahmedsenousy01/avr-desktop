/**
 * Providers types and defaults for storing provider credentials in JSON.
 *
 * Scope (MVP): OpenAI, Anthropic, Gemini (Google), Deepgram, ElevenLabs.
 * Keys are stored locally in JSON; no .env usage by design.
 */

/**
 * Canonical list of supported provider identifiers.
 */
export const PROVIDER_IDS = ["openai", "anthropic", "gemini", "deepgram", "elevenlabs"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

/**
 * Minimal credential shape for a provider.
 * Extend in future if a provider requires more than a single API key.
 */
export interface ProviderCredentials {
  apiKey: string;
}

/**
 * Complete providers object keyed by provider id.
 */
export type Providers = Record<ProviderId, ProviderCredentials>;
export type ProvidersPartial = Partial<Record<ProviderId, ProviderCredentials>>;

/**
 * Factory that returns a fully-populated Providers object with empty values.
 * Useful as a default when no persisted file exists yet.
 */
export function createDefaultProviders(): Providers {
  return {
    openai: { apiKey: "" },
    anthropic: { apiKey: "" },
    gemini: { apiKey: "" },
    deepgram: { apiKey: "" },
    elevenlabs: { apiKey: "" },
  };
}

/** Validation helpers and runtime guards */
export interface ProvidersValidationResult {
  valid: boolean;
  errors: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns detailed errors describing why the input does not match Providers.
 */
export function validateProvidersShape(input: unknown): ProvidersValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return { valid: false, errors: ["Input must be an object"] };
  }

  const inputRecord = input as Record<string, unknown>;
  const requiredIds = new Set<ProviderId>(PROVIDER_IDS);
  const presentKeys = Object.keys(inputRecord);

  // Unknown provider identifiers
  const unknownKeys = presentKeys.filter((k) => !requiredIds.has(k as ProviderId));
  if (unknownKeys.length > 0) {
    errors.push(`Unknown provider id(s): ${unknownKeys.sort().join(", ")}`);
  }

  // Per-provider credential validation
  for (const id of PROVIDER_IDS) {
    const value = inputRecord[id];
    if (value === undefined) {
      continue; // allowed to be absent
    }
    if (!isPlainObject(value)) {
      errors.push(`Provider '${id}' must be an object`);
      continue;
    }
    const valueObj = value as Record<string, unknown>;

    // Only allow 'apiKey'
    const allowedKeys = new Set(["apiKey"]);
    const valueKeys = Object.keys(valueObj);
    const unexpected = valueKeys.filter((k) => !allowedKeys.has(k));
    if (unexpected.length > 0) {
      errors.push(`Provider '${id}' has unexpected field(s): ${unexpected.sort().join(", ")}`);
    }

    if (typeof valueObj.apiKey !== "string") {
      errors.push(`Provider '${id}'.apiKey must be a string`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Type guard for Providers. For detailed errors, call validateProvidersShape.
 */
export function isValidProvidersShape(input: unknown): input is ProvidersPartial {
  return validateProvidersShape(input).valid;
}

/**
 * Safely deep-merges a partial providers object into a complete providers object.
 * - Only known providers are merged; unknown keys are ignored.
 * - Only known fields per provider are merged; currently only 'apiKey'.
 * - Non-string apiKey values are ignored (keeps base value).
 */
export function mergeProviders(base: Providers, partial: ProvidersPartial): Providers {
  const result: Providers = {
    openai: { apiKey: base.openai.apiKey },
    anthropic: { apiKey: base.anthropic.apiKey },
    gemini: { apiKey: base.gemini.apiKey },
    deepgram: { apiKey: base.deepgram.apiKey },
    elevenlabs: { apiKey: base.elevenlabs.apiKey },
  };

  for (const id of PROVIDER_IDS) {
    const incoming = partial[id];
    if (!incoming || typeof incoming !== "object") {
      continue;
    }
    const incomingApiKey = (incoming as ProviderCredentials).apiKey;
    if (typeof incomingApiKey === "string") {
      result[id].apiKey = incomingApiKey;
    }
  }

  return result;
}
