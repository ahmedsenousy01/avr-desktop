import { useEffect, useMemo, useState } from "react";

import type { DeploymentsListItem } from "@shared/ipc";
import { deploymentsGet, deploymentsList, deploymentsUpdate } from "@renderer/lib/api";

export function EnvironmentPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DeploymentsListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [envMap, setEnvMap] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const initialId = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("id") ?? undefined;
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await deploymentsList();
        setItems(res.deployments);
        if (res.deployments.length > 0) {
          const match = initialId ? res.deployments.find((d) => d.id === initialId)?.id : undefined;
          setSelectedId(match ?? res.deployments[0].id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [initialId]);

  useEffect(() => {
    (async () => {
      if (!selectedId) return;
      try {
        const full = await deploymentsGet({ id: selectedId });
        setEnvMap(full.environmentOverrides ?? {});
      } catch {
        setEnvMap({});
      }
    })();
  }, [selectedId]);

  function updateKey(key: string, value: string) {
    setEnvMap((prev) => {
      const next = { ...prev };
      if (value === "") delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function addRow() {
    // Add an empty placeholder row
    let n = 1;
    let key = "NEW_VAR";
    while (envMap[key] !== undefined || Object.prototype.hasOwnProperty.call(envMap, key)) {
      n += 1;
      key = `NEW_VAR_${n}`;
    }
    setEnvMap((prev) => ({ ...prev, [key]: "" }));
  }

  function removeKey(key: string) {
    setEnvMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSave() {
    if (!selectedId) return;
    setIsSaving(true);
    try {
      await deploymentsUpdate({ id: selectedId, environmentOverrides: envMap });
    } finally {
      setIsSaving(false);
    }
  }

  const entries = Object.entries(envMap);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Environment Overrides</h1>
      </div>

      <div className="mb-4">
        <label
          htmlFor="deployment"
          className="block text-sm font-medium"
        >
          Deployment
        </label>
        <select
          id="deployment"
          className="mt-1 rounded border border-gray-300 px-2 py-1"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value || undefined)}
          disabled={loading || items.length === 0}
        >
          {items.length === 0 && <option value="">No deployments found</option>}
          {items.map((d) => (
            <option
              key={d.id}
              value={d.id}
            >
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-1 text-white"
          onClick={addRow}
        >
          Add Variable
        </button>
      </div>

      <div className="mb-4">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="text-left">
              <th className="border-b p-2">Key</th>
              <th className="border-b p-2">Value</th>
              <th className="border-b p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td
                  className="p-2 text-sm text-gray-500"
                  colSpan={3}
                >
                  No overrides set. Click &quot;Add Variable&quot; to start.
                </td>
              </tr>
            )}
            {entries.map(([key, value]) => (
              <tr key={key}>
                <td className="p-2 align-top">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => {
                      const nextKey = e.target.value;
                      setEnvMap((prev) => {
                        const next = { ...prev } as Record<string, string>;
                        const v = next[key];
                        delete next[key];
                        if (nextKey) next[nextKey] = v;
                        return next;
                      });
                    }}
                    className="w-full rounded border border-gray-300 px-2 py-1 font-mono"
                  />
                </td>
                <td className="p-2 align-top">
                  <textarea
                    value={value}
                    onChange={(e) => updateKey(key, e.target.value)}
                    className="h-9 w-full resize-y rounded border border-gray-300 px-2 py-1 font-mono"
                  />
                </td>
                <td className="p-2 align-top">
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                    onClick={() => removeKey(key)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60"
          onClick={handleSave}
          disabled={isSaving || !selectedId}
        >
          Save
        </button>
      </div>
    </div>
  );
}
