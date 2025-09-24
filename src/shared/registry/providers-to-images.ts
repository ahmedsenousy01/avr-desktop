import type { ProviderId } from "../../shared/types/providers";
import type { ImageKey, IMAGES } from "./images";
import type { LogicalRole } from "./roles";

export type ProviderToImageByRole = Partial<
  Record<LogicalRole, Partial<Record<ProviderId, ImageKey & keyof typeof IMAGES>>>
>;

// Role-scoped helpers to ensure we only reference existing image keys
function asr<K extends ImageKey>(k: K): K {
  return k;
}
function tts<K extends ImageKey>(k: K): K {
  return k;
}
function llm<K extends ImageKey>(k: K): K {
  return k;
}
function sts<K extends ImageKey>(k: K): K {
  return k;
}

export const PROVIDER_TO_IMAGE: ProviderToImageByRole = {
  asr: {
    deepgram: asr("avr-asr-deepgram"),
    google: asr("avr-asr-google-cloud-speech"),
    vosk: asr("avr-asr-vosk"),
  },
  tts: {
    deepgram: tts("avr-tts-deepgram"),
    google: tts("avr-tts-google-cloud-tts"),
  },
  llm: {
    openai: llm("avr-llm-openai"),
    anthropic: llm("avr-llm-anthropic"),
    openrouter: llm("avr-llm-openrouter"),
  },
  sts: {
    openai: sts("avr-sts-openai"),
    deepgram: sts("avr-sts-deepgram"),
    gemini: sts("avr-sts-gemini"),
    elevenlabs: sts("avr-sts-elevenlabs"),
    ultravox: sts("avr-sts-ultravox"),
  },
};
