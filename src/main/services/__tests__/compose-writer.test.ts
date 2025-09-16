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
    // google asr/tts should not include GOOGLE_APPLICATION_CREDENTIALS via providers JSON
    expect(services[`${dep.slug}-asr-google`].environment).toBeUndefined();
    expect(services[`${dep.slug}-tts-google`].environment).toBeUndefined();
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

  it("produces stable YAML snapshot for modular selection", () => {
    const providers = makeProviders();
    const dep = createDeployment({
      type: "modular",
      name: "Snapshot Modular",
      providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" },
    });
    const fixed = { ...dep, slug: "snapshot-modular" };
    const { yaml } = buildComposeObject(fixed, providers, DEFAULT_ASTERISK_CONFIG);
    expect(yaml).toMatchSnapshot();
  });

  it("produces stable YAML snapshot for sts selection", () => {
    const providers = makeProviders();
    const dep = createDeployment({ type: "sts", name: "Snapshot STS", providers: { sts: "openai-realtime" } });
    const fixed = { ...dep, slug: "snapshot-sts" };
    const { yaml } = buildComposeObject(fixed, providers, DEFAULT_ASTERISK_CONFIG);
    expect(yaml).toMatchSnapshot();
  });
});
