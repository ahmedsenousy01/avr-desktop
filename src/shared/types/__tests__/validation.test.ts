import { describe, expect, it } from "vitest";

import {
  ASR_PROVIDER_IDS,
  getModularCompatibilityIssues,
  isModularSelectionCompatible,
  isValidModularSelection,
  isValidStsSelection,
  LLM_PROVIDER_IDS,
  STS_PROVIDER_IDS,
  TTS_PROVIDER_IDS,
} from "../validation";

describe("selection validation helpers", () => {
  it("accepts valid modular selections", () => {
    const sel = { llm: "openai", asr: "deepgram", tts: "elevenlabs" } as const;
    expect(isValidModularSelection(sel)).toBe(true);
  });

  it("rejects modular selections with invalid ids or types", () => {
    expect(isValidModularSelection({})).toBe(false);
    // invalid llm id
    expect(isValidModularSelection({ llm: "foo", asr: "deepgram", tts: "elevenlabs" })).toBe(false);
    // wrong type
    expect(isValidModularSelection({ llm: 1, asr: "deepgram", tts: "elevenlabs" })).toBe(false);
  });

  it("accepts valid STS selections and rejects invalid ones", () => {
    expect(isValidStsSelection({ sts: "openai-realtime" })).toBe(true);
    expect(isValidStsSelection({ sts: "ultravox" })).toBe(true);
    expect(isValidStsSelection({ sts: "other" })).toBe(false);
    expect(isValidStsSelection({ sts: 7 })).toBe(false);
  });

  it("current compatibility matrix yields no issues for valid modular selection (scaffold)", () => {
    const sel = { llm: "anthropic", asr: "google", tts: "google" } as const;
    expect(isModularSelectionCompatible(sel)).toBe(true);
    expect(getModularCompatibilityIssues(sel)).toEqual([]);
  });

  it("exposes provider id constants for UI consumption", () => {
    expect(LLM_PROVIDER_IDS.length).toBeGreaterThan(0);
    expect(ASR_PROVIDER_IDS.length).toBeGreaterThan(0);
    expect(TTS_PROVIDER_IDS.length).toBeGreaterThan(0);
    expect(STS_PROVIDER_IDS.length).toBeGreaterThan(0);
  });
});
