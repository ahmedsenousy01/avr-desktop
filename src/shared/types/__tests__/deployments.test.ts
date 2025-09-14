import type { Deployment } from "../deployments";
import { describe, expect, it } from "vitest";

import { DEFAULT_ASTERISK_CONFIG } from "../asterisk";
import { isValidDeployment, validateDeployment } from "../deployments";

describe("deployments types and validation", () => {
  it("accepts a minimal valid modular deployment", () => {
    const d: Deployment = {
      id: "id-1",
      name: "My Modular",
      slug: "my-modular",
      type: "modular",
      providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(isValidDeployment(d)).toBe(true);
    expect(validateDeployment(d).errors).toEqual([]);
  });

  it("accepts a minimal valid sts deployment", () => {
    const d: Deployment = {
      id: "id-2",
      name: "My STS",
      slug: "my-sts",
      type: "sts",
      providers: { sts: "openai-realtime" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(isValidDeployment(d)).toBe(true);
  });

  it("accepts deployment with asterisk block and validates it", () => {
    const d: Deployment = {
      id: "id-3",
      name: "With Asterisk",
      slug: "with-ast",
      type: "modular",
      providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" },
      asterisk: { ...DEFAULT_ASTERISK_CONFIG, externalIp: "198.51.100.5" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(isValidDeployment(d)).toBe(true);
  });

  it("rejects mixed provider fields for sts", () => {
    const invalid = {
      id: "x",
      name: "bad",
      slug: "bad",
      type: "sts",
      providers: { sts: "ultravox", llm: "openai" },
      createdAt: "iso",
      updatedAt: "iso",
    };
    const res = validateDeployment(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toMatch(/must not be set/);
  });
});
