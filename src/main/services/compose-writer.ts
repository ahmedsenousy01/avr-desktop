import fs from "node:fs";
import path from "node:path";
import type { ImageKey } from "../../shared/registry/images";
import type { AsteriskConfig } from "../../shared/types/asterisk";
import type { Deployment } from "../../shared/types/deployments";
import type { Providers } from "../../shared/types/providers";

import { IMAGES } from "../../shared/registry/images";
import { PROVIDER_TO_IMAGE } from "../../shared/registry/providers-to-images";
import { DEFAULT_ASTERISK_CONFIG } from "../../shared/types/asterisk";
import { getProviderApiKey } from "../../shared/types/providers";
import { ensureDeploymentEnvSeeded, resolveServiceTemplatesInValue } from "./deployment-env-store";
import { findDeploymentDirById } from "./deployments-store";

// Fragment helpers removed; selection is image-key based

type NamedService = {
  imageKey: ImageKey;
  serviceName: string;
  aliases: string[];
};

function nameServicesFromKeys(slug: string, imageKeys: ImageKey[]): NamedService[] {
  return imageKeys.map((imageKey) => {
    const serviceName = `${slug}-${String(imageKey)}`;
    return { imageKey, serviceName, aliases: [serviceName] };
  });
}

// Narrow types for the generated compose spec for clarity and DRY usage.
export interface ComposeService {
  container_name?: string;
  image?: string;
  platform?: string;
  restart?: string;
  environment?: Record<string, string>;
  ports?: (string | number)[];
  volumes?: string[];
  networks?: string[] | Record<string, { aliases?: string[] }>;
}

export interface ComposeSpec {
  version?: string;
  services: Record<string, ComposeService>;
  networks: Record<
    string,
    {
      name?: string;
      driver?: string;
      ipam?: {
        config?: { subnet: string }[];
      };
    }
  >;
}

export interface ComposeBuildResult {
  spec: ComposeSpec;
  yaml: string;
}

export type ComposePlan = {
  slug: string;
  services: { exampleServiceName: string; slugServiceName: string; displayName: string }[];
  values: Record<string, Record<string, string>>; // keyed by example service name
};

/**
 * Builds a compose plan suitable for both compose generation and Env Editor.
 * - Uses slugged service names for actual docker compose services
 * - Returns example service name mapping and resolved env values (placeholders resolved)
 */
export function buildComposePlan(
  deployment: Deployment,
  providers: Providers,
  asteriskConfig?: AsteriskConfig
): ComposePlan {
  const { spec } = buildComposeObject(deployment, providers, asteriskConfig);
  const slug = deployment.slug;

  const services = Object.keys(spec.services).map((slugServiceName) => {
    const prefix = `${slug}-`;
    const suffix = slugServiceName.startsWith(prefix) ? slugServiceName.slice(prefix.length) : slugServiceName;
    const exampleServiceName = `avr-${suffix}`;
    const displayName = slugServiceName;
    return { exampleServiceName, slugServiceName, displayName };
  });

  // Resolve values for each example service name from the materialized env
  const deploymentEnv = ensureDeploymentEnvSeeded(deployment.id);
  const exampleToSlug: Record<string, string> = Object.fromEntries(
    services.map((s) => [s.exampleServiceName, s.slugServiceName])
  );
  const resolveName = (name: string) => exampleToSlug[name] ?? name;

  const values: Record<string, Record<string, string>> = {};
  for (const [exampleServiceName, vars] of Object.entries(deploymentEnv.services)) {
    const resolved: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) {
      resolved[k] = resolveServiceTemplatesInValue(String(v), resolveName);
    }
    values[exampleServiceName] = resolved;
  }

  return { slug, services, values };
}

// Centralized defaults per service fragment.
// Only include stable, example-backed defaults here. Dynamic items are applied below.
// Defaults are derived from IMAGES (defaultEnv/defaultPorts/defaultVolumes)

function getStsWsPortFromKeys(selectedKeys: ImageKey[]): number | null {
  const stsKey = selectedKeys.find((k) => IMAGES[k].role === "sts");
  if (!stsKey) return null;
  return IMAGES[stsKey].wsPort ?? null;
}

function resolveAsrImageKey(asr: keyof NonNullable<typeof PROVIDER_TO_IMAGE.asr>): ImageKey | null {
  return (PROVIDER_TO_IMAGE.asr?.[asr] as ImageKey | undefined) ?? null;
}

function resolveTtsImageKey(tts: keyof NonNullable<typeof PROVIDER_TO_IMAGE.tts>): ImageKey | null {
  if (tts === "elevenlabs") return "avr-tts-deepgram"; // examples use deepgram tts
  return (PROVIDER_TO_IMAGE.tts?.[tts] as ImageKey | undefined) ?? null;
}

function resolveLlmImageKey(llm: keyof NonNullable<typeof PROVIDER_TO_IMAGE.llm> | "gemini"): ImageKey | null {
  if (llm === "gemini") return "avr-llm-openrouter"; // examples use openrouter for gemini models
  return (
    (PROVIDER_TO_IMAGE.llm?.[llm as keyof NonNullable<typeof PROVIDER_TO_IMAGE.llm>] as ImageKey | undefined) ?? null
  );
}

function resolveStsImageKey(sts: "openai-realtime" | "ultravox" | "gemini"): ImageKey | null {
  const map: Record<string, keyof NonNullable<typeof PROVIDER_TO_IMAGE.sts>> = {
    "openai-realtime": "openai",
    ultravox: "ultravox",
    gemini: "gemini",
  };
  const key = map[sts];
  return key ? ((PROVIDER_TO_IMAGE.sts?.[key] as ImageKey | undefined) ?? null) : null;
}

function enforceCoreEnvShape(
  deploymentType: Deployment["type"],
  namedServices: NamedService[],
  env: Record<string, string>
): void {
  if (deploymentType === "sts") {
    delete env["ASR_URL"];
    delete env["LLM_URL"];
    delete env["TTS_URL"];
    // Avoid startup greeting path that uses LLM->TTS in some images
    delete env["SYSTEM_MESSAGE"];
    const sts = namedServices.find((f) => IMAGES[f.imageKey].role === "sts");
    if (sts) {
      const wsPort = getStsWsPortFromKeys(namedServices.map((n) => n.imageKey));
      if (wsPort) env["STS_URL"] = `ws://${sts.serviceName}:${String(wsPort)}`;
    }
  } else {
    delete env["STS_URL"];
  }
}

function filterCoreEnvForDeploymentType(
  deploymentType: Deployment["type"],
  env: Record<string, string>
): Record<string, string> {
  if (deploymentType === "sts") {
    const allowed = new Set(["PORT", "STS_URL", "INTERRUPT_LISTENING"]);
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) if (allowed.has(k)) next[k] = v;
    return next;
  }
  return env;
}

export function buildComposeObject(
  deployment: Deployment,
  providers: Providers,
  asteriskConfig?: AsteriskConfig
): ComposeBuildResult {
  // Build selected image keys based on deployment type
  const baseInfra: ImageKey[] = ["avr-core", "avr-asterisk", "avr-ami"];
  let selected: ImageKey[] = [];
  if (deployment.type === "modular") {
    const { llm, asr, tts } = deployment.providers;
    if (!llm || !asr || !tts) throw new Error("Missing providers for modular deployment");
    const asrKey = resolveAsrImageKey(asr);
    const ttsKey = resolveTtsImageKey(tts);
    const llmKey = resolveLlmImageKey(llm);
    selected = [asrKey, ttsKey, llmKey].filter((k): k is ImageKey => Boolean(k));
  } else {
    const { sts } = deployment.providers;
    if (!sts) throw new Error("Missing STS provider for sts deployment");
    const stsKey = resolveStsImageKey(sts);
    selected = [stsKey].filter((k): k is ImageKey => Boolean(k));
  }

  const orderedKeys: ImageKey[] = [...baseInfra, ...selected];
  const named = nameServicesFromKeys(deployment.slug, orderedKeys);
  const services: ComposeSpec["services"] = {};
  const networkName = deployment.slug;
  const _asteriskServiceName = named.find((f) => f.imageKey === "avr-asterisk")?.serviceName;

  // Load per-deployment environment once and prepare a resolver for service templates
  const deploymentEnv = ensureDeploymentEnvSeeded(deployment.id);
  const exampleServiceNameToActual: Record<string, string> = Object.fromEntries(
    named.map((n) => [String(n.imageKey), n.serviceName] as const)
  );
  const resolveTemplateName = (name: string) => exampleServiceNameToActual[name] ?? name;

  // Fallback resolver for legacy values that still reference raw example hosts (e.g., http://avr-ami:6006)
  const replaceExampleHostsInValue = (value: string): string => {
    return value.replace(/\b(https?:\/\/)(avr-[a-z0-9-]+)(\b|:)/gi, (_m, proto: string, host: string, tail: string) => {
      const actual = exampleServiceNameToActual[host] ?? host;
      return `${proto}${actual}${tail}`;
    });
  };

  // Replace bare example service tokens (e.g., AMI_HOST=avr-asterisk) with slugged names
  const replaceExampleBareTokensInValue = (value: string): string => {
    return value.replace(/\b(avr-[a-z0-9-]+)\b/gi, (match: string, host: string, offset: number) => {
      const prefixStart = Math.max(0, offset - (networkName.length + 1));
      const preceding = value.slice(prefixStart, offset);
      // Avoid double-prefixing when token already appears inside `${slug}-avr-*`
      if (preceding === `${networkName}-`) return match;
      return exampleServiceNameToActual[host] ?? host;
    });
  };

  for (const nf of named) {
    const imageKey = nf.imageKey;
    const env = getEnvForImageKey(providers, imageKey);
    const svc: ComposeService = createBaseService(nf.serviceName, nf.aliases, networkName);
    svc.image = IMAGES[imageKey].dockerImage;

    if (imageKey === "avr-asterisk") {
      const cfg = asteriskConfig ?? DEFAULT_ASTERISK_CONFIG;
      svc.ports = getAsteriskPortMappings(cfg);
      svc.volumes = getAsteriskConfMounts();
      // Gemini STS example serves a static phone UI from Asterisk HTTP server
      if (selected.includes("avr-sts-gemini")) {
        svc.volumes = [...(svc.volumes ?? []), "./phone:/var/lib/asterisk/static-http/phone"];
      }
    }

    // Apply image defaults from registry (except asterisk which has bespoke mounts/ports logic)
    {
      const spec = IMAGES[imageKey];
      if (spec.defaultPorts && imageKey !== "avr-asterisk") {
        svc.ports = [...(svc.ports ?? []), ...spec.defaultPorts];
      }
      if (spec.defaultVolumes && imageKey !== "avr-asterisk") {
        svc.volumes = [...(svc.volumes ?? []), ...spec.defaultVolumes];
      }
      if (spec.defaultEnv) {
        for (const [k, v] of Object.entries(spec.defaultEnv)) env[k] = v;
      }
    }

    // Mode-aware adjustments not expressible in static defaults
    // STS examples expose AMI port on host (6006:6006)
    if (imageKey === "avr-ami" && deployment.type === "sts") {
      svc.ports = ["6006:6006"];
    }

    // STS providers (examples): defaults are seeded via EnvRegistry/DeploymentEnv

    // Assign env at the end so additions above are captured
    // 1) Merge per-service DeploymentEnv values (registry uses example service names like "avr-*")
    const registryServiceName = String(imageKey);
    const userVars = deploymentEnv.services[registryServiceName] ?? {};
    for (const [k, raw] of Object.entries(userVars)) {
      const s = String(raw);
      const templated = resolveServiceTemplatesInValue(s, resolveTemplateName);
      const withHosts = replaceExampleHostsInValue(templated);
      const resolved = replaceExampleBareTokensInValue(withHosts);
      env[k] = resolved;
    }

    // 2) Apply deployment-level overrides last (last-wins)
    if (deployment.environmentOverrides) {
      for (const [k, v] of Object.entries(deployment.environmentOverrides)) {
        env[k] = v;
      }
    }

    // Now enforce core env shape for STS vs modular after merges, so unwanted keys cannot reappear
    if (imageKey === "avr-core") {
      // compute STS_URL from selected STS image key
      const wsPort = getStsWsPortFromKeys(selected);
      if (wsPort)
        env["STS_URL"] = `ws://${named.find((n) => IMAGES[n.imageKey].role === "sts")?.serviceName}:${String(wsPort)}`;
      enforceCoreEnvShape(deployment.type, named, env);
      const filtered = filterCoreEnvForDeploymentType(deployment.type, env);
      // Ensure deployment-level overrides remain visible on core even in STS mode
      if (deployment.environmentOverrides) {
        for (const [k, v] of Object.entries(deployment.environmentOverrides)) {
          filtered[k] = v;
        }
      }
      if (Object.keys(filtered).length > 0) svc.environment = filtered;
    } else {
      if (Object.keys(env).length > 0) svc.environment = env;
    }

    services[nf.serviceName] = svc;
  }

  const spec = sortKeysDeep({
    services,
    networks: {
      [networkName]: {
        name: networkName,
        driver: "bridge",
        ipam: {
          config: [
            {
              subnet: "172.20.0.0/24",
            },
          ],
        },
      },
    },
  } as ComposeSpec);

  const yaml = renderSortedYaml(spec);
  return { spec, yaml };
}

function createBaseService(serviceName: string, aliases: string[], networkName: string): ComposeService {
  return {
    container_name: serviceName,
    platform: "linux/x86_64",
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
// Fragment suffix helper removed with imageKey-based naming

/** Builds the canonical service name `${slug}-${suffix}` for a fragment. */
// makeServiceName no longer used in imageKey-based flow

/** Returns a generic role alias used for DNS/network aliasing within the stack. */
// Fragment-based naming removed in favor of imageKey-based helpers above

// ----- Sub-task 1.3: Provider env injection -----

export type EnvMap = Record<string, string>;

/**
 * Returns only the env vars that can be resolved from providers JSON for the fragment.
 * Keys not backed by providers JSON (e.g., GOOGLE_APPLICATION_CREDENTIALS, ULTRAVOX_* agent ids)
 * are intentionally omitted here and handled in later tasks (mounts/validation).
 */
export function getEnvForImageKey(providers: Providers, imageKey: ImageKey): EnvMap {
  switch (imageKey) {
    case "avr-llm-openai":
    case "avr-sts-openai":
      return withIfSet("OPENAI_API_KEY", getProviderApiKey(providers, "openai"));

    case "avr-llm-anthropic":
      return withIfSet("ANTHROPIC_API_KEY", getProviderApiKey(providers, "anthropic"));

    case "avr-llm-openrouter":
      return withIfSet("GEMINI_API_KEY", getProviderApiKey(providers, "gemini"));
    case "avr-sts-gemini":
      return withIfSet("GEMINI_API_KEY", getProviderApiKey(providers, "gemini"));

    case "avr-asr-deepgram":
      return withIfSet("DEEPGRAM_API_KEY", getProviderApiKey(providers, "deepgram"));

    case "avr-tts-deepgram":
      return withIfSet("ELEVENLABS_API_KEY", getProviderApiKey(providers, "elevenlabs"));

    // Fragments that require non-API-key material or are not part of providers JSON in MVP
    case "avr-asr-google-cloud-speech":
    case "avr-tts-google-cloud-tts":
    case "avr-sts-ultravox":
    case "avr-core":
    case "avr-asterisk":
    case "avr-ami":
    case "avr-asr-vosk":
      return {};

    default: {
      const neverCheck: never = imageKey as never;
      throw new Error(`Unhandled imageKey for env injection: ${String(neverCheck)}`);
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
    "./asterisk/conf/manager.conf:/etc/asterisk/my_manager.conf",
    "./asterisk/conf/pjsip.conf:/etc/asterisk/my_pjsip.conf",
    "./asterisk/conf/extensions.conf:/etc/asterisk/my_extensions.conf",
    "./asterisk/conf/queues.conf:/etc/asterisk/my_queues.conf",
    "./asterisk/conf/ari.conf:/etc/asterisk/my_ari.conf",
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
