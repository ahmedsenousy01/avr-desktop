import fs from "node:fs";
import path from "node:path";

import type { DeploymentEnv } from "@shared/types/env";
import { DeploymentEnvSchema } from "@shared/types/env";
import { findDeploymentDirById } from "@main/services/deployments-store";
import { ENV_REGISTRY, ENV_REGISTRY_VERSION } from "@main/services/env-registry";
import { getWorkspaceRoot } from "@main/services/workspace-root";

function findDeploymentDirByIdLenient(id: string): string | null {
  const root = path.join(getWorkspaceRoot(), "deployments");
  if (!fs.existsSync(root)) return null;
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const file = path.join(root, ent.name, "deployment.json");
    if (!fs.existsSync(file)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (parsed && parsed.id === id) return path.join(root, ent.name);
    } catch {
      // ignore invalid json
    }
  }
  return null;
}

export function getDeploymentEnvFilePath(id: string): string | null {
  const dir = findDeploymentDirById(id) ?? findDeploymentDirByIdLenient(id);
  if (!dir) return null;
  return path.join(dir, "environment.json");
}

export function readDeploymentEnv(id: string): DeploymentEnv | null {
  const file = getDeploymentEnvFilePath(id);
  if (!file || !fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf8");
    return DeploymentEnvSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeDeploymentEnv(env: DeploymentEnv): void {
  const file = getDeploymentEnvFilePath(env.deploymentId);
  if (!file) throw new Error("Deployment not found");
  const json = JSON.stringify(env, null, 2);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `environment.json.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmp, json, "utf8");
  fs.renameSync(tmp, file);
}

export function createEmptyDeploymentEnv(id: string): DeploymentEnv {
  return {
    deploymentId: id,
    registryVersion: ENV_REGISTRY_VERSION,
    services: {},
  };
}

// --- Service-name template interpolation -------------------------------------
const SERVICE_HOST_PATTERN = /(https?:\/\/)(avr-[a-z0-9-]+)(\b|:)/i;

export function toServiceTemplate(value: string): string {
  return value.replace(SERVICE_HOST_PATTERN, (_m, proto, svc, tail) => `${proto}{{service:${svc}}}${tail}`);
}

export function resolveServiceTemplatesInValue(value: string, resolver: (serviceName: string) => string): string {
  return value.replace(/\{\{service:([^}]+)\}\}/g, (_m, name) => resolver(String(name)));
}

function identityServiceResolver(name: string): string {
  return name;
}

function buildSeedFromRegistry(id: string): DeploymentEnv {
  // Attempt to read deployment selection for dynamic defaults
  let deploymentSelection: { type?: string; providers?: Record<string, string | undefined> } = {};
  try {
    const dir = findDeploymentDirByIdLenient(id);
    if (dir) {
      const file = path.join(dir, "deployment.json");
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        deploymentSelection = { type: parsed?.type, providers: parsed?.providers ?? {} };
      }
    }
  } catch {
    // ignore
  }

  const seeded: DeploymentEnv = createEmptyDeploymentEnv(id);
  for (const svc of ENV_REGISTRY.services) {
    const baseDefaults = Object.fromEntries(
      svc.variables
        .filter((v) => v.defaultValue !== undefined)
        .map((v) => {
          const raw = String(v.defaultValue);
          const templated = toServiceTemplate(raw);
          const resolved = resolveServiceTemplatesInValue(templated, identityServiceResolver);
          return [v.name, resolved];
        })
    );
    const dynamicDefaults: Record<string, string> = {};
    // Inject dynamic defaults for core URLs based on deployment selection
    if (svc.serviceName === "avr-core") {
      const t = String(deploymentSelection.type ?? "");
      const prov = (deploymentSelection.providers ?? {}) as Record<string, string | undefined>;
      if (t === "sts") {
        const sts = prov["sts"] ?? "";
        // Map provider id -> example service suffix and port
        let exampleSuffix: string | undefined;
        let wsPort: number | undefined;
        if (sts.startsWith("openai")) {
          exampleSuffix = "sts-openai";
          wsPort = 6030;
        } else if (sts.startsWith("ultravox")) {
          exampleSuffix = "sts-ultravox";
          wsPort = 6031;
        } else if (sts.startsWith("gemini")) {
          exampleSuffix = "sts-gemini";
          wsPort = 6037;
        } else if (sts.startsWith("deepgram")) {
          exampleSuffix = "sts-deepgram";
          wsPort = 6033;
        } else if (sts.startsWith("elevenlabs")) {
          exampleSuffix = "sts-elevenlabs";
          wsPort = 6035;
        }
        if (exampleSuffix && wsPort) {
          dynamicDefaults["STS_URL"] = `ws://{{service:avr-${exampleSuffix}}}:${String(wsPort)}`;
        }
      } else if (t === "modular") {
        const asr = prov["asr"];
        const llm = prov["llm"];
        const tts = prov["tts"];
        if (asr) {
          const asrPort = asr === "google" ? 6001 : 6010; // deepgram/vosk 6010
          const asrId = asr === "google" ? "asr-google-cloud-speech" : asr === "deepgram" ? "asr-deepgram" : "asr-vosk";
          dynamicDefaults["ASR_URL"] = `http://{{service:avr-${asrId}}}:${String(asrPort)}/speech-to-text-stream`;
          // Interrupt listening default varies by ASR
          dynamicDefaults["INTERRUPT_LISTENING"] = asr === "google" ? "false" : "true";
        }
        if (llm) {
          const llmPort = llm === "openai" ? 6002 : llm === "anthropic" ? 6014 : undefined;
          const llmId = llm === "openai" ? "llm-openai" : llm === "anthropic" ? "llm-anthropic" : undefined;
          if (llmId && llmPort)
            dynamicDefaults["LLM_URL"] = `http://{{service:avr-${llmId}}}:${String(llmPort)}/prompt-stream`;
        }
        if (tts) {
          const ttsPort = tts === "google" ? 6003 : undefined;
          const ttsId = tts === "google" ? "tts-google-cloud-tts" : undefined;
          if (ttsId && ttsPort)
            dynamicDefaults["TTS_URL"] = `http://{{service:avr-${ttsId}}}:${String(ttsPort)}/text-to-speech-stream`;
        }
      }
    }

    const varsWithDefaults = { ...baseDefaults, ...dynamicDefaults };
    if (Object.keys(varsWithDefaults).length > 0) {
      seeded.services[svc.serviceName] = varsWithDefaults;
    }
  }
  return seeded;
}

export function ensureDeploymentEnvSeeded(id: string): DeploymentEnv {
  const existing = readDeploymentEnv(id);
  if (existing) return existing;
  const seed = buildSeedFromRegistry(id);
  writeDeploymentEnv(seed);
  return seed;
}

export function upsertServiceVariable(
  id: string,
  serviceName: string,
  variableName: string,
  value: string
): DeploymentEnv {
  const env = ensureDeploymentEnvSeeded(id);
  const currentVars = env.services[serviceName] ?? {};
  const next: DeploymentEnv = {
    ...env,
    services: {
      ...env.services,
      [serviceName]: { ...currentVars, [variableName]: value },
    },
  };
  writeDeploymentEnv(next);
  return next;
}

export function removeServiceVariable(id: string, serviceName: string, variableName: string): DeploymentEnv {
  const env = ensureDeploymentEnvSeeded(id);
  const currentVars = env.services[serviceName] ?? {};
  if (!(variableName in currentVars)) return env;
  const { [variableName]: _removed, ...rest } = currentVars;
  const nextServices = { ...env.services } as Record<string, Record<string, string>>;
  if (Object.keys(rest).length === 0) {
    delete nextServices[serviceName];
  } else {
    nextServices[serviceName] = rest;
  }
  const next: DeploymentEnv = { ...env, services: nextServices };
  writeDeploymentEnv(next);
  return next;
}

export type PresenceValidationResult = {
  missingByService: Record<string, string[]>;
};

export function validatePresenceOnly(id: string): PresenceValidationResult {
  const env = ensureDeploymentEnvSeeded(id);
  const missingByService: Record<string, string[]> = {};

  for (const svc of ENV_REGISTRY.services) {
    const current = env.services[svc.serviceName] ?? {};
    const missing: string[] = [];
    for (const meta of svc.variables) {
      if (!meta.required) continue;
      const val = current[meta.name];
      if (!val || String(val).length === 0) {
        missing.push(meta.name);
      }
    }
    if (missing.length > 0) missingByService[svc.serviceName] = missing;
  }

  return { missingByService };
}
