import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PreflightResult } from "@shared/ipc";
import { DEFAULT_ASTERISK_CONFIG } from "@shared/types/asterisk";
import {
  createDeployment,
  duplicateDeployment,
  getPreflightFilePathByDeploymentId,
  readPreflightResultByDeploymentId,
  updateDeployment,
  writePreflightResultByDeploymentId,
} from "@main/services/deployments-store";
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
    // ensure original written first
    const _origDir = path.join(tmpRoot, "deployments", dep.slug);
    const file = path.join(_origDir, "deployment.json");
    expect(fs.existsSync(_origDir)).toBe(true);
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
    const _dir = path.join(tmpRoot, "deployments", dep.slug);
    const file = path.join(_dir, "deployment.json");
    expect(fs.existsSync(_dir)).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(json.type).toBe("sts");
    expect(json.providers.sts).toBe("openai-realtime");
    expect(json.providers.llm).toBeUndefined();
    expect(json.providers.asr).toBeUndefined();
    expect(json.providers.tts).toBeUndefined();
  });

  it("updates asterisk config and emits conf files", async () => {
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    const _dir = path.join(tmpRoot, "deployments", dep.slug);
    const astDir = path.join(_dir, "asterisk", "conf");
    const cfg = { ...DEFAULT_ASTERISK_CONFIG, externalIp: "198.51.100.5" };
    const next = await updateDeployment(dep.id, { asterisk: cfg });
    expect(next.asterisk?.externalIp).toBe("198.51.100.5");
    // Files should be emitted
    for (const name of ["ari.conf", "pjsip.conf", "extensions.conf", "manager.conf", "queues.conf"]) {
      expect(fs.existsSync(path.join(astDir, name))).toBe(true);
    }
  });

  it("is idempotent when writing asterisk files multiple times", async () => {
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    const _dir = path.join(tmpRoot, "deployments", dep.slug);
    const astDir = path.join(_dir, "asterisk", "conf");
    const cfg = { ...DEFAULT_ASTERISK_CONFIG, externalIp: "203.0.113.10" };
    await updateDeployment(dep.id, { asterisk: cfg });
    await updateDeployment(dep.id, { asterisk: cfg });
    // Still present after repeated writes
    expect(fs.existsSync(astDir)).toBe(true);
    expect(fs.existsSync(path.join(astDir, "pjsip.conf"))).toBe(true);
  });

  it("duplicates copies asterisk block and files", async () => {
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    const _dirDup = path.join(tmpRoot, "deployments", dep.slug);
    const cfg = { ...DEFAULT_ASTERISK_CONFIG, externalIp: "192.0.2.10" };
    await updateDeployment(dep.id, { asterisk: cfg });

    const dup = duplicateDeployment(dep.id, "Copy");
    const dupDir = path.join(tmpRoot, "deployments", dup.slug);
    const dupJson = JSON.parse(fs.readFileSync(path.join(dupDir, "deployment.json"), "utf8"));
    expect(dupJson.asterisk.externalIp).toBe("192.0.2.10");
    for (const name of ["ari.conf", "pjsip.conf", "extensions.conf", "manager.conf", "queues.conf"]) {
      expect(fs.existsSync(path.join(dupDir, "asterisk", "conf", name))).toBe(true);
    }
  });

  it("updates environment overrides", async () => {
    const dep = createDeployment({ type: "sts", providers: { sts: "gemini" } });
    const overrides = {
      GEMINI_MODEL: "gemini-2.5-flash-preview-native-audio-dialog",
      GEMINI_INSTRUCTIONS: "You are a helpful assistant",
      CUSTOM_VAR: "test-value",
    };

    const updated = await updateDeployment(dep.id, { environmentOverrides: overrides });
    expect(updated.environmentOverrides).toEqual(overrides);

    // Verify persistence
    const file = path.join(tmpRoot, "deployments", dep.slug, "deployment.json");
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(json.environmentOverrides).toEqual(overrides);
  });

  it("replaces environment overrides completely", async () => {
    const dep = createDeployment({ type: "sts", providers: { sts: "gemini" } });

    // Set initial overrides
    await updateDeployment(dep.id, {
      environmentOverrides: {
        GEMINI_MODEL: "gemini-2.0-flash",
        EXISTING_VAR: "keep-me",
      },
    });

    // Update with new overrides
    const updated = await updateDeployment(dep.id, {
      environmentOverrides: {
        GEMINI_MODEL: "gemini-2.5-flash-preview-native-audio-dialog",
        NEW_VAR: "new-value",
      },
    });

    expect(updated.environmentOverrides).toEqual({
      GEMINI_MODEL: "gemini-2.5-flash-preview-native-audio-dialog",
      NEW_VAR: "new-value",
    });
  });

  it("clears environment overrides when set to empty object", async () => {
    const dep = createDeployment({ type: "sts", providers: { sts: "gemini" } });

    // Set initial overrides
    await updateDeployment(dep.id, {
      environmentOverrides: {
        GEMINI_MODEL: "gemini-2.0-flash",
        CUSTOM_VAR: "test",
      },
    });

    // Clear overrides
    const updated = await updateDeployment(dep.id, { environmentOverrides: {} });
    expect(updated.environmentOverrides).toEqual({});

    // Verify persistence
    const file = path.join(tmpRoot, "deployments", dep.slug, "deployment.json");
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(json.environmentOverrides).toEqual({});
  });
});

describe("deployments-store preflight persistence", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkTempDir();
    setWorkspaceRootForTesting(tmpRoot);
  });

  afterEach(() => {
    setWorkspaceRootForTesting(null);
    rmDirRecursive(tmpRoot);
  });

  it("resolves preflight path and reads/writes results", () => {
    const dep = createDeployment({ type: "sts", providers: { sts: "openai-realtime" } });
    const file = getPreflightFilePathByDeploymentId(dep.id);
    expect(file && file.endsWith("preflight.json")).toBe(true);

    const before = readPreflightResultByDeploymentId(dep.id);
    expect(before).toBeNull();

    const result: PreflightResult = {
      items: [{ id: "docker:available:ok", title: "Docker is available", severity: "pass", message: "ok" }],
      summary: {
        total: 1,
        pass: 1,
        warn: 0,
        fail: 0,
        startedAt: Date.now(),
        finishedAt: Date.now(),
        durationMs: 0,
        overall: "pass",
      },
    };

    writePreflightResultByDeploymentId(dep.id, result);
    const after = readPreflightResultByDeploymentId(dep.id);
    expect(after?.summary.total).toBe(1);
    expect(after?.items[0].id).toBe("docker:available:ok");
  });
});
