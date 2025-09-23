import React from "react";

import type { ApiValidationErrorCode, ApiValidationType, ProviderId } from "@shared/types/providers";

export interface ValidationResult {
  ok: boolean;
  message: string;
  validationType: ApiValidationType;
  errorCode?: ApiValidationErrorCode;
  details?: string;
}

export interface ProviderFormProps {
  providerId: ProviderId;
  apiKey: string;
  onChange: (nextKey: string) => void;
  onSave: () => Promise<void> | void;
  onCancel: () => void;
  onTest: (keyToTest: string) => Promise<ValidationResult>;
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
  const [autoValidationPending, setAutoValidationPending] = React.useState(false);
  const [testResult, setTestResult] = React.useState<ValidationResult | null>(null);
  const originalKeyRef = React.useRef(apiKey);
  const lastValidatedKeyRef = React.useRef<string>("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const inputId = React.useId();
  const errorId = `${inputId}-error`;
  const resultId = `${inputId}-result`;

  // Reset original key when editing a different provider
  React.useEffect(() => {
    originalKeyRef.current = apiKey;
    lastValidatedKeyRef.current = "";
    setTestResult(null);
    setAutoValidationPending(false);
  }, [providerId, apiKey]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, [providerId]);

  // Auto-validate API key changes with debouncing
  React.useEffect(() => {
    const trimmed = apiKey.trim();

    // Don't validate empty keys or keys that haven't changed since last validation
    if (trimmed.length === 0 || trimmed === lastValidatedKeyRef.current) {
      setAutoValidationPending(false);
      return;
    }

    // Clear previous result when key changes
    setTestResult(null);

    // Show that auto-validation will happen soon
    setAutoValidationPending(true);

    // Debounce validation - wait 1.5 seconds after user stops typing
    const timeoutId = setTimeout(() => {
      // Double-check we're not already validating and key hasn't changed
      if (pending || trimmed !== apiKey.trim()) {
        setAutoValidationPending(false);
        return;
      }

      try {
        lastValidatedKeyRef.current = trimmed;
        setAutoValidationPending(false);
        setPending(true);
        setTestResult(null);
        void onTest(trimmed)
          .then((res) => setTestResult(res))
          .catch((error) => {
            console.error("Auto-validation error:", error);
          })
          .finally(() => {
            setPending(false);
          });
      } catch (error) {
        console.error("Auto-validation error:", error);
      }
    }, 1500);

    return () => {
      clearTimeout(timeoutId);
      setAutoValidationPending(false);
    };
  }, [apiKey, pending, onTest]);

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
      const res = await onTest(apiKey.trim());
      setTestResult(res);
      lastValidatedKeyRef.current = apiKey.trim();
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
        <label
          htmlFor={inputId}
          style={{ width: 120, fontSize: 14 }}
        >
          API key
        </label>
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
          aria-describedby={
            [error ? errorId : null, testResult ? resultId : null].filter(Boolean).join(" ") || undefined
          }
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
        <div
          id={errorId}
          style={{ marginTop: 6, color: "#b91c1c", fontSize: 12 }}
        >
          {error}
        </div>
      )}
      {autoValidationPending && (
        <div style={{ marginTop: 8, color: "#6b7280", fontSize: 12, fontStyle: "italic" }}>Validating API key...</div>
      )}
      {testResult && (
        <div
          id={resultId}
          style={{ marginTop: 8, color: testResult.ok ? "#065f46" : "#991b1b", fontWeight: 600 }}
          aria-live="polite"
        >
          {testResult.message}
          <span
            style={{
              marginLeft: 8,
              fontSize: 10,
              fontWeight: 400,
              opacity: 0.7,
              textTransform: "uppercase",
            }}
          >
            ({testResult.validationType})
          </span>
          {testResult.details && !testResult.ok && (
            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 400, opacity: 0.8 }}>{testResult.details}</div>
          )}
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
