import { useCallback, useMemo, useState } from "react";

import type { ProviderId } from "@shared/types/providers";

// use window.env directly so tests can vi.mock the module without needing an export

type VariableMeta = { name: string; required: boolean; defaultValue?: string };

export function EnvServicePanel({
  deploymentId,
  serviceName,
  variables,
  values,
  masked = true,
  providerPresence,
  onChange,
  displayName,
}: {
  deploymentId: string;
  serviceName: string;
  variables: VariableMeta[];
  values: Record<string, string> | undefined;
  masked?: boolean;
  providerPresence: Partial<Record<ProviderId, boolean>> | undefined;
  onChange: (next: Record<string, string> | undefined) => void;
  displayName?: string;
}) {
  const rows = useMemo(() => {
    const base = variables.map((v) => ({
      key: v.name,
      value: values?.[v.name] ?? "",
      required: v.required,
      isCustom: false,
    }));
    // include custom vars not in template
    const custom = Object.entries(values ?? {})
      .filter(([k]) => !variables.some((v) => v.name === k))
      .map(([k, v]) => ({ key: k, value: v, required: false, isCustom: true }));
    return [...base, ...custom];
  }, [variables, values]);

  const missingCount = rows.filter((r) => r.required && !r.value).length;
  const addedCount = rows.filter((r) => r.isCustom).length;
  const removedCount = variables.filter((v) => !(values && v.name in values)).length;

  // Heuristic: map known env keys to provider ids for presence indication, without exposing values
  const providerIdsForService: ProviderId[] = useMemo(() => {
    const keys = new Set(rows.map((r) => r.key));
    const ids: ProviderId[] = [];
    if (keys.has("OPENAI_API_KEY")) ids.push("openai");
    if (keys.has("ANTHROPIC_API_KEY")) ids.push("anthropic");
    if (keys.has("GEMINI_API_KEY")) ids.push("gemini");
    if (keys.has("DEEPGRAM_API_KEY")) ids.push("deepgram");
    if (keys.has("ELEVENLABS_API_KEY")) ids.push("elevenlabs");
    return ids;
  }, [rows]);

  // Missing providers are computed in ProviderBadges for display

  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  const handleEdit = useCallback(
    async (key: string, value: string) => {
      const envApi = window.env;
      if (!envApi) return;
      const res = await envApi.upsertVar({ deploymentId, serviceName, variableName: key, value });
      onChange(res.env.services[serviceName]);
    },
    [deploymentId, serviceName, onChange]
  );

  const handleRemove = useCallback(
    async (key: string) => {
      const envApi = window.env;
      if (!envApi) return;
      const res = await envApi.removeVar({ deploymentId, serviceName, variableName: key });
      onChange(res.env.services[serviceName]);
    },
    [deploymentId, serviceName, onChange]
  );

  const toggleReveal = (key: string) => setRevealedKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="mb-4 rounded border border-gray-200">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
        <div className="font-medium">{displayName ?? serviceName}</div>
        <div className="flex items-center gap-2">
          <ProviderBadges
            providerIds={providerIdsForService}
            presence={providerPresence}
          />
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Added {addedCount}</span>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            Removed {removedCount}
          </span>
          {missingCount === 0 ? (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">OK</span>
          ) : (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Missing {missingCount}
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto p-2">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="text-left text-xs text-gray-600">
              <th className="border-b p-2">Key</th>
              <th className="border-b p-2">Value</th>
              <th className="border-b p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, value, required, isCustom }) => {
              const isMasked = masked && !revealedKeys[key];
              return (
                <tr
                  key={key}
                  className={required && !value ? "bg-yellow-50" : undefined}
                >
                  <td className="p-2 align-top font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span>{key}</span>
                      {isCustom && (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-purple-700 uppercase">
                          Custom
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2 align-top">
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs"
                      type={isMasked ? "password" : "text"}
                      value={value}
                      onChange={(e) => handleEdit(key, e.target.value)}
                    />
                  </td>
                  <td className="p-2 align-top">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-gray-300 px-2 py-1 text-xs"
                        onClick={() => toggleReveal(key)}
                      >
                        {isMasked ? "Reveal" : "Hide"}
                      </button>
                      {!required && (
                        <button
                          type="button"
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                          onClick={() => handleRemove(key)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProviderBadges({
  providerIds,
  presence,
}: {
  providerIds: ProviderId[];
  presence: Partial<Record<ProviderId, boolean>> | undefined;
}) {
  const missing = providerIds.filter((pid) => presence?.[pid] === false || presence?.[pid] === undefined);
  return (
    <>
      {missing.length > 0 && (
        <span
          className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
          title={`Missing provider key${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`}
        >
          Missing keys: {missing.join(", ")}
        </span>
      )}
      {providerIds.map((pid) => {
        const present = presence?.[pid];
        return (
          <span
            key={pid}
            className={
              present
                ? "rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                : "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
            }
            title={present ? `${pid} key present` : `${pid} key missing`}
          >
            {pid}: {present ? "Present" : "Missing"}
          </span>
        );
      })}
    </>
  );
}
