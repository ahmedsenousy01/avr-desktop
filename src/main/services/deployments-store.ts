import fs from "node:fs";
import path from "node:path";

import type { Deployment } from "@shared/types/deployments";
import type { ASRProviderId, LLMProviderId, STSProviderId, TTSProviderId } from "@shared/types/validation";
import { DeploymentSchema } from "@shared/types/deployments";
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

export function updateDeployment(
  id: string,
  patch: { name?: string; providers?: Partial<Deployment["providers"]> }
): Deployment {
  const dir = findDeploymentDirById(id);
  if (!dir) throw new Error("Deployment not found");
  const file = path.join(dir, "deployment.json");
  const current = DeploymentSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  const next: Deployment = {
    ...current,
    name: patch.name ?? current.name,
    providers: { ...current.providers, ...(patch.providers ?? {}) },
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function duplicateDeployment(id: string, name?: string): Deployment {
  const dir = findDeploymentDirById(id);
  if (!dir) throw new Error("Deployment not found");
  const current = DeploymentSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, "deployment.json"), "utf8")));
  if (current.type === "modular") {
    return createDeployment({
      type: "modular",
      name: name ?? `${current.name} Copy`,
      providers: {
        llm: current.providers.llm as LLMProviderId,
        asr: current.providers.asr as ASRProviderId,
        tts: current.providers.tts as TTSProviderId,
      },
    });
  }
  return createDeployment({
    type: "sts",
    name: name ?? `${current.name} Copy`,
    providers: { sts: current.providers.sts as STSProviderId },
  });
}

export function deleteDeployment(id: string): boolean {
  const dir = findDeploymentDirById(id);
  if (!dir) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}
