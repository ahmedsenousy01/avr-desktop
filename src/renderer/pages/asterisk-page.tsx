import { useEffect, useMemo, useState } from "react";

import type { DeploymentsListItem } from "@shared/ipc";
import type { AsteriskConfig } from "@shared/types/asterisk";
import { DEFAULT_ASTERISK_CONFIG } from "@shared/types/asterisk";
import { AsteriskEditor } from "@renderer/components/asterisk-editor";
import { deploymentsGet, deploymentsList } from "@renderer/lib/api";

export function AsteriskPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DeploymentsListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [config, setConfig] = useState<AsteriskConfig>(DEFAULT_ASTERISK_CONFIG);
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

  const selected = useMemo(() => items.find((d) => d.id === selectedId), [items, selectedId]);

  useEffect(() => {
    (async () => {
      if (!selected) return;
      try {
        const full = await deploymentsGet({ id: selected.id });
        setConfig(full.asterisk ?? DEFAULT_ASTERISK_CONFIG);
      } catch {
        setConfig(DEFAULT_ASTERISK_CONFIG);
      }
    })();
  }, [selected]);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Asterisk Configuration</h1>
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
        {selected && <div className="mt-1 text-xs text-gray-500">Editing: {selected.name}</div>}
      </div>

      {selected && (
        <AsteriskEditor
          value={config}
          onChange={setConfig}
          deploymentId={selected.id}
        />
      )}
    </div>
  );
}
