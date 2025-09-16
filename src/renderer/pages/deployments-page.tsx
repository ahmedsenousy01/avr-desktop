import React, { useEffect, useMemo, useState } from "react";

import type { DeploymentsListResponse } from "@shared/ipc";
import { DeploymentRunPanel } from "@renderer/components/deployment-run-panel";
import { PreflightPanel } from "@renderer/components/preflight-panel";
import {
  deploymentsDelete,
  deploymentsDuplicate,
  deploymentsList,
  deploymentsUpdate,
  preflightLast,
} from "@renderer/lib/api";

type DeploymentRow = DeploymentsListResponse["deployments"][number];

export const DeploymentsPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [items, setItems] = useState<DeploymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [preflightStatus, setPreflightStatus] = useState<Record<string, "unknown" | "pass" | "warn" | "fail">>({});

  const hasItems = useMemo(() => items.length > 0, [items]);

  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await deploymentsList();
      setItems(res.deployments);
      const statuses: Record<string, "unknown" | "pass" | "warn" | "fail"> = {};
      await Promise.all(
        res.deployments.map(async (d) => {
          try {
            const last = await preflightLast({ deploymentId: d.id });
            statuses[d.id] = last.result ? last.result.summary.overall : "unknown";
          } catch {
            statuses[d.id] = "unknown";
          }
        })
      );
      setPreflightStatus(statuses);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deployments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function startRename(item: DeploymentRow): void {
    setRenamingId(item.id);
    setRenameValue(item.name);
  }

  async function handleRenameSave(): Promise<void> {
    if (!renamingId) return;
    setBusyId(renamingId);
    try {
      await deploymentsUpdate({ id: renamingId, name: renameValue });
      await refresh();
      setRenamingId(null);
    } finally {
      setBusyId(null);
    }
  }

  function handleRenameCancel(): void {
    setRenamingId(null);
    setRenameValue("");
  }

  async function handleDuplicate(item: DeploymentRow): Promise<void> {
    setBusyId(item.id);
    try {
      const copyName = `${item.name} Copy`;
      await deploymentsDuplicate({ id: item.id, name: copyName });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: DeploymentRow): Promise<void> {
    // Basic confirm to prevent accidental deletes; can be replaced with a nicer modal later
    const confirmed = window.confirm(`Delete deployment "${item.name}"?`);
    if (!confirmed) return;
    setBusyId(item.id);
    try {
      await deploymentsDelete({ id: item.id });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-semibold">Deployments</h2>
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <div className="text-slate-600">Loading…</div>
      ) : hasItems ? (
        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Updated</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => {
                const isBusy = busyId === item.id;
                const isRenaming = renamingId === item.id;
                const status = preflightStatus[item.id] ?? "unknown";
                const canStart = status === "pass" || status === "warn";
                return (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-2 align-middle">
                        {isRenaming ? (
                          <div className="flex items-center gap-2">
                            <input
                              className="w-64 rounded border border-slate-300 px-2 py-1 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                            />
                            <button
                              className="rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700 disabled:opacity-50"
                              onClick={() => void handleRenameSave()}
                              disabled={isBusy || renameValue.trim().length === 0}
                            >
                              Save
                            </button>
                            <button
                              className="rounded px-3 py-1 text-slate-700 hover:bg-slate-100"
                              onClick={handleRenameCancel}
                              disabled={isBusy}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-900">{item.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs tracking-wide text-slate-700 uppercase">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 align-middle text-slate-600">
                        {new Date(item.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            onClick={() => startRename(item)}
                            disabled={isBusy || isRenaming}
                          >
                            Rename
                          </button>
                          <button
                            className="rounded px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            onClick={() => void handleDuplicate(item)}
                            disabled={isBusy || isRenaming}
                          >
                            Duplicate
                          </button>
                          <button
                            className="rounded px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
                            onClick={() => void handleDelete(item)}
                            disabled={isBusy || isRenaming}
                          >
                            Delete
                          </button>
                          <a
                            href={`/asterisk?id=${item.id}`}
                            className="rounded px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          >
                            Edit Asterisk
                          </a>
                          <button
                            className="rounded px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            disabled={isBusy || isRenaming}
                          >
                            {expandedId === item.id ? "Hide Preflight" : "Preflight"}
                          </button>
                          <button
                            className="rounded px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            onClick={() => setRunId(runId === item.id ? null : item.id)}
                            disabled={isBusy || isRenaming}
                          >
                            {runId === item.id ? "Hide Run" : "Run"}
                          </button>
                          <button
                            className={
                              "rounded px-3 py-1 text-white disabled:opacity-50 " +
                              (canStart ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400")
                            }
                            onClick={() => undefined}
                            disabled={!canStart}
                            title={
                              canStart ? "Start" : status === "fail" ? "Preflight has failures" : "Run preflight first"
                            }
                          >
                            Start
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === item.id && (
                      <tr className="bg-slate-50/40">
                        <td
                          colSpan={4}
                          className="px-4 py-3"
                        >
                          <PreflightPanel
                            deploymentId={item.id}
                            onResult={(res) =>
                              setPreflightStatus((prev) => ({ ...prev, [item.id]: res.summary.overall }))
                            }
                          />
                        </td>
                      </tr>
                    )}
                    {runId === item.id && (
                      <tr className="bg-slate-50/40">
                        <td
                          colSpan={4}
                          className="px-4 py-3"
                        >
                          <DeploymentRunPanel deploymentId={item.id} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-slate-200 p-8 text-center text-slate-600">
          No deployments yet. Create one from the Templates page or Composer.
        </div>
      )}
    </div>
  );
};
