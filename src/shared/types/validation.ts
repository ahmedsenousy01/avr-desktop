/**
 * Selection validation helpers for modular and STS stacks.
 * These are independent of provider credential storage; some selection ids
 * (e.g., 'google', 'vosk', 'openai-realtime', 'ultravox') may not require
 * stored API keys in the MVP.
 */

import { z } from "zod/v4";

export const LLM_PROVIDER_IDS = ["openai", "anthropic", "gemini"] as const;
export type LLMProviderId = (typeof LLM_PROVIDER_IDS)[number];

export const ASR_PROVIDER_IDS = ["deepgram", "google", "vosk"] as const;
export type ASRProviderId = (typeof ASR_PROVIDER_IDS)[number];

export const TTS_PROVIDER_IDS = ["elevenlabs", "google"] as const;
export type TTSProviderId = (typeof TTS_PROVIDER_IDS)[number];

export const STS_PROVIDER_IDS = ["openai-realtime", "ultravox"] as const;
export type STSProviderId = (typeof STS_PROVIDER_IDS)[number];

export interface ModularSelection {
  llm: LLMProviderId;
  asr: ASRProviderId;
  tts: TTSProviderId;
}

export interface StsSelection {
  sts: STSProviderId;
}

export const LLMProviderIdSchema = z.enum(LLM_PROVIDER_IDS);
export const ASRProviderIdSchema = z.enum(ASR_PROVIDER_IDS);
export const TTSProviderIdSchema = z.enum(TTS_PROVIDER_IDS);
export const STSProviderIdSchema = z.enum(STS_PROVIDER_IDS);

export const ModularSelectionSchema = z.object({
  llm: LLMProviderIdSchema,
  asr: ASRProviderIdSchema,
  tts: TTSProviderIdSchema,
});

export const StsSelectionSchema = z.object({
  sts: STSProviderIdSchema,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidModularSelection(input: unknown): input is ModularSelection {
  if (!isPlainObject(input)) return false;
  return ModularSelectionSchema.safeParse(input).success;
}

export function isValidStsSelection(input: unknown): input is StsSelection {
  if (!isPlainObject(input)) return false;
  return StsSelectionSchema.safeParse(input).success;
}

/**
 * Optional cross-field compatibility checks for modular selections.
 * Returns an array of human-readable issues. Empty array means compatible.
 *
 * Note: The MVP has no documented incompatible combinations in the PRD.
 * This function exists as an extension point to encode future rules
 * (e.g., VAD requirements or provider-specific constraints).
 */
export interface CompatibilityIssue {
  code: string;
  message: string;
}

export function getModularCompatibilityIssues(_selection: ModularSelection): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];

  // Placeholder for future rules. Example pattern:
  // if (selection.asr === "vosk" && selection.tts === "google") {
  //   issues.push({ code: "ASR_TTS_COMBO", message: "Vosk with Google TTS requires VAD option X." });
  // }

  return issues;
}

export function isModularSelectionCompatible(selection: ModularSelection): boolean {
  return getModularCompatibilityIssues(selection).length === 0;
}
