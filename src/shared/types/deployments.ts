import type { AsteriskConfig } from "./asterisk";
import type { ASRProviderId, LLMProviderId, STSProviderId, TTSProviderId } from "./validation";
import { z } from "zod/v4";

import { AsteriskConfigSchema } from "./asterisk";
import { ASR_PROVIDER_IDS, LLM_PROVIDER_IDS, STS_PROVIDER_IDS, TTS_PROVIDER_IDS } from "./validation";

export type DeploymentType = "modular" | "sts";

export interface DeploymentProviders {
  llm?: LLMProviderId;
  asr?: ASRProviderId;
  tts?: TTSProviderId;
  sts?: STSProviderId;
}

export interface Deployment {
  id: string;
  name: string;
  slug: string;
  type: DeploymentType;
  providers: DeploymentProviders;
  asterisk?: AsteriskConfig;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface DeploymentValidationResult {
  valid: boolean;
  errors: string[];
}

// Zod schemas for deployments
const DeploymentProvidersSchema = z.object({
  llm: z.enum(LLM_PROVIDER_IDS).optional(),
  asr: z.enum(ASR_PROVIDER_IDS).optional(),
  tts: z.enum(TTS_PROVIDER_IDS).optional(),
  sts: z.enum(STS_PROVIDER_IDS).optional(),
});

const BaseDeploymentSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.enum(["modular", "sts"] as const),
  providers: DeploymentProvidersSchema,
  asterisk: AsteriskConfigSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DeploymentSchema = BaseDeploymentSchema.superRefine((val, ctx) => {
  // Unknown keys inside providers are already prevented by zod schema
  if (val.type === "modular") {
    if (!val.providers.llm)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "providers.llm must be a string for modular deployments",
        path: ["providers", "llm"],
      });
    if (!val.providers.asr)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "providers.asr must be a string for modular deployments",
        path: ["providers", "asr"],
      });
    if (!val.providers.tts)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "providers.tts must be a string for modular deployments",
        path: ["providers", "tts"],
      });
    if (val.providers.sts !== undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "providers.sts must not be set for modular deployments",
        path: ["providers", "sts"],
      });
  }
  if (val.type === "sts") {
    if (!val.providers.sts)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "providers.sts must be a string for sts deployments",
        path: ["providers", "sts"],
      });
    if (val.providers.llm !== undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "providers.llm must not be set for sts deployments",
        path: ["providers", "llm"],
      });
    if (val.providers.asr !== undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "providers.asr must not be set for sts deployments",
        path: ["providers", "asr"],
      });
    if (val.providers.tts !== undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "providers.tts must not be set for sts deployments",
        path: ["providers", "tts"],
      });
  }
});

export function validateDeployment(input: unknown): DeploymentValidationResult {
  const parsed = DeploymentSchema.safeParse(input);
  if (parsed.success) return { valid: true, errors: [] };
  return { valid: false, errors: parsed.error.issues.map((i) => i.message) };
}

export function isValidDeployment(input: unknown): input is Deployment {
  return DeploymentSchema.safeParse(input).success;
}
