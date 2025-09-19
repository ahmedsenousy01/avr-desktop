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
  const asteriskServiceName = named.find((f) => f.fragmentId === "asterisk")?.serviceName;

  for (const nf of named) {
    const env = getEnvForFragment(providers, nf.fragmentId);
    const maybeImage = FRAGMENT_IMAGE[nf.fragmentId];
    const svc: ComposeService = createBaseService(nf.serviceName, nf.aliases, networkName);
    if (maybeImage) svc.image = maybeImage;

    if (nf.fragmentId === "asterisk") {
      const cfg = asteriskConfig ?? DEFAULT_ASTERISK_CONFIG;
      svc.ports = getAsteriskPortMappings(cfg);
      svc.volumes = getAsteriskConfMounts();
      // Gemini STS example serves a static phone UI from Asterisk HTTP server
      if (fragments.includes("sts-gemini")) {
        svc.volumes = [...(svc.volumes ?? []), "./phone:/var/lib/asterisk/static-http/phone"];
      }
    }

    // Inject env/ports/volumes from example files for all fragments
    if (nf.fragmentId === "ami") {
      env.PORT = "6006";
      env.AMI_HOST = asteriskServiceName ?? "asterisk";
      env.AMI_PORT = "5038";
      env.AMI_USERNAME = "avr";
      env.AMI_PASSWORD = "avr";
      // STS examples expose AMI port on host (6006:6006)
      if (deployment.type === "sts") {
        svc.ports = ["6006:6006"];
      }
    }

    if (nf.fragmentId === "core") {
      // Core always exposes 5001 and either STS_URL (sts) or ASR/LLM/TTS URLs (modular)
      env.PORT = "5001";
      // Determine companion services
      const byId = new Map<ServiceFragmentId, string>(named.map((x) => [x.fragmentId, x.serviceName] as const));
      if (deployment.type === "sts") {
        // Map STS fragment -> default port from examples
        const stsId = fragments.find((f) => f.startsWith("sts-")) as ServiceFragmentId | undefined;
        const stsService = stsId ? byId.get(stsId) : undefined;
        const stsPort =
          stsId === "sts-openai-realtime"
            ? 6030
            : stsId === "sts-ultravox"
              ? 6031
              : stsId === "sts-gemini"
                ? 6037
                : undefined;
        if (stsService && stsPort) {
          env.STS_URL = `ws://${stsService}:${String(stsPort)}`;
        }
      } else {
        // Modular pipeline URLs and sensible defaults from examples
        const asrId = fragments.find((f) => f.startsWith("asr-")) as ServiceFragmentId | undefined;
        const llmId = fragments.find((f) => f.startsWith("llm-")) as ServiceFragmentId | undefined;
        const ttsId = fragments.find((f) => f.startsWith("tts-")) as ServiceFragmentId | undefined;

        if (asrId) {
          const asrService = byId.get(asrId);
          const asrPort = asrId === "asr-google" ? 6001 : 6010; // deepgram/vosk 6010 by examples
          env.ASR_URL = `http://${asrService}:${String(asrPort)}/speech-to-text-stream`;
        }
        if (llmId) {
          const llmService = byId.get(llmId);
          const llmPort = llmId === "llm-openai" ? 6002 : llmId === "llm-anthropic" ? 6014 : undefined;
          if (llmPort) env.LLM_URL = `http://${llmService}:${String(llmPort)}/prompt-stream`;
        }
        if (ttsId) {
          const ttsService = byId.get(ttsId);
          const ttsPort = ttsId === "tts-google" ? 6003 : undefined;
          if (ttsPort) env.TTS_URL = `http://${ttsService}:${String(ttsPort)}/text-to-speech-stream`;
        }
        // Defaults used in examples
        env.INTERRUPT_LISTENING = asrId === "asr-google" ? "false" : "true";
        env.SYSTEM_MESSAGE = env.SYSTEM_MESSAGE ?? "Hello, how can I help you today?";
      }
      svc.ports = ["5001:5001"];
    }

    // STS providers (examples): add ports and defaults
    if (nf.fragmentId === "sts-openai-realtime") {
      env.PORT = env.PORT ?? "6030";
      env.OPENAI_MODEL = env.OPENAI_MODEL ?? "gpt-4o-realtime-preview";
      env.OPENAI_INSTRUCTIONS = env.OPENAI_INSTRUCTIONS ?? "You are a helpful assistant.";
      const amiService = named.find((x) => x.fragmentId === "ami")?.serviceName ?? "ami";
      env.AMI_URL = env.AMI_URL ?? `http://${amiService}:6006`;
    }
    if (nf.fragmentId === "sts-gemini") {
      env.PORT = env.PORT ?? "6037";
      const amiService = named.find((x) => x.fragmentId === "ami")?.serviceName ?? "ami";
      env.AMI_URL = env.AMI_URL ?? `http://${amiService}:6006`;
      // Set default model to native audio dialogue model and system prompt
      env.GEMINI_MODEL = env.GEMINI_MODEL ?? "gemini-2.5-flash-preview-native-audio-dialog";
      env.GEMINI_INSTRUCTIONS =
        env.GEMINI_INSTRUCTIONS ??
        "You are a helpful AI assistant capable of natural conversation. Respond naturally and conversationally, as if speaking to a friend. Keep responses concise but engaging, and feel free to ask clarifying questions when needed.";
    }
    if (nf.fragmentId === "sts-ultravox") {
      env.PORT = env.PORT ?? "6031";
      // Keys not managed via providers; include placeholders so users notice
      env.ULTRAVOX_AGENT_ID = env.ULTRAVOX_AGENT_ID ?? "";
      env.ULTRAVOX_API_KEY = env.ULTRAVOX_API_KEY ?? "";
    }

    // LLM services (modular examples)
    if (nf.fragmentId === "llm-openai") {
      env.PORT = env.PORT ?? "6002";
      env.OPENAI_MODEL = env.OPENAI_MODEL ?? "gpt-3.5-turbo";
      env.OPENAI_MAX_TOKENS = env.OPENAI_MAX_TOKENS ?? "100";
      env.OPENAI_TEMPERATURE = env.OPENAI_TEMPERATURE ?? "0.0";
      env.SYSTEM_PROMPT = env.SYSTEM_PROMPT ?? "You are a helpful assistant.";
      const amiService = named.find((x) => x.fragmentId === "ami")?.serviceName ?? "ami";
      env.AMI_URL = env.AMI_URL ?? `http://${amiService}:6006`;
      // Tools mount used by example for custom tools
      svc.volumes = [...(svc.volumes ?? []), "./tools:/usr/src/app/tools"];
    }
    if (nf.fragmentId === "llm-anthropic") {
      env.PORT = env.PORT ?? "6014";
      env.ANTHROPIC_MODEL = env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20240620";
      env.ANTHROPIC_MAX_TOKENS = env.ANTHROPIC_MAX_TOKENS ?? "1024";
      env.ANTHROPIC_TEMPERATURE = env.ANTHROPIC_TEMPERATURE ?? "1";
      env.ANTHROPIC_SYSTEM_PROMPT = env.ANTHROPIC_SYSTEM_PROMPT ?? "You are a helpful assistant.";
      const amiService = named.find((x) => x.fragmentId === "ami")?.serviceName ?? "ami";
      env.AMI_URL = env.AMI_URL ?? `http://${amiService}:6006`;
    }

    // ASR services (modular examples)
    if (nf.fragmentId === "asr-deepgram") {
      env.PORT = env.PORT ?? "6010";
      env.SPEECH_RECOGNITION_LANGUAGE = env.SPEECH_RECOGNITION_LANGUAGE ?? "en-US";
      env.SPEECH_RECOGNITION_MODEL = env.SPEECH_RECOGNITION_MODEL ?? "nova-2-phonecall";
    }
    if (nf.fragmentId === "asr-google") {
      env.PORT = env.PORT ?? "6001";
      env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_APPLICATION_CREDENTIALS ?? "/usr/src/app/google.json";
      env.SPEECH_RECOGNITION_LANGUAGE = env.SPEECH_RECOGNITION_LANGUAGE ?? "en-US";
      env.SPEECH_RECOGNITION_MODEL = env.SPEECH_RECOGNITION_MODEL ?? "telephony";
      svc.volumes = [...(svc.volumes ?? []), "./google.json:/usr/src/app/google.json"];
    }
    if (nf.fragmentId === "asr-vosk") {
      env.PORT = env.PORT ?? "6010";
      env.MODEL_PATH = env.MODEL_PATH ?? "model";
      svc.volumes = [...(svc.volumes ?? []), "./model:/usr/src/app/model"];
    }

    // TTS services (modular examples)
    if (nf.fragmentId === "tts-google") {
      env.PORT = env.PORT ?? "6003";
      env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_APPLICATION_CREDENTIALS ?? "/usr/src/app/google.json";
      env.TEXT_TO_SPEECH_LANGUAGE = env.TEXT_TO_SPEECH_LANGUAGE ?? "en-US";
      env.TEXT_TO_SPEECH_GENDER = env.TEXT_TO_SPEECH_GENDER ?? "FEMALE";
      env.TEXT_TO_SPEECH_NAME = env.TEXT_TO_SPEECH_NAME ?? "en-US-Chirp-HD-F";
      env.TEXT_TO_SPEECH_SPEAKING_RATE = env.TEXT_TO_SPEECH_SPEAKING_RATE ?? "1.0";
      svc.volumes = [...(svc.volumes ?? []), "./google.json:/usr/src/app/google.json"];
    }

    // Assign env at the end so additions above are captured
    if (Object.keys(env).length > 0) svc.environment = env;

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
