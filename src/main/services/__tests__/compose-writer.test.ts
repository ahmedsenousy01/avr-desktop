import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Providers } from "@shared/types/providers";
import { DEFAULT_ASTERISK_CONFIG } from "@shared/types/asterisk";
import { createDefaultProviders } from "@shared/types/providers";
import {
  buildComposeObject,
  getAsteriskConfMounts,
  getAsteriskPortMappings,
  renderSortedYaml,
  writeComposeFile,
} from "@main/services/compose-writer";
import { createDeployment } from "@main/services/deployments-store";
import { setWorkspaceRootForTesting } from "@main/services/workspace-root";

// ComposeSpec is imported from compose-writer to avoid duplicating types.

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "avr-compose-writer-test-"));
}

function rmDirRecursive(target: string): void {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function makeProviders(overrides?: Partial<Providers>): Providers {
  const base = createDefaultProviders();
  base.openai.apiKey = "sk-test-openai";
  base.anthropic.apiKey = "sk-test-anthropic";
  base.gemini.apiKey = "sk-test-gemini";
  base.deepgram.apiKey = "sk-test-deepgram";
  base.elevenlabs.apiKey = "sk-test-elevenlabs";
  return { ...base, ...(overrides ?? {}) };
}

describe("compose-writer", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkTempDir();
    setWorkspaceRootForTesting(tmpRoot);
  });

  afterEach(() => {
    setWorkspaceRootForTesting(null);
    rmDirRecursive(tmpRoot);
  });

  it("builds modular compose with correct services, env, mounts, and ports", () => {
    const providers = makeProviders();
    const dep = createDeployment({
      type: "modular",
      name: "Demo",
      providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" },
    });

    const { spec, yaml } = buildComposeObject(dep, providers, DEFAULT_ASTERISK_CONFIG);
    expect(typeof yaml).toBe("string");

    const services = spec.services;
    const expectedServiceNames = [
      `${dep.slug}-core`,
      `${dep.slug}-asterisk`,
      `${dep.slug}-ami`,
      `${dep.slug}-asr-deepgram`,
      `${dep.slug}-tts-elevenlabs`,
      `${dep.slug}-llm-openai`,
    ];
    for (const name of expectedServiceNames) {
      expect(services[name]).toBeTruthy();
      expect(services[name].container_name).toBe(name);
    }

    // Env propagation
    expect(services[`${dep.slug}-llm-openai`].environment?.OPENAI_API_KEY).toBe("sk-test-openai");
    expect(services[`${dep.slug}-tts-elevenlabs`].environment?.ELEVENLABS_API_KEY).toBe("sk-test-elevenlabs");
    expect(services[`${dep.slug}-asr-deepgram`].environment?.DEEPGRAM_API_KEY).toBe("sk-test-deepgram");

    // Asterisk mounts and ports
    const ast = services[`${dep.slug}-asterisk`];
    const mounts = getAsteriskConfMounts();
    for (const m of mounts) expect(ast.volumes).toContain(m);
    const ports = getAsteriskPortMappings(DEFAULT_ASTERISK_CONFIG);
    for (const p of ports) expect(ast.ports).toContain(p);
  });

  it("builds modular compose with google asr/tts without injecting JSON-only env", () => {
    const providers = makeProviders();
    const dep = createDeployment({
      type: "modular",
      providers: { llm: "anthropic", asr: "google", tts: "google" },
    });

    const { spec } = buildComposeObject(dep, providers, DEFAULT_ASTERISK_CONFIG);
    const services = spec.services;
    expect(services[`${dep.slug}-llm-anthropic`].environment?.ANTHROPIC_API_KEY).toBe("sk-test-anthropic");
    // google asr/tts should not include provider-derived API keys
    const asrGoogleEnv = services[`${dep.slug}-asr-google`].environment ?? {};
    const ttsGoogleEnv = services[`${dep.slug}-tts-google`].environment ?? {};
    expect(asrGoogleEnv).not.toHaveProperty("OPENAI_API_KEY");
    expect(asrGoogleEnv).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(asrGoogleEnv).not.toHaveProperty("GEMINI_API_KEY");
    expect(asrGoogleEnv).not.toHaveProperty("DEEPGRAM_API_KEY");
    expect(ttsGoogleEnv).not.toHaveProperty("OPENAI_API_KEY");
    expect(ttsGoogleEnv).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(ttsGoogleEnv).not.toHaveProperty("GEMINI_API_KEY");
    expect(ttsGoogleEnv).not.toHaveProperty("ELEVENLABS_API_KEY");
  });

  it("builds sts compose with openai realtime and env", () => {
    const providers = makeProviders();
    const dep = createDeployment({ type: "sts", providers: { sts: "openai-realtime" } });
    const { spec } = buildComposeObject(dep, providers, undefined);
    const services = spec.services;
    expect(services[`${dep.slug}-sts-openai`]).toBeTruthy();
    expect(services[`${dep.slug}-sts-openai`].environment?.OPENAI_API_KEY).toBe("sk-test-openai");
  });

  it("writes docker-compose.yml idempotently", () => {
    const providers = makeProviders();
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    const { filePath, changed } = writeComposeFile(dep, providers, DEFAULT_ASTERISK_CONFIG);
    expect(filePath.endsWith("docker-compose.yml")).toBe(true);
    expect(changed).toBe(true);
    const first = fs.readFileSync(filePath, "utf8");
    const again = writeComposeFile(dep, providers, DEFAULT_ASTERISK_CONFIG);
    expect(again.changed).toBe(false);
    const second = fs.readFileSync(filePath, "utf8");
    expect(first).toBe(second);
  });

  it("sorts YAML keys deterministically", () => {
    const y = renderSortedYaml({ b: { z: 1, a: 2 }, a: [2, 1] });
    const lines = y.trim().split(/\r?\n/);
    // 'a' should come before 'b'
    expect(lines[0].startsWith("a:"));
  });

  it("produces modular YAML containing expected mounts, ports, and env", () => {
    const providers = makeProviders();
    const dep = createDeployment({
      type: "modular",
      name: "Snapshot Modular",
      providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" },
    });
    const fixed = { ...dep, slug: "snapshot-modular" };
    const { yaml } = buildComposeObject(fixed, providers, DEFAULT_ASTERISK_CONFIG);
    expect(yaml).toContain("snapshot-modular-asterisk");
    expect(yaml).toContain("./asterisk/conf/pjsip.conf:/etc/asterisk/my_pjsip.conf");
    expect(yaml).toContain("10000-10050:10000-10050/udp");
    expect(yaml).toContain("snapshot-modular-llm-openai");
    expect(yaml).toContain("OPENAI_API_KEY");
    expect(yaml).toContain("snapshot-modular-asr-deepgram");
    expect(yaml).toContain("SPEECH_RECOGNITION_MODEL");
    expect(yaml).toContain('networks:\n  snapshot-modular:\n    driver: "bridge"');
    expect(yaml).toContain("ipam");
  });

  it("produces sts YAML containing expected mounts, ports, and env", () => {
    const providers = makeProviders();
    const dep = createDeployment({ type: "sts", name: "Snapshot STS", providers: { sts: "openai-realtime" } });
    const fixed = { ...dep, slug: "snapshot-sts" };
    const { yaml } = buildComposeObject(fixed, providers, DEFAULT_ASTERISK_CONFIG);
    expect(yaml).toContain("snapshot-sts-asterisk");
    expect(yaml).toContain("./asterisk/conf/manager.conf:/etc/asterisk/my_manager.conf");
    expect(yaml).toContain("10000-10050:10000-10050/udp");
    expect(yaml).toContain("snapshot-sts-sts-openai");
    expect(yaml).toContain("OPENAI_API_KEY");
    expect(yaml).toContain("STS_URL");
    expect(yaml).toContain('networks:\n  snapshot-sts:\n    driver: "bridge"');
    expect(yaml).toContain("ipam");
  });

  it("applies environment overrides to all services", () => {
    const providers = makeProviders();
    const dep = createDeployment({
      type: "sts",
      name: "Override Test",
      providers: { sts: "gemini" },
    });

    // Add environment overrides to the deployment
    const depWithOverrides = {
      ...dep,
      environmentOverrides: {
        GEMINI_MODEL: "gemini-2.5-flash-preview-native-audio-dialog",
        GEMINI_INSTRUCTIONS: "You are a helpful assistant",
        CUSTOM_VAR: "test-value",
        OPENAI_MODEL: "gpt-4o", // This should appear in all services but only be used by relevant ones
      },
    };

    const { spec } = buildComposeObject(depWithOverrides, providers, DEFAULT_ASTERISK_CONFIG);
    const services = spec.services;

    // Verify overrides are applied to all services
    Object.values(services).forEach((service) => {
      expect(service.environment?.GEMINI_MODEL).toBe("gemini-2.5-flash-preview-native-audio-dialog");
      expect(service.environment?.GEMINI_INSTRUCTIONS).toBe("You are a helpful assistant");
      expect(service.environment?.CUSTOM_VAR).toBe("test-value");
      expect(service.environment?.OPENAI_MODEL).toBe("gpt-4o");
    });

    // Verify the sts-gemini service specifically has the overrides
    const stsGemini = services[`${dep.slug}-sts-gemini`];
    expect(stsGemini.environment?.GEMINI_MODEL).toBe("gemini-2.5-flash-preview-native-audio-dialog");
    expect(stsGemini.environment?.GEMINI_INSTRUCTIONS).toBe("You are a helpful assistant");
  });

  it("environment overrides take precedence over default values", () => {
    const providers = makeProviders();
    const dep = createDeployment({
      type: "sts",
      name: "Precedence Test",
      providers: { sts: "gemini" },
    });

    // Override the default GEMINI_MODEL
    const depWithOverrides = {
      ...dep,
      environmentOverrides: {
        GEMINI_MODEL: "custom-gemini-model",
        PORT: "9999", // Override default port
      },
    };

    const { spec } = buildComposeObject(depWithOverrides, providers, DEFAULT_ASTERISK_CONFIG);
    const services = spec.services;

    // Verify overrides take precedence
    const stsGemini = services[`${dep.slug}-sts-gemini`];
    expect(stsGemini.environment?.GEMINI_MODEL).toBe("custom-gemini-model");
    expect(stsGemini.environment?.PORT).toBe("9999");
  });

  it("environment overrides work with modular deployments", () => {
    const providers = makeProviders();
    const dep = createDeployment({
      type: "modular",
      name: "Modular Override Test",
      providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" },
    });

    const depWithOverrides = {
      ...dep,
      environmentOverrides: {
        OPENAI_MODEL: "gpt-4o",
        DEEPGRAM_MODEL: "nova-2",
        ELEVENLABS_VOICE_ID: "custom-voice",
        CUSTOM_VAR: "modular-test",
      },
    };

    const { spec } = buildComposeObject(depWithOverrides, providers, DEFAULT_ASTERISK_CONFIG);
    const services = spec.services;

    // Verify overrides are applied to all services
    Object.values(services).forEach((service) => {
      expect(service.environment?.OPENAI_MODEL).toBe("gpt-4o");
      expect(service.environment?.DEEPGRAM_MODEL).toBe("nova-2");
      expect(service.environment?.ELEVENLABS_VOICE_ID).toBe("custom-voice");
      expect(service.environment?.CUSTOM_VAR).toBe("modular-test");
    });

    // Verify specific services have the relevant overrides
    const llmOpenai = services[`${dep.slug}-llm-openai`];
    expect(llmOpenai.environment?.OPENAI_MODEL).toBe("gpt-4o");

    const asrDeepgram = services[`${dep.slug}-asr-deepgram`];
    expect(asrDeepgram.environment?.DEEPGRAM_MODEL).toBe("nova-2");

    const ttsElevenlabs = services[`${dep.slug}-tts-elevenlabs`];
    expect(ttsElevenlabs.environment?.ELEVENLABS_VOICE_ID).toBe("custom-voice");
  });

  it("handles empty environment overrides gracefully", () => {
    const providers = makeProviders();
    const dep = createDeployment({
      type: "sts",
      name: "Empty Override Test",
      providers: { sts: "gemini" },
    });

    const depWithEmptyOverrides = {
      ...dep,
      environmentOverrides: {},
    };

    const { spec } = buildComposeObject(depWithEmptyOverrides, providers, DEFAULT_ASTERISK_CONFIG);
    const services = spec.services;

    // Should still have default environment variables
    const stsGemini = services[`${dep.slug}-sts-gemini`];
    expect(stsGemini.environment?.GEMINI_MODEL).toBe("gemini-2.5-flash-preview-native-audio-dialog");
    expect(stsGemini.environment?.PORT).toBe("6037");
  });
});
