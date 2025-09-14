/**
 * Template registry derived from example compose files under `src/main/infra/examples`.
 * Provides metadata for UI (names, summaries, tags) and lookup helpers.
 *
 * Note: Generation of a deployment skeleton from a template is implemented separately (see task 2.2).
 */

export type StackType = "modular" | "sts" | "integration";

export const TEMPLATE_IDS = [
  "openai",
  "anthropic",
  "google",
  "gemini",
  "deepgram",
  "vosk",
  "elevenlabs",
  "openai-realtime",
  "ultravox",
  "n8n",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface TemplateMeta {
  id: TemplateId;
  displayName: string;
  stackType: StackType;
  exampleCompose: string; // relative path in repo
  summary: string;
  tags: string[];
  badges: string[];
}

export const TEMPLATE_REGISTRY: Readonly<Record<TemplateId, TemplateMeta>> = {
  openai: {
    id: "openai",
    displayName: "OpenAI (Modular)",
    stackType: "modular",
    exampleCompose: "src/main/infra/examples/docker-compose-openai.yml",
    summary: "Modular pipeline using OpenAI for LLM stage.",
    tags: ["llm", "modular"],
    badges: ["Modular", "LLM"],
  },
  anthropic: {
    id: "anthropic",
    displayName: "Anthropic (Modular)",
    stackType: "modular",
    exampleCompose: "src/main/infra/examples/docker-compose-anthropic.yml",
    summary: "Modular pipeline using Anthropic for LLM stage.",
    tags: ["llm", "modular"],
    badges: ["Modular", "LLM"],
  },
  google: {
    id: "google",
    displayName: "Google (Modular)",
    stackType: "modular",
    exampleCompose: "src/main/infra/examples/docker-compose-google.yml",
    summary: "Modular pipeline using Google services (ASR/TTS).",
    tags: ["asr", "tts", "modular"],
    badges: ["Modular", "ASR", "TTS"],
  },
  gemini: {
    id: "gemini",
    displayName: "Gemini (Google) LLM (Modular)",
    stackType: "modular",
    exampleCompose: "src/main/infra/examples/docker-compose-gemini.yml",
    summary: "Modular pipeline using Google Gemini for LLM stage.",
    tags: ["llm", "modular"],
    badges: ["Modular", "LLM"],
  },
  deepgram: {
    id: "deepgram",
    displayName: "Deepgram ASR (Modular)",
    stackType: "modular",
    exampleCompose: "src/main/infra/examples/docker-compose-deepgram.yml",
    summary: "Modular pipeline using Deepgram for ASR.",
    tags: ["asr", "modular"],
    badges: ["Modular", "ASR"],
  },
  vosk: {
    id: "vosk",
    displayName: "Vosk ASR (Modular)",
    stackType: "modular",
    exampleCompose: "src/main/infra/examples/docker-compose-vosk.yml",
    summary: "Modular pipeline using Vosk for ASR.",
    tags: ["asr", "modular"],
    badges: ["Modular", "ASR"],
  },
  elevenlabs: {
    id: "elevenlabs",
    displayName: "ElevenLabs TTS (Modular)",
    stackType: "modular",
    exampleCompose: "src/main/infra/examples/docker-compose-elevenlabs.yml",
    summary: "Modular pipeline using ElevenLabs for TTS.",
    tags: ["tts", "modular"],
    badges: ["Modular", "TTS"],
  },
  "openai-realtime": {
    id: "openai-realtime",
    displayName: "OpenAI Realtime (STS)",
    stackType: "sts",
    exampleCompose: "src/main/infra/examples/docker-compose-openai-realtime.yml",
    summary: "STS stack using OpenAI Realtime bi-directional audio.",
    tags: ["sts"],
    badges: ["STS"],
  },
  ultravox: {
    id: "ultravox",
    displayName: "Ultravox (STS)",
    stackType: "sts",
    exampleCompose: "src/main/infra/examples/docker-compose-ultravox.yml",
    summary: "STS stack using Ultravox for streaming speech.",
    tags: ["sts"],
    badges: ["STS"],
  },
  n8n: {
    id: "n8n",
    displayName: "n8n Integration",
    stackType: "integration",
    exampleCompose: "src/main/infra/examples/docker-compose-n8n.yml",
    summary: "Optional integration template for workflows via n8n.",
    tags: ["integration"],
    badges: ["Integration"],
  },
} as const;

export function getTemplateMeta(id: TemplateId): TemplateMeta {
  return TEMPLATE_REGISTRY[id];
}

export function listTemplates(): TemplateMeta[] {
  return (TEMPLATE_IDS as readonly TemplateId[]).map((id) => TEMPLATE_REGISTRY[id]);
}

export function listTemplatesByStackType(stackType: StackType): TemplateMeta[] {
  return listTemplates().filter((t) => t.stackType === stackType);
}

// ----- Deployment skeleton generation (task 2.2) -----

export type DeploymentSkeleton =
  | {
      type: "modular";
      name?: string;
      providers: {
        llm?: "openai" | "anthropic" | "gemini";
        asr?: "deepgram" | "google" | "vosk";
        tts?: "elevenlabs" | "google";
      };
    }
  | {
      type: "sts";
      name?: string;
      providers: {
        sts: "openai-realtime" | "ultravox";
      };
    };

export function templateToDeployment(templateId: TemplateId, name?: string): DeploymentSkeleton {
  const meta = getTemplateMeta(templateId);

  if (meta.stackType === "sts") {
    const sts = templateId as "openai-realtime" | "ultravox";
    return { type: "sts", name, providers: { sts } };
  }

  if (meta.stackType === "integration") {
    throw new Error("Integration templates do not produce a deployment skeleton");
  }

  // modular
  switch (templateId) {
    case "openai":
      return { type: "modular", name, providers: { llm: "openai" } };
    case "anthropic":
      return { type: "modular", name, providers: { llm: "anthropic" } };
    case "gemini":
      return { type: "modular", name, providers: { llm: "gemini" } };
    case "deepgram":
      return { type: "modular", name, providers: { asr: "deepgram" } };
    case "vosk":
      return { type: "modular", name, providers: { asr: "vosk" } };
    case "elevenlabs":
      return { type: "modular", name, providers: { tts: "elevenlabs" } };
    case "google":
      // Google example commonly provides ASR and TTS; prefill both
      return { type: "modular", name, providers: { asr: "google", tts: "google" } };
    default:
      throw new Error(`Unhandled template id: ${templateId}`);
  }
}
