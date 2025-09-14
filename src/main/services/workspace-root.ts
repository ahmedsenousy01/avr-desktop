import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

const DEFAULT_DIR_NAME = "avr-workspace";

let workspaceRootOverride: string | null = null;

function getDefaultWorkspaceRoot(): string {
  const userData = app.getPath("userData");
  return path.join(userData, DEFAULT_DIR_NAME);
}

function ensureDirectoryExists(targetPath: string): void {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

export function getWorkspaceRoot(): string {
  const resolved = workspaceRootOverride ?? getDefaultWorkspaceRoot();
  ensureDirectoryExists(resolved);
  return resolved;
}

// Intended for tests to direct persistence into a temporary directory
export function setWorkspaceRootForTesting(overridePath: string | null): void {
  workspaceRootOverride = overridePath;
}
