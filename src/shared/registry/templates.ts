import type { KeysByRole } from "./images";

/**
 * Template registry built from available images and example compose stacks.
 * - Uses role-scoped image keys to guarantee compile-time safety
 * - Encodes whether a template is currently functional in the app
 */

export type StackType = "modular" | "sts" | "integration";

export const TEMPLATE_IDS = [
  "openai",
  "anthropic",
  "gemini",
  "google",
  "deepgram",
  "vosk",
  "openai-realtime",
  "ultravox",
  "gemini-sts",
  "deepgram-sts",
  "elevenlabs-sts",
  "n8n",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type ModularTemplateSpec = {
  id: TemplateId;
  stackType: "modular";
  functional: boolean;
  images: Partial<{
    asr: KeysByRole<"asr">;
    tts: KeysByRole<"tts">;
    llm: KeysByRole<"llm">;
  }>;
};

export type StsTemplateSpec = {
  id: TemplateId;
  stackType: "sts";
  functional: boolean;
  images: {
    sts: KeysByRole<"sts">;
  };
};

export type IntegrationTemplateSpec = {
  id: TemplateId;
  stackType: "integration";
  functional: boolean;
  images: {
    infra: KeysByRole<"infra">;
  };
};

export type TemplateSpec = ModularTemplateSpec | StsTemplateSpec | IntegrationTemplateSpec;

export const TEMPLATES = {
  // Modular LLM-focused stacks
  openai: {
    id: "openai",
    stackType: "modular",
    functional: true,
    images: {
      asr: "avr-asr-deepgram" as KeysByRole<"asr">,
      tts: "avr-tts-deepgram" as KeysByRole<"tts">,
      llm: "avr-llm-openai" as KeysByRole<"llm">,
    },
  },
  anthropic: {
    id: "anthropic",
    stackType: "modular",
    functional: true,
    images: {
      asr: "avr-asr-deepgram" as KeysByRole<"asr">,
      tts: "avr-tts-deepgram" as KeysByRole<"tts">,
      llm: "avr-llm-anthropic" as KeysByRole<"llm">,
    },
  },
  // Gemini (modular) via OpenRouter LLM image (default model is Gemini)
  gemini: {
    id: "gemini",
    stackType: "modular",
    functional: true,
    images: { llm: "avr-llm-openrouter" as KeysByRole<"llm"> },
  },

  // Modular ASR/TTS-focused stacks from examples
  google: {
    id: "google",
    stackType: "modular",
    functional: true,
    images: {
      asr: "avr-asr-google-cloud-speech" as KeysByRole<"asr">,
      tts: "avr-tts-google-cloud-tts" as KeysByRole<"tts">,
    },
  },
  deepgram: {
    id: "deepgram",
    stackType: "modular",
    functional: true,
    images: {
      asr: "avr-asr-deepgram" as KeysByRole<"asr">,
      tts: "avr-tts-deepgram" as KeysByRole<"tts">,
    },
  },
  vosk: {
    id: "vosk",
    stackType: "modular",
    functional: true,
    images: {
      asr: "avr-asr-vosk" as KeysByRole<"asr">,
      tts: "avr-tts-deepgram" as KeysByRole<"tts">,
      llm: "avr-llm-anthropic" as KeysByRole<"llm">,
    },
  },

  // STS stacks
  "openai-realtime": {
    id: "openai-realtime",
    stackType: "sts",
    functional: true,
    images: { sts: "avr-sts-openai" as KeysByRole<"sts"> },
  },
  ultravox: {
    id: "ultravox",
    stackType: "sts",
    functional: true,
    images: { sts: "avr-sts-ultravox" as KeysByRole<"sts"> },
  },
  "gemini-sts": {
    id: "gemini-sts",
    stackType: "sts",
    functional: true,
    images: { sts: "avr-sts-gemini" as KeysByRole<"sts"> },
  },
  "deepgram-sts": {
    id: "deepgram-sts",
    stackType: "sts",
    functional: true,
    images: { sts: "avr-sts-deepgram" as KeysByRole<"sts"> },
  },
  "elevenlabs-sts": {
    id: "elevenlabs-sts",
    stackType: "sts",
    functional: true,
    images: { sts: "avr-sts-elevenlabs" as KeysByRole<"sts"> },
  },

  // Integrations
  n8n: {
    id: "n8n",
    stackType: "modular",
    functional: true,
    images: {
      asr: "avr-asr-deepgram" as KeysByRole<"asr">,
      tts: "avr-tts-deepgram" as KeysByRole<"tts">,
      llm: "avr-llm-n8n" as KeysByRole<"llm">,
    },
  },
} as const satisfies Readonly<Record<TemplateId, TemplateSpec>>;

export type FunctionalTemplateId = {
  [K in TemplateId]: (typeof TEMPLATES)[K] extends { functional: true } ? K : never;
}[TemplateId];
