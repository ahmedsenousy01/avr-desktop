/**
 * API Key Validation Service
 *
 * Validates API keys by making actual requests to provider endpoints.
 * Falls back to presence validation if network requests fail.
 */

import type {
  ProviderId,
  ApiValidationResult,
} from "@shared/types/providers";
import { API_VALIDATION_ENDPOINTS } from "@shared/types/providers";

interface HttpResponse {
  status: number;
  statusText: string;
  data?: unknown;
  error?: string;
}

/**
 * Simple HTTP client with timeout support
 */
async function makeHttpRequest(
  url: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
    timeout?: number;
  }
): Promise<HttpResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 5000);

  try {
    const fetchOptions: RequestInit = {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: controller.signal,
    };

    if (options.body && options.method !== "GET") {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      // Response might not be JSON, that's okay
    }

    return {
      status: response.status,
      statusText: response.statusText,
      data,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { status: 0, statusText: "Timeout", error: "Request timed out" };
      }
      return { status: 0, statusText: "Network Error", error: error.message };
    }

    return { status: 0, statusText: "Unknown Error", error: "Unknown error occurred" };
  }
}

/**
 * Validates OpenAI API key using the /v1/models endpoint
 */
async function validateOpenAIKey(apiKey: string): Promise<ApiValidationResult> {
  const endpoint = API_VALIDATION_ENDPOINTS.openai;

  const response = await makeHttpRequest(endpoint.url, {
    method: endpoint.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: endpoint.timeout,
  });

  if (response.status === 200) {
    return {
      ok: true,
      message: "API key is valid",
      validationType: "api",
    };
  }

  if (response.status === 401) {
    return {
      ok: false,
      message: "Invalid API key",
      validationType: "api",
      errorCode: "unauthorized",
      details: "The API key is not valid or has been revoked",
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      message: "Rate limit exceeded",
      validationType: "api",
      errorCode: "rate_limited",
      details: "Too many requests, please try again later",
    };
  }

  if (response.status === 0) {
    return {
      ok: false,
      message: "Network error during validation",
      validationType: "api",
      errorCode: response.error?.includes("timeout") ? "timeout" : "network_error",
      details: response.error,
    };
  }

  return {
    ok: false,
    message: "API validation failed",
    validationType: "api",
    errorCode: "server_error",
    details: `HTTP ${response.status}: ${response.statusText}`,
  };
}

/**
 * Validates Anthropic API key using the /v1/messages endpoint
 */
async function validateAnthropicKey(apiKey: string): Promise<ApiValidationResult> {
  const endpoint = API_VALIDATION_ENDPOINTS.anthropic;

  const response = await makeHttpRequest(endpoint.url, {
    method: endpoint.method,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: endpoint.body,
    timeout: endpoint.timeout,
  });

  if (response.status === 200) {
    return {
      ok: true,
      message: "API key is valid",
      validationType: "api",
    };
  }

  if (response.status === 401) {
    return {
      ok: false,
      message: "Invalid API key",
      validationType: "api",
      errorCode: "unauthorized",
      details: "The API key is not valid or has been revoked",
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      message: "Rate limit exceeded",
      validationType: "api",
      errorCode: "rate_limited",
      details: "Too many requests, please try again later",
    };
  }

  if (response.status === 0) {
    return {
      ok: false,
      message: "Network error during validation",
      validationType: "api",
      errorCode: response.error?.includes("timeout") ? "timeout" : "network_error",
      details: response.error,
    };
  }

  return {
    ok: false,
    message: "API validation failed",
    validationType: "api",
    errorCode: "server_error",
    details: `HTTP ${response.status}: ${response.statusText}`,
  };
}

/**
 * Validates Google/Gemini API key using the models endpoint
 */
async function validateGeminiKey(apiKey: string): Promise<ApiValidationResult> {
  const endpoint = API_VALIDATION_ENDPOINTS.gemini;
  const url = `${endpoint.url}?key=${encodeURIComponent(apiKey)}`;

  const response = await makeHttpRequest(url, {
    method: endpoint.method,
    timeout: endpoint.timeout,
  });

  if (response.status === 200) {
    return {
      ok: true,
      message: "API key is valid",
      validationType: "api",
    };
  }

  if (response.status === 400 || response.status === 403) {
    return {
      ok: false,
      message: "Invalid API key",
      validationType: "api",
      errorCode: "forbidden",
      details: "The API key is not valid or lacks permissions",
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      message: "Rate limit exceeded",
      validationType: "api",
      errorCode: "rate_limited",
      details: "Too many requests, please try again later",
    };
  }

  if (response.status === 0) {
    return {
      ok: false,
      message: "Network error during validation",
      validationType: "api",
      errorCode: response.error?.includes("timeout") ? "timeout" : "network_error",
      details: response.error,
    };
  }

  return {
    ok: false,
    message: "API validation failed",
    validationType: "api",
    errorCode: "server_error",
    details: `HTTP ${response.status}: ${response.statusText}`,
  };
}

/**
 * Validates Deepgram API key using the projects endpoint
 */
async function validateDeepgramKey(apiKey: string): Promise<ApiValidationResult> {
  const endpoint = API_VALIDATION_ENDPOINTS.deepgram;

  const response = await makeHttpRequest(endpoint.url, {
    method: endpoint.method,
    headers: {
      Authorization: `Token ${apiKey}`,
    },
    timeout: endpoint.timeout,
  });

  if (response.status === 200) {
    return {
      ok: true,
      message: "API key is valid",
      validationType: "api",
    };
  }

  if (response.status === 401) {
    return {
      ok: false,
      message: "Invalid API key",
      validationType: "api",
      errorCode: "unauthorized",
      details: "The API key is not valid or has been revoked",
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      message: "Rate limit exceeded",
      validationType: "api",
      errorCode: "rate_limited",
      details: "Too many requests, please try again later",
    };
  }

  if (response.status === 0) {
    return {
      ok: false,
      message: "Network error during validation",
      validationType: "api",
      errorCode: response.error?.includes("timeout") ? "timeout" : "network_error",
      details: response.error,
    };
  }

  return {
    ok: false,
    message: "API validation failed",
    validationType: "api",
    errorCode: "server_error",
    details: `HTTP ${response.status}: ${response.statusText}`,
  };
}

/**
 * Validates ElevenLabs API key using the user endpoint
 */
async function validateElevenLabsKey(apiKey: string): Promise<ApiValidationResult> {
  const endpoint = API_VALIDATION_ENDPOINTS.elevenlabs;

  const response = await makeHttpRequest(endpoint.url, {
    method: endpoint.method,
    headers: {
      "xi-api-key": apiKey,
    },
    timeout: endpoint.timeout,
  });

  if (response.status === 200) {
    return {
      ok: true,
      message: "API key is valid",
      validationType: "api",
    };
  }

  if (response.status === 401) {
    return {
      ok: false,
      message: "Invalid API key",
      validationType: "api",
      errorCode: "unauthorized",
      details: "The API key is not valid or has been revoked",
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      message: "Rate limit exceeded",
      validationType: "api",
      errorCode: "rate_limited",
      details: "Too many requests, please try again later",
    };
  }

  if (response.status === 0) {
    return {
      ok: false,
      message: "Network error during validation",
      validationType: "api",
      errorCode: response.error?.includes("timeout") ? "timeout" : "network_error",
      details: response.error,
    };
  }

  return {
    ok: false,
    message: "API validation failed",
    validationType: "api",
    errorCode: "server_error",
    details: `HTTP ${response.status}: ${response.statusText}`,
  };
}

/**
 * Fallback validation that only checks for presence
 */
function validatePresenceOnly(apiKey: string): ApiValidationResult {
  const trimmed = apiKey.trim();
  const ok = trimmed.length > 0;

  return {
    ok,
    message: ok ? "Key present" : "Missing or empty apiKey",
    validationType: "presence",
    errorCode: ok ? undefined : "invalid_key",
  };
}

/**
 * Main API key validation function
 */
export async function validateApiKey(
  providerId: ProviderId,
  apiKey: string,
  fallbackToPresence = true
): Promise<ApiValidationResult> {
  // Always check presence first
  const presenceResult = validatePresenceOnly(apiKey);
  if (!presenceResult.ok) {
    return presenceResult;
  }

  try {
    let result: ApiValidationResult;

    switch (providerId) {
      case "openai":
        result = await validateOpenAIKey(apiKey);
        break;
      case "anthropic":
        result = await validateAnthropicKey(apiKey);
        break;
      case "gemini":
        result = await validateGeminiKey(apiKey);
        break;
      case "deepgram":
        result = await validateDeepgramKey(apiKey);
        break;
      case "elevenlabs":
        result = await validateElevenLabsKey(apiKey);
        break;
      default:
        throw new Error(`Unsupported provider: ${providerId}`);
    }

    return result;
  } catch (error) {
    if (fallbackToPresence) {
      return {
        ok: true,
        message: "Key present (API validation failed)",
        validationType: "fallback",
        details: error instanceof Error ? error.message : "Unknown error during API validation",
      };
    }

    return {
      ok: false,
      message: "API validation failed",
      validationType: "api",
      errorCode: "unknown_error",
      details: error instanceof Error ? error.message : "Unknown error during API validation",
    };
  }
}