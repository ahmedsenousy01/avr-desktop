import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDeployment } from "@main/services/deployments-store";
import { setWorkspaceRootForTesting } from "@main/services/workspace-root";

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "avr-deployments-test-"));
}

function rmDirRecursive(target: string): void {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

describe("deployments-store", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkTempDir();
    setWorkspaceRootForTesting(tmpRoot);
  });

  afterEach(() => {
    setWorkspaceRootForTesting(null);
    rmDirRecursive(tmpRoot);
  });

  it("creates a modular deployment and writes deployment.json", () => {
    const dep = createDeployment({
      type: "modular",
      name: "My Mod",
      providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" },
    });
    const dir = path.join(tmpRoot, "deployments", dep.slug);
    const file = path.join(dir, "deployment.json");
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(json.type).toBe("modular");
    expect(json.providers.llm).toBe("openai");
    expect(json.providers.asr).toBe("deepgram");
    expect(json.providers.tts).toBe("elevenlabs");
    expect(json.providers.sts).toBeUndefined();
  });

  it("creates an sts deployment and writes deployment.json", () => {
    const dep = createDeployment({ type: "sts", name: "My STS", providers: { sts: "openai-realtime" } });
    const dir = path.join(tmpRoot, "deployments", dep.slug);
    const file = path.join(dir, "deployment.json");
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(json.type).toBe("sts");
    expect(json.providers.sts).toBe("openai-realtime");
    expect(json.providers.llm).toBeUndefined();
    expect(json.providers.asr).toBeUndefined();
    expect(json.providers.tts).toBeUndefined();
  });
});
