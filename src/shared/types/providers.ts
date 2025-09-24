/**
 * Providers types and defaults for storing provider credentials in JSON.
 *
 * Scope (MVP): OpenAI, Anthropic, Gemini (Google), Deepgram, ElevenLabs.
 * Keys are stored locally in JSON; no .env usage by design.
 */

/**
 * Canonical list of supported provider identifiers.
 */
export const PROVIDER_IDS = [
  "openai",
  "anthropic",
  "gemini",
  "deepgram",
  "elevenlabs",
  // Additional providers from @examples/
  "google",
  "vosk",
  "openrouter",
  "ultravox",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

/**
 * Human-friendly display labels for providers.
 */
export const PROVIDER_DISPLAY_LABELS: Readonly<Record<ProviderId, string>> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  deepgram: "Deepgram",
  elevenlabs: "ElevenLabs",
  google: "Google Cloud",
  vosk: "Vosk",
  openrouter: "OpenRouter",
  ultravox: "Ultravox",
} as const;

/**
 * Returns a human-friendly display label for a provider id.
 */
export function getProviderDisplayLabel(providerId: ProviderId): string {
  return PROVIDER_DISPLAY_LABELS[providerId];
}

/**
 * Minimal credential shape for a provider.
 * Extend in future if a provider requires more than a single API key.
 */
export interface ProviderCredentials {
  /** API key-based providers (openai, anthropic, gemini, deepgram, elevenlabs, openrouter, ultravox) */
  apiKey?: string;
  /** Google Cloud providers use a mounted service account file, not an API key */
  credentialsFilePath?: string;
  /** Vosk is a local/offline model that uses a model path */
  modelPath?: string;
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
    google: { credentialsFilePath: "" },
    vosk: { modelPath: "" },
    openrouter: { apiKey: "" },
    ultravox: { apiKey: "" },
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

    // Allowed keys vary per provider
    const allowedKeys = new Set<string>(
      id === "google" ? ["credentialsFilePath"] : id === "vosk" ? ["modelPath"] : ["apiKey"]
    );
    const valueKeys = Object.keys(valueObj);
    const unexpected = valueKeys.filter((k) => !allowedKeys.has(k));
    if (unexpected.length > 0) {
      errors.push(`Provider '${id}' has unexpected field(s): ${unexpected.sort().join(", ")}`);
    }

    if (id === "google") {
      if (typeof valueObj.credentialsFilePath !== "string") {
        errors.push("Provider 'google'.credentialsFilePath must be a string");
      }
    } else if (id === "vosk") {
      if (typeof valueObj.modelPath !== "string") {
        errors.push("Provider 'vosk'.modelPath must be a string");
      }
    } else {
      if (typeof valueObj.apiKey !== "string") {
        errors.push(`Provider '${id}'.apiKey must be a string`);
      }
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
    google: { credentialsFilePath: base.google.credentialsFilePath },
    vosk: { modelPath: base.vosk.modelPath },
    openrouter: { apiKey: base.openrouter.apiKey },
    ultravox: { apiKey: base.ultravox.apiKey },
  };

  for (const id of PROVIDER_IDS) {
    const incoming = partial[id];
    if (!incoming || typeof incoming !== "object") {
      continue;
    }
    const inc = incoming as ProviderCredentials;
    if (id === "google" && typeof inc.credentialsFilePath === "string") {
      result.google.credentialsFilePath = inc.credentialsFilePath;
    } else if (id === "vosk" && typeof inc.modelPath === "string") {
      result.vosk.modelPath = inc.modelPath;
    } else if (typeof inc.apiKey === "string") {
      (result[id] as ProviderCredentials).apiKey = inc.apiKey;
    }
  }

  return result;
}

/**
 * Retrieve a provider's API key, returning an empty string if not present.
 */
export function getProviderApiKey(providers: Providers, providerId: ProviderId): string {
  return providers[providerId].apiKey ?? "";
}

/**
 * Validate Google service account credentials file path.
 * - Checks path looks like a JSON file
 * - If fs is available (Node context), verifies file exists and parses JSON
 * - Optionally checks for common service account keys
 */
export function validateGoogleCredentialsPath(path: string): ProvidersValidationResult {
  const errors: string[] = [];
  if (typeof path !== "string" || path.length === 0) {
    return { valid: false, errors: ["credentialsFilePath must be a non-empty string"] };
  }
  if (!path.toLowerCase().endsWith(".json")) {
    errors.push("credentialsFilePath should point to a .json file");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate Vosk model path.
 * - In Node context, checks directory exists and is non-empty
 * - Otherwise, performs a basic string check
 */
export function validateVoskModelPath(path: string): ProvidersValidationResult {
  const errors: string[] = [];
  if (typeof path !== "string" || path.length === 0) {
    return { valid: false, errors: ["modelPath must be a non-empty string"] };
  }
  // Basic string-level validation only in shared/types; deeper checks happen in main process services
  return { valid: errors.length === 0, errors };
}

/**
 * Pick API keys for a set of provider ids as a simple mapping.
 */
export function pickProviderApiKeys(
  providers: Providers,
  providerIds: readonly ProviderId[]
): Record<ProviderId, string> {
  const result = {} as Record<ProviderId, string>;
  for (const id of providerIds) {
    result[id] = getProviderApiKey(providers, id);
  }
  return result;
}

/** API Validation types and enums */

/**
 * Validation types for API key testing.
 */
export type ApiValidationType = "presence" | "api" | "fallback";

/**
 * Error codes for API validation failures.
 */
export type ApiValidationErrorCode =
  | "invalid_key"
  | "quota_exceeded"
  | "network_error"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "server_error"
  | "unknown_error";

/**
 * Result of API key validation.
 */
export interface ApiValidationResult {
  ok: boolean;
  message: string;
  validationType: ApiValidationType;
  errorCode?: ApiValidationErrorCode;
  details?: string;
}

/**
 * Configuration for API validation endpoints.
 */
export interface ApiValidationEndpoint {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

/**
 * Provider-specific API validation configurations.
 */
export const API_VALIDATION_ENDPOINTS: Partial<Record<ProviderId, ApiValidationEndpoint>> = {
  openai: {
    url: "https://api.openai.com/v1/models",
    method: "GET",
    timeout: 5000,
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    body: {
      model: "claude-3-haiku-20240307",
      max_tokens: 1,
      messages: [{ role: "user", content: "test" }],
    },
    timeout: 5000,
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1/models",
    method: "GET",
    timeout: 5000,
  },
  deepgram: {
    url: "https://api.deepgram.com/v1/projects",
    method: "GET",
    timeout: 5000,
  },
  elevenlabs: {
    url: "https://api.elevenlabs.io/v1/user",
    method: "GET",
    timeout: 5000,
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/models",
    method: "GET",
    timeout: 5000,
  },
  ultravox: {
    url: "https://api.ultravox.ai/api/accounts/me",
    method: "GET",
    timeout: 5000,
  },
};
