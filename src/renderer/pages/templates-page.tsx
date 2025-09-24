import React, { useCallback, useMemo, useState } from "react";
import { useBlocker, useNavigate } from "@tanstack/react-router";

import type { TemplateMetaForUI } from "@renderer/components/templates-grid";
import { TEMPLATE_IDS, TEMPLATES } from "@shared/registry/templates";
import { TemplatesGrid } from "@renderer/components/templates-grid";
import { deploymentsCreateFromTemplate } from "@renderer/lib/api";

export const TemplatesPage: React.FC = () => {
  const [creating, setCreating] = useState<string | null>(null);
  const [toast, setToast] = useState<null | { text: string; variant: "success" | "error" }>(null);
  const navigate = useNavigate();
  useBlocker({ shouldBlockFn: () => creating !== null });
  const templates = useMemo<TemplateMetaForUI[]>(() => {
    return TEMPLATE_IDS.map((id) => {
      const t = TEMPLATES[id];
      const displayName = (() => {
        switch (id) {
          case "openai":
            return "OpenAI (Modular)";
          case "anthropic":
            return "Anthropic (Modular)";
          case "gemini":
            return "Gemini (Google) LLM (Modular)";
          case "google":
            return "Google (Modular)";
          case "deepgram":
            return "Deepgram ASR (Modular)";
          case "vosk":
            return "Vosk ASR (Modular)";
          case "openai-realtime":
            return "OpenAI Realtime (STS)";
          case "ultravox":
            return "Ultravox (STS)";
          case "gemini-sts":
            return "Gemini Live (STS)";
          case "deepgram-sts":
            return "Deepgram STS";
          case "elevenlabs-sts":
            return "ElevenLabs STS";
          case "n8n":
            return "n8n Integration";
          default:
            return id;
        }
      })();
      const summary = (() => {
        switch (id) {
          case "openai":
            return "Modular pipeline using OpenAI for LLM stage.";
          case "anthropic":
            return "Modular pipeline using Anthropic for LLM stage.";
          case "gemini":
            return "Modular pipeline using Google Gemini for LLM stage.";
          case "google":
            return "Modular pipeline using Google services (ASR/TTS).";
          case "deepgram":
            return "Modular pipeline using Deepgram for ASR.";
          case "vosk":
            return "Modular pipeline using Vosk for ASR.";
          case "openai-realtime":
            return "STS stack using OpenAI Realtime bi-directional audio.";
          case "ultravox":
            return "STS stack using Ultravox for streaming speech.";
          case "gemini-sts":
            return "STS stack using Gemini Live Speech-to-Speech.";
          case "deepgram-sts":
            return "STS stack using Deepgram Speech-to-Speech.";
          case "elevenlabs-sts":
            return "STS stack using ElevenLabs Speech-to-Speech.";
          case "n8n":
            return "Optional integration template for workflows via n8n.";
          default:
            return "";
        }
      })();
      const badges = (() => {
        const b: string[] = [];
        if (t.stackType === "modular") b.push("Modular");
        if (t.stackType === "sts") b.push("STS");
        if (id === "google") b.push("ASR", "TTS");
        if (id === "deepgram") b.push("ASR");
        if (id === "vosk") b.push("ASR");
        if (id === "openai" || id === "anthropic" || id === "gemini") b.push("LLM");
        if (id === "n8n") b.push("Integration");
        if (!t.functional) b.push("Non-functional");
        return b;
      })();
      return { id, displayName, summary, badges, stackType: t.stackType } satisfies TemplateMetaForUI;
    });
  }, []);

  const handleCreate = useCallback(
    async (templateId: string) => {
      try {
        setCreating(templateId);
        const res = await deploymentsCreateFromTemplate(templateId);
        setToast({ text: `Deployment created: ${res.name}`, variant: "success" });
        navigate({ to: "/deployments" });
      } catch (err) {
        setToast({ text: `Failed to create deployment: ${(err as Error).message}`, variant: "error" });
      } finally {
        setCreating(null);
      }
    },
    [navigate]
  );

  return (
    <div className="p-4">
      <h2 className="mb-3 text-lg font-semibold">Templates</h2>
      <TemplatesGrid
        templates={templates}
        onCreate={handleCreate}
        isCreateDisabled={creating !== null}
        disabledIds={TEMPLATE_IDS.filter((id) => !TEMPLATES[id].functional)}
      />
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={
            "fixed right-4 bottom-4 rounded-lg border px-3 py-2 font-semibold shadow " +
            (toast.variant === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800")
          }
        >
          {toast.text}
        </div>
      )}
    </div>
  );
};
