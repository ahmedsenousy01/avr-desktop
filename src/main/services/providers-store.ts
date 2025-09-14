import fs from "node:fs";
import path from "node:path";
import type { Providers, ProvidersPartial } from "../../shared/types/providers";

import { createDefaultProviders, mergeProviders, validateProvidersShape } from "../../shared/types/providers";
import { getWorkspaceRoot } from "./workspace-root";

const PROVIDERS_DIR = "workspace";
const PROVIDERS_FILE = "providers.json";

export function getProvidersDirPath(): string {
  return path.join(getWorkspaceRoot(), PROVIDERS_DIR);
}

export function getProvidersFilePath(): string {
  return path.join(getProvidersDirPath(), PROVIDERS_FILE);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function backupInvalidFile(filePath: string): void {
  try {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, path.extname(filePath));
    const backupPath = path.join(dir, `${base}.invalid-${timestamp()}.json`);
    fs.renameSync(filePath, backupPath);
  } catch {
    // ignore
  }
}

export function readProviders(): Providers {
  const filePath = getProvidersFilePath();
  if (!fs.existsSync(filePath)) {
    return createDefaultProviders();
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const validation = validateProvidersShape(parsed);
    if (!validation.valid) {
      backupInvalidFile(filePath);
      return createDefaultProviders();
    }
    return mergeProviders(createDefaultProviders(), parsed);
  } catch {
    backupInvalidFile(filePath);
    return createDefaultProviders();
  }
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeJsonAtomic(filePath: string, data: string): void {
  const dir = path.dirname(filePath);
  ensureDirectoryExists(dir);
  const tempPath = path.join(dir, `${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tempPath, data, { encoding: "utf8" });
  fs.renameSync(tempPath, filePath);
}

/**
 * Saves a partial providers object by merging onto current values and writing atomically.
 * Validates the partial shape before merging. Returns the fully merged Providers.
 */
export function saveProviders(partial: ProvidersPartial): Providers {
  const validation = validateProvidersShape(partial);
  if (!validation.valid) {
    const error = new Error(`Invalid providers payload: ${validation.errors.join("; ")}`);
    throw error;
  }

  const current = readProviders();
  const merged = mergeProviders(current, partial);
  const json = JSON.stringify(merged, null, 2);
  writeJsonAtomic(getProvidersFilePath(), json);
  return merged;
}

// Simple in-process queue to serialize writes
let writeQueue: Promise<void> = Promise.resolve();

export async function saveProvidersQueued(partial: ProvidersPartial): Promise<Providers> {
  await writeQueue; // wait for any prior write to finish
  const op = (async () => saveProviders(partial))();
  // ensure the queue waits for this op regardless of success/failure
  writeQueue = op.then(
    () => undefined,
    () => undefined
  );
  return await op;
}
