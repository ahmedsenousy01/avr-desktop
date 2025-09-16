import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PreflightLastResponse, PreflightResult, PreflightRunResponse } from "@shared/ipc";
import type { PreflightItem } from "@shared/types/preflight";
import { AsteriskRtpValidationRemediation } from "@renderer/components/preflight-remediations/AsteriskRtpValidationRemediation";
import { DockerNameCollisionRemediation } from "@renderer/components/preflight-remediations/DockerNameCollisionRemediation";
import { DockerPortsConflictRemediation } from "@renderer/components/preflight-remediations/DockerPortsConflictRemediation";
import { DockerUnavailableRemediation } from "@renderer/components/preflight-remediations/DockerUnavailableRemediation";
import { HostPortInUseRemediation } from "@renderer/components/preflight-remediations/HostPortInUseRemediation";
import { preflightFix, preflightLast, preflightRun } from "@renderer/lib/api";

type Severity = "pass" | "warn" | "fail";

function groupBySeverity(items: PreflightItem[]): Record<Severity, PreflightItem[]> {
  const groups: Record<Severity, PreflightItem[]> = { pass: [], warn: [], fail: [] };
  for (const it of items) groups[it.severity].push(it);
  const order: Record<Severity, number> = { fail: 0, warn: 1, pass: 2 };
  for (const key of Object.keys(groups) as Severity[]) {
    groups[key] = groups[key]
      .slice()
      .sort(
        (a, b) => order[a.severity] - order[b.severity] || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
      );
  }
  return groups;
}

export interface PreflightPanelProps {
  deploymentId: string;
  onResult?: (result: PreflightResult) => void;
}

export const PreflightPanel: React.FC<PreflightPanelProps> = ({ deploymentId, onResult }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PreflightItem[]>([]);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<PreflightResult | null>(null);

  // Keep a stable reference to onResult to avoid re-creating callbacks on each render
  const onResultRef = useRef<typeof onResult>(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const groups = useMemo(() => groupBySeverity(items), [items]);
  const hasAny = items.length > 0;

  const loadLast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: PreflightLastResponse = await preflightLast({ deploymentId });
      if (res.result) {
        setItems(res.result.items);
        setLastRunAt(res.result.summary.finishedAt);
        setLastDurationMs(res.result.summary.durationMs);
        setLastResult(res.result);
        onResultRef.current?.(res.result);
      } else {
        setItems([]);
        setLastRunAt(null);
        setLastDurationMs(null);
        setLastResult(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load preflight results");
    } finally {
      setLoading(false);
    }
  }, [deploymentId]);

  useEffect(() => {
    void loadLast();
  }, [loadLast]);

  const onRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res: PreflightRunResponse = await preflightRun({ deploymentId });
      setItems(res.result.items);
      setLastRunAt(res.result.summary.finishedAt);
      setLastDurationMs(res.result.summary.durationMs);
      setLastResult(res.result);
      onResultRef.current?.(res.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run preflight");
    } finally {
      setRunning(false);
    }
  }, [deploymentId]);

  const onCopy = useCallback(async () => {
    const text = JSON.stringify(
      lastResult ?? { items, summary: { finishedAt: lastRunAt, durationMs: lastDurationMs } },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // swallow copy errors
    }
  }, [items, lastResult, lastRunAt, lastDurationMs]);

  return (
    <div className="rounded-md border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="font-medium text-slate-800">Preflight</div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          {lastRunAt && <span>Last run: {new Date(lastRunAt).toLocaleString()}</span>}
          {lastDurationMs != null && <span>Elapsed: {(lastDurationMs / 1000).toFixed(1)}s</span>}
          <button
            className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            onClick={() => setShowDetails((v) => !v)}
            disabled={running}
          >
            {showDetails ? "Hide Details" : "View Details"}
          </button>
          <button
            className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            onClick={() => void onCopy()}
            disabled={running || (!lastResult && items.length === 0)}
          >
            Copy diagnostics
          </button>
          <button
            className="rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-700 disabled:opacity-50"
            onClick={() => void onRun()}
            disabled={running}
          >
            {running ? "Running…" : "Run Preflight"}
          </button>
        </div>
      </div>
      {showDetails && lastResult && (
        <div className="max-h-64 overflow-auto border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <pre className="break-words whitespace-pre-wrap text-slate-700">{JSON.stringify(lastResult, null, 2)}</pre>
        </div>
      )}
      {error && <div className="px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="px-3 py-4 text-slate-600">Loading…</div>
      ) : hasAny ? (
        <div className="grid grid-cols-3 gap-3 p-3">
          <div>
            <div className="mb-2 text-sm font-semibold text-red-700">Failures</div>
            <ul className="space-y-2">
              {groups.fail.map((it) => (
                <li
                  key={it.id}
                  className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800"
                >
                  <div className="font-medium">{it.title}</div>
                  <div className="text-red-900">{it.message}</div>
                  {it.id.startsWith("asterisk:rtp:") && (
                    <div className="mt-2">
                      <a
                        href={`/asterisk?id=${deploymentId}`}
                        className="inline-block rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-700"
                      >
                        Open Asterisk settings
                      </a>
                      <button
                        type="button"
                        className="ml-2 inline-block rounded bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700"
                        onClick={async () => {
                          try {
                            await preflightFix({ deploymentId, itemId: it.id });
                            await onRun();
                          } catch {}
                        }}
                        disabled={running}
                      >
                        Auto-fix
                      </button>
                    </div>
                  )}
                  {it.id === "docker:available:nok" && (
                    <DockerUnavailableRemediation
                      onRetry={onRun}
                      running={running}
                      message={it.message}
                    />
                  )}
                  {it.id === "docker:ports:conflicts" && (
                    <DockerPortsConflictRemediation
                      deploymentId={deploymentId}
                      item={it}
                      running={running}
                      onRerun={onRun}
                    />
                  )}
                  {it.id.startsWith("asterisk:rtp:") && (
                    <AsteriskRtpValidationRemediation
                      deploymentId={deploymentId}
                      item={it}
                      running={running}
                      onRerun={onRun}
                    />
                  )}
                  {it.id.startsWith("port:tcp:127.0.0.1:") && (
                    <HostPortInUseRemediation port={Number(it.data && (it.data as { port?: number }).port) || 0} />
                  )}
                  {it.id === "docker:names:collisions" && (
                    <DockerNameCollisionRemediation
                      deploymentId={deploymentId}
                      item={it}
                      running={running}
                      onRerun={onRun}
                    />
                  )}
                  {it.id.startsWith("provider:") && it.id.endsWith(":apiKey") && (
                    <div className="mt-2">
                      <a
                        href={`/providers`}
                        className="inline-block rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-700"
                      >
                        Open Providers settings
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-amber-700">Warnings</div>
            <ul className="space-y-2">
              {groups.warn.map((it) => (
                <li
                  key={it.id}
                  className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900"
                >
                  <div className="font-medium">{it.title}</div>
                  <div>{it.message}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-emerald-700">Passes</div>
            <ul className="space-y-2">
              {groups.pass.map((it) => (
                <li
                  key={it.id}
                  className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-900"
                >
                  <div className="font-medium">{it.title}</div>
                  <div>{it.message}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="px-3 py-4 text-slate-600">
          No preflight results yet. Run Preflight to analyze your environment.
        </div>
      )}
    </div>
  );
};
