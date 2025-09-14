import React from "react";

import type {
  ASRProviderId,
  LLMProviderId,
  ModularSelection,
  STSProviderId,
  StsSelection,
  TTSProviderId,
} from "@shared/types/validation";
import {
  ASR_PROVIDER_IDS,
  getModularCompatibilityIssues,
  isValidModularSelection,
  isValidStsSelection,
  LLM_PROVIDER_IDS,
  STS_PROVIDER_IDS,
  TTS_PROVIDER_IDS,
} from "@shared/types/validation";

export type ComposerMode = "modular" | "sts";

export interface ComposerFormProps {
  mode: ComposerMode;
  value: ModularSelection | StsSelection;
  onChange: (next: ModularSelection | StsSelection) => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  className?: string;
}

function SelectField<T extends string>(props: {
  id: string;
  label: string;
  value: T | undefined;
  options: readonly T[];
  placeholder?: string;
  onChange: (value: T) => void;
  error?: string | null;
}) {
  const { id, label, value, options, placeholder, onChange, error } = props;
  return (
    <label
      htmlFor={id}
      className="flex flex-col gap-1"
    >
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        id={id}
        className={
          "rounded-md border bg-white px-2.5 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none " +
          (error ? "border-red-300" : "border-gray-300")
        }
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value as T)}
      >
        <option
          value=""
          disabled
        >
          {placeholder ?? "Select an option"}
        </option>
        {options.map((opt) => (
          <option
            key={opt}
            value={opt}
            className="capitalize"
          >
            {opt}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

export const ComposerForm: React.FC<ComposerFormProps> = ({
  mode,
  value,
  onChange,
  onSubmit,
  isSubmitting,
  className,
}) => {
  const isModular = mode === "modular";

  const handleChange = React.useCallback(
    (partial: Partial<ModularSelection & StsSelection>) => {
      onChange({ ...value, ...partial } as ModularSelection | StsSelection);
    },
    [onChange, value]
  );

  // Validation state
  const modular = value as ModularSelection | undefined;
  const sts = value as StsSelection | undefined;
  const modularIssues =
    mode === "modular" && isValidModularSelection(value)
      ? getModularCompatibilityIssues(modular as ModularSelection)
      : [];
  const selectionValid =
    mode === "modular" ? isValidModularSelection(value) && modularIssues.length === 0 : isValidStsSelection(value);

  return (
    <form
      className={"flex flex-col gap-4 " + (className ?? "")}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      {isModular ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SelectField<LLMProviderId>
            id="llm"
            label="LLM"
            value={(value as ModularSelection).llm}
            options={LLM_PROVIDER_IDS}
            placeholder="Select LLM"
            onChange={(v) => handleChange({ llm: v })}
            error={!modular?.llm ? "Required" : null}
          />
          <SelectField<ASRProviderId>
            id="asr"
            label="ASR / Transcriber"
            value={(value as ModularSelection).asr}
            options={ASR_PROVIDER_IDS}
            placeholder="Select ASR"
            onChange={(v) => handleChange({ asr: v })}
            error={!modular?.asr ? "Required" : null}
          />
          <SelectField<TTSProviderId>
            id="tts"
            label="TTS"
            value={(value as ModularSelection).tts}
            options={TTS_PROVIDER_IDS}
            placeholder="Select TTS"
            onChange={(v) => handleChange({ tts: v })}
            error={!modular?.tts ? "Required" : null}
          />
          {modularIssues.length > 0 && (
            <div className="md:col-span-3">
              <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700">
                {modularIssues.map((iss) => (
                  <li key={iss.code}>{iss.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField<STSProviderId>
            id="sts"
            label="STS Provider"
            value={(value as StsSelection).sts}
            options={STS_PROVIDER_IDS}
            placeholder="Select STS"
            onChange={(v) => handleChange({ sts: v })}
            error={!sts?.sts ? "Required" : null}
          />
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting || !selectionValid}
        >
          {isSubmitting ? "Creating..." : "Create deployment"}
        </button>
      </div>
    </form>
  );
};

export default ComposerForm;
