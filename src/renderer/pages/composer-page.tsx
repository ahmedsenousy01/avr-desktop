import React, { useCallback, useState } from "react";

import type { ComposerMode } from "@renderer/components/composer-form";
import type { ModularSelection, StsSelection } from "@shared/types/validation";
import ComposerForm from "@renderer/components/composer-form";
import { deploymentsCreateFromSelection } from "@renderer/lib/api";

export const ComposerPage: React.FC = () => {
  const [mode, setMode] = useState<ComposerMode>("modular");
  const [submitting, setSubmitting] = useState(false);
  const [value, setValue] = useState<ModularSelection | StsSelection>({
    llm: "openai",
    asr: "deepgram",
    tts: "elevenlabs",
  } as ModularSelection);

  const onSubmit = useCallback(async () => {
    try {
      setSubmitting(true);
      if (mode === "modular") {
        const v = value as ModularSelection;
        await deploymentsCreateFromSelection({ type: "modular", providers: { llm: v.llm, asr: v.asr, tts: v.tts } });
      } else {
        const v = value as StsSelection;
        await deploymentsCreateFromSelection({ type: "sts", providers: { sts: v.sts } });
      }
      // eslint-disable-next-line no-alert
      alert("Deployment created from selection");
    } finally {
      setSubmitting(false);
    }
  }, [mode, value]);

  return (
    <div className="p-4">
      <h2 className="mb-3 text-lg font-semibold">Composer</h2>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("modular")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            mode === "modular" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white"
          }`}
        >
          Modular
        </button>
        <button
          type="button"
          onClick={() => setMode("sts")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            mode === "sts" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white"
          }`}
        >
          STS
        </button>
      </div>
      <ComposerForm
        mode={mode}
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
        isSubmitting={submitting}
      />
    </div>
  );
};
