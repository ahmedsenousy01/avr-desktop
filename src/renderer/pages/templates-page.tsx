import React, { useCallback, useMemo, useState } from "react";
import { useBlocker, useNavigate } from "@tanstack/react-router";

import type { TemplateMetaForUI } from "@renderer/components/templates-grid";
import { TemplatesGrid } from "@renderer/components/templates-grid";
import { deploymentsCreateFromTemplate } from "@renderer/lib/api";

export const TemplatesPage: React.FC = () => {
  const [creating, setCreating] = useState<string | null>(null);
  const [toast, setToast] = useState<null | { text: string; variant: "success" | "error" }>(null);
  const navigate = useNavigate();
  useBlocker({ shouldBlockFn: () => creating !== null });
  const templates = useMemo<TemplateMetaForUI[]>(
    () => [
      {
        id: "openai",
        displayName: "OpenAI (Modular)",
        summary: "Modular pipeline using OpenAI for LLM stage.",
        badges: ["Modular", "LLM"],
        stackType: "modular",
      },
      {
        id: "anthropic",
        displayName: "Anthropic (Modular)",
        summary: "Modular pipeline using Anthropic for LLM stage.",
        badges: ["Modular", "LLM"],
        stackType: "modular",
      },
      {
        id: "gemini",
        displayName: "Gemini (Google) LLM (Modular)",
        summary: "Modular pipeline using Google Gemini for LLM stage.",
        badges: ["Modular", "LLM"],
        stackType: "modular",
      },
      {
        id: "google",
        displayName: "Google (Modular)",
        summary: "Modular pipeline using Google services (ASR/TTS).",
        badges: ["Modular", "ASR", "TTS"],
        stackType: "modular",
      },
      {
        id: "deepgram",
        displayName: "Deepgram ASR (Modular)",
        summary: "Modular pipeline using Deepgram for ASR.",
        badges: ["Modular", "ASR"],
        stackType: "modular",
      },
      {
        id: "vosk",
        displayName: "Vosk ASR (Modular)",
        summary: "Modular pipeline using Vosk for ASR.",
        badges: ["Modular", "ASR"],
        stackType: "modular",
      },
      {
        id: "elevenlabs",
        displayName: "ElevenLabs TTS (Modular)",
        summary: "Modular pipeline using ElevenLabs for TTS.",
        badges: ["Modular", "TTS"],
        stackType: "modular",
      },
      {
        id: "openai-realtime",
        displayName: "OpenAI Realtime (STS)",
        summary: "STS stack using OpenAI Realtime bi-directional audio.",
        badges: ["STS"],
        stackType: "sts",
      },
      {
        id: "ultravox",
        displayName: "Ultravox (STS)",
        summary: "STS stack using Ultravox for streaming speech.",
        badges: ["STS"],
        stackType: "sts",
      },
      {
        id: "n8n",
        displayName: "n8n Integration",
        summary: "Optional integration template for workflows via n8n.",
        badges: ["Integration"],
        stackType: "integration",
      },
    ],
    []
  );

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
