import fs from "node:fs";
import path from "node:path";

import type { PreflightResult } from "@shared/ipc";
import type { AsteriskConfig } from "@shared/types/asterisk";
import type { Deployment } from "@shared/types/deployments";
import type { ASRProviderId, LLMProviderId, STSProviderId, TTSProviderId } from "@shared/types/validation";
import { DeploymentSchema } from "@shared/types/deployments";
import { renderAsteriskConfig } from "@main/services/asterisk-config";
import { getWorkspaceRoot } from "@main/services/workspace-root";

function getDeploymentsRoot(): string {
  const root = getWorkspaceRoot();
  const dir = path.join(root, "deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function generateId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `dep_${Date.now().toString(36)}_${rand}`;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 64) || "deployment"
  );
}

export type CreateDeploymentArgs =
  | {
      name?: string;
      type: "modular";
      providers: { llm: LLMProviderId; asr: ASRProviderId; tts: TTSProviderId };
    }
  | {
      name?: string;
      type: "sts";
      providers: { sts: STSProviderId };
    };

export function createDeployment(args: CreateDeploymentArgs): Deployment {
  const id = generateId();
  const baseName = args.name ?? (args.type === "modular" ? "Modular Deployment" : "STS Deployment");
  const slug = slugify(`${baseName}-${id.slice(4, 10)}`);
  const now = new Date().toISOString();

  const deployment: Deployment = {
    id,
    name: baseName,
    slug,
    type: args.type,
    providers:
      args.type === "modular"
        ? {
            llm: args.providers.llm,
            asr: args.providers.asr,
            tts: args.providers.tts,
            sts: undefined,
          }
        : {
            llm: undefined,
            asr: undefined,
            tts: undefined,
            sts: args.providers.sts,
          },
    createdAt: now,
    updatedAt: now,
  };

  const dir = path.join(getDeploymentsRoot(), slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "deployment.json");
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2), "utf8");

  return deployment;
}

export function listDeployments(): Deployment[] {
  const dir = path.join(getDeploymentsRoot());
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const deployments: Deployment[] = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const file = path.join(dir, ent.name, "deployment.json");
    if (!fs.existsSync(file)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      const parsed = DeploymentSchema.parse(json);
      deployments.push(parsed);
    } catch {
      // skip invalid
    }
  }
  return deployments;
}

export function findDeploymentDirById(id: string): string | null {
  const dir = path.join(getDeploymentsRoot());
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const file = path.join(dir, ent.name, "deployment.json");
    if (!fs.existsSync(file)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      const parsed = DeploymentSchema.parse(json);
      if (parsed.id === id) return path.join(dir, ent.name);
    } catch {
      // ignore
    }
  }
  return null;
}

export async function updateDeployment(
  id: string,
  patch: { name?: string; providers?: Partial<Deployment["providers"]>; asterisk?: AsteriskConfig }
): Promise<Deployment> {
  const dir = findDeploymentDirById(id);
  if (!dir) throw new Error("Deployment not found");
  const file = path.join(dir, "deployment.json");
  const current = DeploymentSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  const next: Deployment = {
    ...current,
    name: patch.name ?? current.name,
    providers: { ...current.providers, ...(patch.providers ?? {}) },
    asterisk: patch.asterisk ?? current.asterisk,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(next, null, 2), "utf8");

  // Emit asterisk conf files if provided
  if (patch.asterisk) {
    const astDir = path.join(dir, "asterisk");
    if (!fs.existsSync(astDir)) fs.mkdirSync(astDir, { recursive: true });
    // Wait for files to be written so callers can assert existence
    await renderAsteriskConfig(patch.asterisk, undefined, astDir, false);
  }
  return next;
}

export function duplicateDeployment(id: string, name?: string): Deployment {
  const dir = findDeploymentDirById(id);
  if (!dir) throw new Error("Deployment not found");
  const current = DeploymentSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, "deployment.json"), "utf8")));
  if (current.type === "modular") {
    const created = createDeployment({
      type: "modular",
      name: name ?? `${current.name} Copy`,
      providers: {
        llm: current.providers.llm as LLMProviderId,
        asr: current.providers.asr as ASRProviderId,
        tts: current.providers.tts as TTSProviderId,
      },
    });
    // Copy asterisk settings and files if present
    if (current.asterisk) {
      const newDir = findDeploymentDirById(created.id);
      if (newDir) {
        const newFile = path.join(newDir, "deployment.json");
        const newJson = JSON.parse(fs.readFileSync(newFile, "utf8"));
        newJson.asterisk = current.asterisk;
        newJson.updatedAt = new Date().toISOString();
        fs.writeFileSync(newFile, JSON.stringify(newJson, null, 2), "utf8");

        const srcAst = path.join(dir, "asterisk");
        const dstAst = path.join(newDir, "asterisk");
        if (fs.existsSync(srcAst)) {
          if (!fs.existsSync(dstAst)) fs.mkdirSync(dstAst, { recursive: true });
          for (const ent of fs.readdirSync(srcAst, { withFileTypes: true })) {
            if (ent.isFile()) {
              fs.copyFileSync(path.join(srcAst, ent.name), path.join(dstAst, ent.name));
            }
          }
        }
      }
    }
    return created;
  }
  const created = createDeployment({
    type: "sts",
    name: name ?? `${current.name} Copy`,
    providers: { sts: current.providers.sts as STSProviderId },
  });
  return created;
}

export function deleteDeployment(id: string): boolean {
  const dir = findDeploymentDirById(id);
  if (!dir) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

// --- Preflight results persistence ------------------------------------------

function writeJsonAtomic(filePath: string, data: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, `${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tempPath, data, { encoding: "utf8" });
  fs.renameSync(tempPath, filePath);
}

export function getPreflightFilePathByDeploymentId(id: string): string | null {
  const dir = findDeploymentDirById(id);
  if (!dir) return null;
  return path.join(dir, "preflight.json");
}

export function readPreflightResultByDeploymentId(id: string): PreflightResult | null {
  const file = getPreflightFilePathByDeploymentId(id);
  if (!file || !fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as PreflightResult;
  } catch {
    return null;
  }
}

export function writePreflightResultByDeploymentId(id: string, result: PreflightResult): void {
  const file = getPreflightFilePathByDeploymentId(id);
  if (!file) throw new Error("Deployment not found");
  const json = JSON.stringify(result, null, 2);
  writeJsonAtomic(file, json);
}
