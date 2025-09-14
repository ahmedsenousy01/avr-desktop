import React from "react";

import type { ProviderId } from "@shared/types/providers";

export interface ProviderFormProps {
  providerId: ProviderId;
  apiKey: string;
  onChange: (nextKey: string) => void;
  onSave: () => Promise<void> | void;
  onCancel: () => void;
  onTest: () => Promise<{ ok: boolean; message: string }>;
}

export const ProviderForm: React.FC<ProviderFormProps> = ({
  providerId,
  apiKey,
  onChange,
  onSave,
  onCancel,
  onTest,
}) => {
  const [revealed, setRevealed] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [testResult, setTestResult] = React.useState<null | { ok: boolean; message: string }>(null);
  const originalKeyRef = React.useRef(apiKey);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const inputId = React.useId();
  const errorId = `${inputId}-error`;
  const resultId = `${inputId}-result`;

  // Reset original key when editing a different provider
  React.useEffect(() => {
    originalKeyRef.current = apiKey;
    setTestResult(null);
  }, [providerId]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, [providerId]);

  const isDirty = apiKey !== originalKeyRef.current;
  const trimmed = apiKey.trim();
  const error = trimmed.length === 0 ? "Key looks empty" : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
    } catch {}
  };

  const handleTest = async () => {
    setPending(true);
    setTestResult(null);
    try {
      const res = await onTest();
      setTestResult(res);
    } finally {
      setPending(false);
    }
  };

  const handleSave = async () => {
    setPending(true);
    try {
      await onSave();
    } finally {
      setPending(false);
    }
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{providerId}</div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <label htmlFor={inputId} style={{ width: 120, fontSize: 14 }}>API key</label>
        <input
          type={revealed ? "text" : "password"}
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${providerId} API key`}
          id={inputId}
          ref={inputRef}
          style={{
            flex: 1,
            padding: "8px 10px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, testResult ? resultId : null].filter(Boolean).join(" ") || undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !pending && isDirty) {
              e.preventDefault();
              void handleSave();
            }
            if (e.key === "Escape" && !pending) {
              e.preventDefault();
              onCancel();
            }
          }}
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          style={{ padding: "6px 10px" }}
        >
          {revealed ? "Hide" : "Reveal"}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          style={{ padding: "6px 10px" }}
        >
          Copy
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={pending}
          style={{ padding: "6px 10px" }}
        >
          {pending ? "Testing…" : "Test"}
        </button>
      </div>
      {error && (
        <div id={errorId} style={{ marginTop: 6, color: "#b91c1c", fontSize: 12 }}>
          {error}
        </div>
      )}
      {testResult && (
        <div
          id={resultId}
          style={{ marginTop: 8, color: testResult.ok ? "#065f46" : "#991b1b", fontWeight: 600 }}
          aria-live="polite"
        >
          {testResult.message}
        </div>
      )}
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !isDirty}
          style={{ padding: "6px 12px" }}
        >
          {isDirty ? "Save" : "Saved"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          style={{ padding: "6px 12px" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
