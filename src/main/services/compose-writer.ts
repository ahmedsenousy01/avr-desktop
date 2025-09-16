import fs from "node:fs";
import path from "node:path";
import type { AsteriskConfig } from "../../shared/types/asterisk";
import type { Deployment } from "../../shared/types/deployments";
import type { Providers } from "../../shared/types/providers";
import type { ServiceFragmentId } from "./template-registry";

import { DEFAULT_ASTERISK_CONFIG } from "../../shared/types/asterisk";
import { getProviderApiKey } from "../../shared/types/providers";
import { findDeploymentDirById } from "./deployments-store";
import { getFragmentsForModularSelection, getFragmentsForStsSelection } from "./template-registry";

// Known images from example compose files
const FRAGMENT_IMAGE: Partial<Record<ServiceFragmentId, string>> = {
  core: "agentvoiceresponse/avr-core",
  asterisk: "agentvoiceresponse/avr-asterisk",
  ami: "agentvoiceresponse/avr-ami",
  "asr-deepgram": "agentvoiceresponse/avr-asr-deepgram",
  "asr-google": "agentvoiceresponse/avr-asr-google-cloud-speech",
  "asr-vosk": "agentvoiceresponse/avr-asr-vosk",
  "tts-google": "agentvoiceresponse/avr-tts-google-cloud-tts",
  "llm-openai": "agentvoiceresponse/avr-llm-openai",
  "llm-anthropic": "agentvoiceresponse/avr-llm-anthropic",
  "sts-openai-realtime": "agentvoiceresponse/avr-sts-openai",
  "sts-ultravox": "agentvoiceresponse/avr-sts-ultravox",
  "sts-gemini": "agentvoiceresponse/avr-sts-gemini",
  // Note: tts-elevenlabs and llm-gemini images are not present in examples; omit to avoid guessing
};

// Narrow types for the generated compose spec for clarity and DRY usage.
export interface ComposeService {
  container_name?: string;
  image?: string;
  platform?: string;
  restart?: string;
  environment?: Record<string, string>;
  ports?: (string | number)[];
  volumes?: string[];
  networks?: Record<string, { aliases?: string[] }>;
}

export interface ComposeSpec {
  version?: string;
  services: Record<string, ComposeService>;
  networks: Record<string, { name?: string; driver?: string }>;
}

export interface ComposeBuildResult {
  spec: ComposeSpec;
  yaml: string;
}

export function buildComposeObject(
  deployment: Deployment,
  providers: Providers,
  asteriskConfig?: AsteriskConfig
): ComposeBuildResult {
  let fragments: ServiceFragmentId[];
  if (deployment.type === "modular") {
    const { llm, asr, tts } = deployment.providers;
    if (!llm || !asr || !tts) throw new Error("Missing providers for modular deployment");
    fragments = getFragmentsForModularSelection({ llm, asr, tts });
  } else {
    const { sts } = deployment.providers;
    if (!sts) throw new Error("Missing STS provider for sts deployment");
    fragments = getFragmentsForStsSelection({ sts });
  }

  const named = nameFragments(deployment.slug, fragments);
  const services: ComposeSpec["services"] = {};
  const networkName = deployment.slug;

  for (const nf of named) {
    const env = getEnvForFragment(providers, nf.fragmentId);
    const maybeImage = FRAGMENT_IMAGE[nf.fragmentId];
    const svc: ComposeService = createBaseService(nf.serviceName, nf.aliases, networkName);
    if (maybeImage) svc.image = maybeImage;
    if (Object.keys(env).length > 0) svc.environment = env;

    if (nf.fragmentId === "asterisk") {
      const cfg = asteriskConfig ?? DEFAULT_ASTERISK_CONFIG;
      svc.ports = getAsteriskPortMappings(cfg);
      svc.volumes = getAsteriskConfMounts();
    }

    services[nf.serviceName] = svc;
  }

  const spec = sortKeysDeep({
    services,
    networks: {
      [networkName]: {
        name: networkName,
        driver: "bridge",
      },
    },
  } as ComposeSpec);

  const yaml = renderSortedYaml(spec);
  return { spec, yaml };
}

function createBaseService(serviceName: string, aliases: string[], networkName: string): ComposeService {
  return {
    container_name: serviceName,
    restart: "always",
    networks: {
      [networkName]: { aliases },
    },
  };
}

export function getComposeFilePathByDeploymentId(id: string): string | null {
  const dir = findDeploymentDirById(id);
  if (!dir) return null;
  return path.join(dir, "docker-compose.yml");
}

export function writeComposeFile(
  deployment: Deployment,
  providers: Providers,
  asteriskConfig?: AsteriskConfig
): { filePath: string; changed: boolean } {
  const outPath = getComposeFilePathByDeploymentId(deployment.id);
  if (!outPath) throw new Error("Deployment directory not found");
  const { yaml } = buildComposeObject(deployment, providers, asteriskConfig);
  const next = yaml;
  let changed = true;
  if (fs.existsSync(outPath)) {
    try {
      const current = fs.readFileSync(outPath, "utf8");
      if (current === next) changed = false;
    } catch {
      // fallthrough to write
    }
  }
  if (changed) {
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.docker-compose.yml.tmp-${process.pid}-${Date.now()}`);
    fs.writeFileSync(tmp, next, "utf8");
    fs.renameSync(tmp, outPath);
  }
  return { filePath: outPath, changed };
}

/**
 * Utilities for deterministic compose generation.
 *
 * Sub-task 1.2: Generate service names with `${slug}-*` prefixes and consistent aliases.
 */

/** Returns the deterministic suffix for a given fragment id. */
export function getServiceSuffixForFragment(fragmentId: ServiceFragmentId): string {
  switch (fragmentId) {
    case "core":
      return "core";
    case "asterisk":
      return "asterisk";
    case "ami":
      return "ami";
    case "asr-deepgram":
      return "asr-deepgram";
    case "asr-google":
      return "asr-google";
    case "asr-vosk":
      return "asr-vosk";
    case "tts-elevenlabs":
      return "tts-elevenlabs";
    case "tts-google":
      return "tts-google";
    case "llm-openai":
      return "llm-openai";
    case "llm-anthropic":
      return "llm-anthropic";
    case "llm-gemini":
      return "llm-gemini";
    case "sts-openai-realtime":
      return "sts-openai";
    case "sts-ultravox":
      return "sts-ultravox";
    case "sts-gemini":
      return "sts-gemini";
    default: {
      const neverCheck: never = fragmentId;
      throw new Error(`Unhandled fragment: ${String(neverCheck)}`);
    }
  }
}

/** Builds the canonical service name `${slug}-${suffix}` for a fragment. */
export function makeServiceName(slug: string, fragmentId: ServiceFragmentId): string {
  const suffix = getServiceSuffixForFragment(fragmentId);
  return `${slug}-${suffix}`;
}

/** Returns a generic role alias used for DNS/network aliasing within the stack. */
export function getRoleAlias(fragmentId: ServiceFragmentId): string {
  if (fragmentId === "core") return "core";
  if (fragmentId === "asterisk") return "asterisk";
  if (fragmentId === "ami") return "ami";
  if (fragmentId.startsWith("asr-")) return "asr";
  if (fragmentId.startsWith("tts-")) return "tts";
  if (fragmentId.startsWith("llm-")) return "llm";
  if (fragmentId.startsWith("sts-")) return "sts";
  return "service";
}

export interface NamedFragment {
  fragmentId: ServiceFragmentId;
  serviceName: string;
  /**
   * Deterministic alias list:
   * - First: generic role alias (e.g., "llm", "asr", "tts", "sts", "asterisk", "ami", "core").
   * - Second: serviceName (for explicit aliasing when using custom network names).
   */
  aliases: string[];
}

/**
 * Given an ordered list of fragments, returns a stable list of named fragments
 * with canonical service names and aliases.
 */
export function nameFragments(slug: string, fragments: ServiceFragmentId[]): NamedFragment[] {
  return fragments.map((fragmentId) => {
    const serviceName = makeServiceName(slug, fragmentId);
    const roleAlias = getRoleAlias(fragmentId);
    return { fragmentId, serviceName, aliases: [roleAlias, serviceName] };
  });
}

// ----- Sub-task 1.3: Provider env injection -----

export type EnvMap = Record<string, string>;

/**
 * Returns only the env vars that can be resolved from providers JSON for the fragment.
 * Keys not backed by providers JSON (e.g., GOOGLE_APPLICATION_CREDENTIALS, ULTRAVOX_* agent ids)
 * are intentionally omitted here and handled in later tasks (mounts/validation).
 */
export function getEnvForFragment(providers: Providers, fragmentId: ServiceFragmentId): EnvMap {
  switch (fragmentId) {
    case "llm-openai":
    case "sts-openai-realtime":
      return withIfSet("OPENAI_API_KEY", getProviderApiKey(providers, "openai"));

    case "llm-anthropic":
      return withIfSet("ANTHROPIC_API_KEY", getProviderApiKey(providers, "anthropic"));

    case "llm-gemini":
      return withIfSet("GEMINI_API_KEY", getProviderApiKey(providers, "gemini"));
    case "sts-gemini":
      return withIfSet("GEMINI_API_KEY", getProviderApiKey(providers, "gemini"));

    case "asr-deepgram":
      return withIfSet("DEEPGRAM_API_KEY", getProviderApiKey(providers, "deepgram"));

    case "tts-elevenlabs":
      return withIfSet("ELEVENLABS_API_KEY", getProviderApiKey(providers, "elevenlabs"));

    // Fragments that require non-API-key material or are not part of providers JSON in MVP
    case "asr-google":
    case "tts-google":
    case "sts-ultravox":
    case "core":
    case "asterisk":
    case "ami":
    case "asr-vosk":
      return {};

    default: {
      const neverCheck: never = fragmentId;
      throw new Error(`Unhandled fragment for env injection: ${String(neverCheck)}`);
    }
  }
}

function withIfSet(key: string, value: string): EnvMap {
  return value ? { [key]: value } : {};
}

// ----- Sub-task 1.4: Asterisk mounts and ports -----

/**
 * Returns read-only bind mounts for Asterisk configuration files, relative to
 * the deployment directory. Paths match the example compose files.
 */
export function getAsteriskConfMounts(): string[] {
  return [
    "./asterisk/manager.conf:/etc/asterisk/my_manager.conf:ro",
    "./asterisk/pjsip.conf:/etc/asterisk/my_pjsip.conf:ro",
    "./asterisk/extensions.conf:/etc/asterisk/my_extensions.conf:ro",
    "./asterisk/queues.conf:/etc/asterisk/my_queues.conf:ro",
    "./asterisk/ari.conf:/etc/asterisk/my_ari.conf:ro",
  ];
}

/**
 * Deterministic port mappings for the Asterisk service based on the provided
 * AsteriskConfig. Includes:
 * - AMI (5038/tcp)
 * - SIP signaling at configured sipPort (tcp by example convention)
 * - HTTP/ARI (8088/tcp)
 * - RTP UDP range from rtpStart to rtpEnd
 */
export function getAsteriskPortMappings(config: AsteriskConfig): string[] {
  const ports: string[] = [];
  // AMI
  ports.push("5038:5038");
  // SIP signaling
  ports.push(`${config.sipPort}:${config.sipPort}`);
  // HTTP/ARI
  ports.push("8088:8088");
  // RTP range (udp)
  const start = Math.min(config.rtpStart, config.rtpEnd);
  const end = Math.max(config.rtpStart, config.rtpEnd);
  ports.push(`${start}-${end}:${start}-${end}/udp`);
  return ports;
}

// ----- Sub-task 1.5: Deterministic YAML sorting and serialization -----

/** Recursively sorts object keys to ensure stable ordering across runs. */
export function sortKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => sortKeysDeep(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const k of keys) {
      sorted[k] = sortKeysDeep(obj[k]);
    }
    return sorted as unknown as T;
  }
  return value;
}

/** Minimal YAML emitter with stable formatting for objects/arrays/scalars. */
export function renderSortedYaml(input: unknown): string {
  const sorted = sortKeysDeep(input);
  return toYaml(sorted, 0) + "\n";
}

function toYaml(value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return quoteString(value);
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        const rendered = toYaml(item, indent + 1);
        if (isScalar(item) || isInline(rendered)) {
          return `${pad}- ${rendered}`;
        }
        // Non-inline nested structure
        return `${pad}-\n${rendered}`;
      })
      .join("\n");
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    return keys
      .map((k) => {
        const v = obj[k];
        const rendered = toYaml(v, indent + 1);
        if (isScalar(v)) {
          return `${pad}${k}: ${rendered}`;
        }
        return `${pad}${k}:\n${toYaml(v, indent + 1)}`;
      })
      .join("\n");
  }

  return "null";
}

function isScalar(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "bigint" ||
    typeof v === "boolean"
  );
}

function isInline(rendered: string): boolean {
  return !rendered.includes("\n");
}

function quoteString(s: string): string {
  // Quote all strings for stability; escape backslashes and quotes
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

// ----- Service name -> role mapping (task 3.1) -----

export type LogicalRole = "core" | "asterisk" | "ami" | "asr" | "tts" | "llm" | "sts" | "service";

/**
 * Given a full service name like `${slug}-llm-openai`, returns its logical role.
 * Falls back to "service" when it cannot be determined.
 */
export function getRoleForServiceName(serviceName: string, slug: string): LogicalRole {
  const prefix = `${slug}-`;
  if (serviceName.startsWith(prefix)) {
    const suffix = serviceName.slice(prefix.length);
    if (suffix === "core" || suffix === "asterisk" || suffix === "ami") return suffix;
    if (suffix.startsWith("asr-")) return "asr";
    if (suffix.startsWith("tts-")) return "tts";
    if (suffix.startsWith("llm-")) return "llm";
    if (suffix.startsWith("sts-")) return "sts";
  }
  return "service";
}
