import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_ASTERISK_CONFIG } from "@shared/types/asterisk";
import { createDefaultProviders } from "@shared/types/providers";
import { buildComposeObject, writeComposeFile } from "@main/services/compose-writer";
import { ensureDeploymentEnvSeeded, upsertServiceVariable } from "@main/services/deployment-env-store";
import { createDeployment } from "@main/services/deployments-store";
import { setWorkspaceRootForTesting } from "@main/services/workspace-root";

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "avr-compose-env-inttest-"));
}

function rmDirRecursive(target: string): void {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function makeProviders() {
  const p = createDefaultProviders();
  p.openai.apiKey = "sk-openai";
  p.deepgram.apiKey = "sk-deepgram";
  p.elevenlabs.apiKey = "sk-elevenlabs";
  p.anthropic.apiKey = "sk-anthropic";
  p.gemini.apiKey = "sk-gemini";
  return p;
}

describe("compose-writer env integration", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkTempDir();
    setWorkspaceRootForTesting(tmpRoot);
  });

  afterEach(() => {
    setWorkspaceRootForTesting(null);
    rmDirRecursive(tmpRoot);
  });

  it("uses DeploymentEnv values for service env and resolves {{service:*}} templates", () => {
    const providers = makeProviders();

    // Modular stack: deepgram asr, elevenlabs tts, openai llm
    const dep = createDeployment({
      type: "modular",
      name: "Env IntTest",
      providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" },
    });

    // Seed env file then upsert values as if edited in the UI
    ensureDeploymentEnvSeeded(dep.id);

    // Editor stores by example service name (e.g., "avr-core").
    // Provide a templated URL that references example service names.
    const templatedAsrUrl = "http://{{service:avr-asr-deepgram}}:6010/speech-to-text-stream";
    upsertServiceVariable(dep.id, "avr-core", "ASR_URL", templatedAsrUrl);
    upsertServiceVariable(dep.id, "avr-core", "CUSTOM_FLAG", "enabled");
    // Also add a value for a non-core service to ensure merging works
    upsertServiceVariable(dep.id, "avr-llm-openai", "OPENAI_MODEL", "gpt-4o");

    const { spec } = buildComposeObject(dep, providers, DEFAULT_ASTERISK_CONFIG);

    // Core env should include resolved ASR_URL and the custom flag
    const coreName = `${dep.slug}-core`;
    expect(spec.services[coreName]).toBeTruthy();
    const coreEnv = spec.services[coreName].environment ?? {};
    expect(coreEnv.CUSTOM_FLAG).toBe("enabled");
    expect(coreEnv.ASR_URL).toBe(`http://${dep.slug}-asr-deepgram:6010/speech-to-text-stream`);

    // LLM service should include provider key (from providers) and the editor-specified model
    const llmName = `${dep.slug}-llm-openai`;
    const llmEnv = spec.services[llmName].environment ?? {};
    expect(llmEnv.OPENAI_API_KEY).toBe("sk-openai");
    expect(llmEnv.OPENAI_MODEL).toBe("gpt-4o");

    // Write file and ensure resolved name appears in YAML
    const out = writeComposeFile(dep, providers, DEFAULT_ASTERISK_CONFIG);
    const yaml = fs.readFileSync(out.filePath, "utf8");
    expect(yaml).toContain(`${dep.slug}-asr-deepgram`);
    expect(yaml).toContain("ASR_URL");
  });
});
