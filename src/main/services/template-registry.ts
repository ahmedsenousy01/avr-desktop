/**
 * Thin proxy over shared template registry for main-process consumers.
 * Source of truth: src/shared/registry/templates.ts
 */

import type { StackType, TemplateId } from "../../shared/registry/templates";

import { TEMPLATE_IDS, TEMPLATES } from "../../shared/registry/templates";

export type TemplateMeta = (typeof TEMPLATES)[TemplateId];

export function getTemplateMeta(id: TemplateId): TemplateMeta {
  return TEMPLATES[id];
}

export function listTemplates(): TemplateMeta[] {
  return (TEMPLATE_IDS as readonly TemplateId[]).map((id) => TEMPLATES[id]);
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
        tts?: "google";
      };
    }
  | {
      type: "sts";
      name?: string;
      providers: {
        sts: "openai-realtime" | "ultravox" | "gemini";
      };
    };

export function templateToDeployment(templateId: TemplateId, name?: string): DeploymentSkeleton {
  const meta = getTemplateMeta(templateId);

  if (meta.stackType === "sts") {
    const sts = templateId as "openai-realtime" | "ultravox" | "gemini" | "gemini-sts";
    if (sts === "gemini-sts") {
      return { type: "sts", name, providers: { sts: "gemini" } };
    }
    return { type: "sts", name, providers: { sts } };
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
    case "google":
      // Google example commonly provides ASR and TTS; prefill both
      return { type: "modular", name, providers: { asr: "google", tts: "google" } };
    default:
      throw new Error(`Unhandled template id: ${templateId}`);
  }
}
