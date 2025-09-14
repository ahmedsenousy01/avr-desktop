import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultProviders } from "../../../shared/types/providers";
import {
  getProvidersDirPath,
  getProvidersFilePath,
  readProviders,
  saveProviders,
  saveProvidersQueued,
} from "../providers-store";
import { setWorkspaceRootForTesting } from "../workspace-root";

// Mock electron early to avoid requiring a real Electron runtime in tests
vi.mock("electron", () => ({ app: { getPath: () => os.tmpdir() } }));

let tmpRoot: string;

function mkTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "avr-ws-"));
  return dir;
}

function rmDirRecursive(target: string): void {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

describe("providers-store persistence", () => {
  beforeEach(() => {
    tmpRoot = mkTempDir();
    setWorkspaceRootForTesting(tmpRoot);
  });

  afterEach(() => {
    setWorkspaceRootForTesting(null);
    rmDirRecursive(tmpRoot);
  });

  it("returns defaults when file is missing", () => {
    const data = readProviders();
    expect(data).toEqual(createDefaultProviders());
  });

  it("saves and reads back merged providers", () => {
    const merged = saveProviders({ openai: { apiKey: "a" } });
    expect(merged.openai.apiKey).toBe("a");
    const filePath = getProvidersFilePath();
    expect(fs.existsSync(filePath)).toBe(true);
    const reloaded = readProviders();
    expect(reloaded.openai.apiKey).toBe("a");
  });

  it("backs up invalid JSON and returns defaults", () => {
    const dir = getProvidersDirPath();
    fs.mkdirSync(dir, { recursive: true });
    const file = getProvidersFilePath();
    fs.writeFileSync(file, "{ invalid json", "utf8");
    const data = readProviders();
    expect(data).toEqual(createDefaultProviders());
    const backups = fs.readdirSync(dir).filter((f) => f.startsWith("providers.invalid-"));
    expect(backups.length).toBeGreaterThan(0);
  });

  it("queued saves are serialized (last write wins)", async () => {
    const p1 = saveProvidersQueued({ openai: { apiKey: "one" } });
    const p2 = saveProvidersQueued({ openai: { apiKey: "two" } });
    await Promise.all([p1, p2]);
    const final = readProviders();
    expect(final.openai.apiKey).toBe("two");
  });
});
