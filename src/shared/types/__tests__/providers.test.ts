import type { Providers } from "../providers";
import { describe, expect, it } from "vitest";

import {
  createDefaultProviders,
  isValidProvidersShape,
  mergeProviders,
  PROVIDER_IDS,
  validateProvidersShape,
} from "../providers";

describe("providers types and utilities", () => {
  it("createDefaultProviders returns expected defaults per provider", () => {
    const defaults = createDefaultProviders();
    const keys = Object.keys(defaults).sort();
    expect(keys).toEqual([...PROVIDER_IDS].sort());
    // API-key providers default to empty string
    expect(defaults.openai.apiKey).toBe("");
    expect(defaults.anthropic.apiKey).toBe("");
    expect(defaults.gemini.apiKey).toBe("");
    expect(defaults.deepgram.apiKey).toBe("");
    expect(defaults.elevenlabs.apiKey).toBe("");
    expect(defaults.openrouter.apiKey).toBe("");
    expect(defaults.ultravox.apiKey).toBe("");
    // Google and Vosk use non-apiKey fields
    expect(defaults.google.credentialsFilePath).toBe("");
    expect(defaults.vosk.modelPath).toBe("");
  });

  it("validateProvidersShape accepts partial objects and rejects unknown ids", () => {
    const partialValid = { openai: { apiKey: "sk-openai" } };
    const result1 = validateProvidersShape(partialValid);
    expect(result1.valid).toBe(true);
    expect(result1.errors).toEqual([]);

    // Unknown provider key should be rejected
    const withUnknown = { fooai: { apiKey: "x" } };
    const result2 = validateProvidersShape(withUnknown);
    expect(result2.valid).toBe(false);
    expect(result2.errors.join(" ")).toMatch(/Unknown provider id/);
  });

  it("validateProvidersShape enforces object shape and string apiKey", () => {
    // Non-object value
    const nonObject = { openai: "sk" };
    const r1 = validateProvidersShape(nonObject);
    expect(r1.valid).toBe(false);
    expect(r1.errors.join(" ")).toMatch(/must be an object/);

    // Non-string apiKey
    const nonStringKey = { openai: { apiKey: 123 } };
    const r2 = validateProvidersShape(nonStringKey);
    expect(r2.valid).toBe(false);
    expect(r2.errors.join(" ")).toMatch(/apiKey must be a string/);
  });

  it("isValidProvidersShape acts as a boolean guard for partial inputs", () => {
    expect(isValidProvidersShape({})).toBe(true);
    expect(isValidProvidersShape({ openai: { apiKey: "x" } })).toBe(true);
    expect(isValidProvidersShape({ openai: { apiKey: 5 } })).toBe(false);
  });

  it("mergeProviders merges known provider apiKeys and ignores invalid fields", () => {
    const base: Providers = createDefaultProviders();
    const merged1 = mergeProviders(base, { openai: { apiKey: "a" } });
    expect(merged1.openai.apiKey).toBe("a");
    expect(merged1.anthropic.apiKey).toBe("");

    // Non-string apiKey should not overwrite
    // @ts-expect-error - intentional test
    const merged2 = mergeProviders(merged1, { openai: { apiKey: 42 } });
    expect(merged2.openai.apiKey).toBe("a");

    // Unknown provider key ignored
    const merged3 = mergeProviders(merged2, {
      // @ts-expect-error - intentional test
      unknown: { apiKey: "x" },
      gemini: { apiKey: "g" },
    });
    expect(merged3.gemini.apiKey).toBe("g");
    expect(merged3.openai.apiKey).toBe("a");
  });
});
