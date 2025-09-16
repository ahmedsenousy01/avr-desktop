import { Fragment, useEffect, useMemo, useState } from "react";

import type { AsteriskConfig } from "@shared/types/asterisk";
import {
  AsteriskConfigSchema,
  DEFAULT_ASTERISK_CONFIG,
  SUPPORTED_CODECS,
  SUPPORTED_DTMF_MODES,
} from "@shared/types/asterisk";

export interface AsteriskEditorProps {
  value?: AsteriskConfig;
  onChange?: (value: AsteriskConfig) => void;
  /** When provided, Save will write files to this directory via IPC */
  targetDir?: string;
  /** When provided, Save will persist to deployment.json and render conf files via IPC */
  deploymentId?: string;
}

export function AsteriskEditor(props: AsteriskEditorProps) {
  const initialConfig = useMemo<AsteriskConfig>(() => ({ ...DEFAULT_ASTERISK_CONFIG, ...props.value }), [props.value]);
  const [config, setConfig] = useState<AsteriskConfig>(initialConfig);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Record<string, string> | null>(null);

  function validateAll(candidate: AsteriskConfig): void {
    const parsed = AsteriskConfigSchema.safeParse(candidate);
    if (parsed.success) {
      setErrors({});
      return;
    }
    const map: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const pathHead = String(issue.path[0] ?? "");
      if (!map[pathHead]) map[pathHead] = issue.message;
    }
    setErrors(map);
  }

  function update(partial: Partial<AsteriskConfig>) {
    const next = { ...config, ...partial };
    setConfig(next);
    props.onChange?.(next);
    validateAll(next);
  }

  // Keep local state in sync when parent-provided value changes (e.g., after navigation or external updates)
  useEffect(() => {
    const next = { ...DEFAULT_ASTERISK_CONFIG, ...props.value } as AsteriskConfig;
    setConfig(next);
    validateAll(next);
  }, [props.value]);

  function toggleCodec(codec: (typeof SUPPORTED_CODECS)[number]) {
    const has = config.codecs.includes(codec);
    const nextCodecs = has ? config.codecs.filter((c) => c !== codec) : [...config.codecs, codec];
    update({ codecs: nextCodecs });
  }

  function updatePjsip(key: string, value: string) {
    const next = { ...config.pjsip } as Record<string, unknown>;
    if (value === "") delete next[key];
    else next[key] = value;
    update({ pjsip: next });
  }

  const isValid = Object.keys(errors).length === 0;

  async function handlePreview() {
    setIsBusy(true);
    try {
      const mod = await import("@renderer/lib/api");
      const res = await mod.asteriskRenderConfig({ config, preview: true });
      setPreviewFiles(res.files ?? {});
      setPreviewOpen(true);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSave() {
    if (!isValid) return;
    setIsBusy(true);
    try {
      const mod = await import("@renderer/lib/api");
      if (props.deploymentId) {
        await mod.deploymentsUpdate({ id: props.deploymentId, asterisk: config });
      } else if (props.targetDir) {
        await mod.asteriskRenderConfig({ config, targetDir: props.targetDir, preview: false });
      }
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="externalIp"
            className="block text-sm font-medium"
          >
            External IP
          </label>
          <input
            type="text"
            id="externalIp"
            value={config.externalIp}
            onChange={(e) => update({ externalIp: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
            placeholder="203.0.113.10"
            aria-invalid={Boolean(errors.externalIp) || undefined}
            aria-describedby={errors.externalIp ? "externalIp-error" : undefined}
          />
          {errors.externalIp && (
            <div
              id="externalIp-error"
              role="alert"
              className="mt-1 text-sm text-red-600"
            >
              {errors.externalIp}
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="sipPort"
            className="block text-sm font-medium"
          >
            SIP Port
          </label>
          <input
            type="number"
            id="sipPort"
            value={config.sipPort}
            onChange={(e) => update({ sipPort: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
            min={1}
            max={65535}
            aria-invalid={Boolean(errors.sipPort) || undefined}
            aria-describedby={errors.sipPort ? "sipPort-error" : undefined}
          />
          {errors.sipPort && (
            <div
              id="sipPort-error"
              role="alert"
              className="mt-1 text-sm text-red-600"
            >
              {errors.sipPort}
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="rtpStart"
            className="block text-sm font-medium"
          >
            RTP Start
          </label>
          <input
            type="number"
            id="rtpStart"
            value={config.rtpStart}
            onChange={(e) => update({ rtpStart: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
            min={1}
            max={65535}
            aria-invalid={Boolean(errors.rtpStart) || undefined}
            aria-describedby={errors.rtpStart ? "rtpStart-error" : undefined}
          />
          {errors.rtpStart && (
            <div
              id="rtpStart-error"
              role="alert"
              className="mt-1 text-sm text-red-600"
            >
              {errors.rtpStart}
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="rtpEnd"
            className="block text-sm font-medium"
          >
            RTP End
          </label>
          <input
            type="number"
            id="rtpEnd"
            value={config.rtpEnd}
            onChange={(e) => update({ rtpEnd: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
            min={1}
            max={65535}
            aria-invalid={Boolean(errors.rtpEnd) || undefined}
            aria-describedby={errors.rtpEnd ? "rtpEnd-error" : undefined}
          />
          {errors.rtpEnd && (
            <div
              id="rtpEnd-error"
              role="alert"
              className="mt-1 text-sm text-red-600"
            >
              {errors.rtpEnd}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label
          htmlFor="dtmfMode"
          className="text-sm font-medium"
        >
          DTMF Mode
        </label>
        <select
          className="mt-1 rounded border border-gray-300 px-2 py-1"
          id="dtmfMode"
          value={config.dtmfMode}
          onChange={(e) => update({ dtmfMode: e.target.value as AsteriskConfig["dtmfMode"] })}
          aria-invalid={Boolean(errors.dtmfMode) || undefined}
          aria-describedby={errors.dtmfMode ? "dtmfMode-error" : undefined}
        >
          {SUPPORTED_DTMF_MODES.map((mode) => (
            <option
              key={mode}
              value={mode}
            >
              {mode}
            </option>
          ))}
        </select>
        {errors.dtmfMode && (
          <div
            id="dtmfMode-error"
            role="alert"
            className="mt-1 text-sm text-red-600"
          >
            {errors.dtmfMode}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="text-sm font-medium">Codecs</div>
        <div className="mt-1 flex flex-wrap gap-3">
          {SUPPORTED_CODECS.map((codec) => (
            <label
              key={codec}
              className="flex items-center gap-2"
            >
              <input
                type="checkbox"
                checked={config.codecs.includes(codec)}
                onChange={() => toggleCodec(codec)}
              />
              <span>{codec}</span>
            </label>
          ))}
        </div>
        {errors.codecs && (
          <div
            id="codecs-error"
            role="alert"
            className="mt-1 text-sm text-red-600"
          >
            {errors.codecs}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={isBusy}
          onClick={handlePreview}
        >
          Preview
        </button>
        <button
          type="button"
          className="rounded bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={isBusy || !isValid}
          onClick={handleSave}
        >
          Save
        </button>
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="rounded border border-gray-300 px-3 py-1 text-sm"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide Advanced" : "Show Advanced"}
        </button>

        {showAdvanced && (
          <div className="mt-3">
            <div className="mb-2 text-sm font-medium">PJSIP Overrides</div>
            <div className="space-y-2">
              {Object.entries(config.pjsip).map(([key, val]) => (
                <div
                  key={key}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    className="w-1/3 rounded border border-gray-300 px-2 py-1"
                    value={key}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      if (!newKey || newKey === key) return;
                      const next = { ...config.pjsip } as Record<string, unknown>;
                      next[newKey] = next[key];
                      delete next[key];
                      update({ pjsip: next });
                    }}
                  />
                  <input
                    type="text"
                    className="flex-1 rounded border border-gray-300 px-2 py-1"
                    value={String(val ?? "")}
                    onChange={(e) => updatePjsip(key, e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded border border-red-300 px-2 py-1 text-sm text-red-700"
                    onClick={() => updatePjsip(key, "")}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="section.option"
                  className="w-1/3 rounded border border-gray-300 px-2 py-1"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const input = e.target as HTMLInputElement;
                    const newKey = input.value.trim();
                    if (!newKey || newKey in (config.pjsip as Record<string, unknown>)) return;
                    updatePjsip(newKey, "");
                    input.value = "";
                  }}
                />
                <span className="self-center text-sm text-gray-500">Press Enter to add key</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold">Preview (read-only)</div>
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1 text-sm"
                onClick={() => setPreviewOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="space-y-4">
              {previewFiles &&
                Object.entries(previewFiles).map(([name, content]) => (
                  <Fragment key={name}>
                    <div className="text-sm font-semibold">{name}</div>
                    <pre className="overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs">{content}</pre>
                  </Fragment>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
