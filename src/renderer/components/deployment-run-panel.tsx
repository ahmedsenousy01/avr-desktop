import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ComposeLogsClosedEvent,
  ComposeLogsDataEvent,
  ComposeLogsErrorEvent,
  ComposeServiceStatus,
} from "@shared/ipc";
import {
  composeDown,
  composeGenerate,
  composeLogsExport,
  composeLogsStart,
  composeLogsStop,
  composeStatusStart,
  composeStatusStop,
  composeUp,
} from "@renderer/lib/api";

interface DeploymentRunPanelProps {
  deploymentId: string;
}

type BusyAction = "idle" | "generate" | "start" | "stop";

export const DeploymentRunPanel: React.FC<DeploymentRunPanelProps> = ({ deploymentId }) => {
  const [busy, setBusy] = useState<BusyAction>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [services, setServices] = useState<ComposeServiceStatus[]>([]);
  const [statusSubscriptionId, setStatusSubscriptionId] = useState<string | null>(null);
  // removed legacy polling refs after switching to status subscription
  const [logFollow, setLogFollow] = useState<boolean>(true);
  const [logFilter, setLogFilter] = useState<string>("");
  const [logService, setLogService] = useState<string | undefined>(undefined);
  const [logSubscriptionId, setLogSubscriptionId] = useState<string | null>(null);
  const LOG_RING_MAX = 2000;
  const [logBuffer, setLogBuffer] = useState<string[]>([]);
  const [logCounts, setLogCounts] = useState<Record<string, number>>({ "": 0 });
  const [logState, setLogState] = useState<"idle" | "connected" | "reconnecting" | "stopped">("idle");
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const isBusy = useMemo(() => busy !== "idle", [busy]);

  useEffect(() => {
    let localId: string | null = null;
    (async () => {
      try {
        const { subscriptionId } = await composeStatusStart({ deploymentId, intervalMs: 2000 });
        localId = subscriptionId;
        setStatusSubscriptionId(subscriptionId);
      } catch {
        // ignore subscribe failure; UI may remain empty
      }
    })();
    return () => {
      if (localId) {
        void composeStatusStop({ subscriptionId: localId });
      }
    };
  }, [deploymentId]);

  const startLogs = useCallback(
    async (clearBuffer = true): Promise<void> => {
      try {
        if (logSubscriptionId) {
          await composeLogsStop({ subscriptionId: logSubscriptionId });
          setLogSubscriptionId(null);
        }
        if (clearBuffer) {
          setLogBuffer([]);
          setLogCounts((_prev) => {
            const next: Record<string, number> = { "": 0 };
            for (const s of services) next[s.service] = 0;
            return next;
          });
        }
        const { subscriptionId } = await composeLogsStart({ deploymentId, service: logService });
        setLogSubscriptionId(subscriptionId);
        if (!clearBuffer) setLogState("reconnecting");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Failed to start logs");
      }
    },
    [logSubscriptionId, services, deploymentId, logService]
  );

  const stopLogs = useCallback(async (): Promise<void> => {
    try {
      if (!logSubscriptionId) return;
      await composeLogsStop({ subscriptionId: logSubscriptionId });
    } catch {
      // non-fatal
    } finally {
      setLogSubscriptionId(null);
      setLogState("stopped");
    }
  }, [logSubscriptionId]);

  useEffect(() => {
    if (!logFollow) return;
    if (
      logsEndRef.current &&
      typeof (logsEndRef.current as unknown as { scrollIntoView?: unknown }).scrollIntoView === "function"
    ) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logBuffer, logFollow]);

  useEffect(() => {
    // Subscribe to logs events
    const win = window as unknown as {
      composeEvents?: {
        onStatusUpdate: (cb: (payload: unknown) => void) => void;
        onLogsData: (cb: (payload: unknown) => void) => void;
        onLogsClosed: (cb: (payload: unknown) => void) => void;
        onLogsError: (cb: (payload: unknown) => void) => void;
      };
    };
    const onStatus = (payload: unknown) => {
      const evt = payload as { subscriptionId: string; services: ComposeServiceStatus[] };
      // Accept events if subscription id matches, or before id is established
      if (statusSubscriptionId && evt.subscriptionId !== statusSubscriptionId) return;
      setServices(evt.services);
    };
    const onData = (payload: unknown) => {
      const evt = payload as ComposeLogsDataEvent;
      if (!logSubscriptionId || evt.subscriptionId !== logSubscriptionId) return;
      const lines = String(evt.chunk)
        .split(/\n/)
        .filter((l) => l.length > 0);
      if (lines.length > 0) {
        setLogBuffer((prev) => {
          const next = prev.concat(lines);
          return next.length <= LOG_RING_MAX ? next : next.slice(next.length - LOG_RING_MAX);
        });
        if (logState !== "connected") setLogState("connected");
      }
      if (lines.length > 0) {
        setLogCounts((prev) => {
          const next = { ...prev };
          for (const line of lines) {
            next[""] = (next[""] ?? 0) + 1; // All tab
            const svc = logService ? logService : parseServiceNameFromLine(line);
            if (svc) next[svc] = (next[svc] ?? 0) + 1;
          }
          return next;
        });
      }
    };
    const onClosed = (payload: unknown) => {
      const evt = payload as ComposeLogsClosedEvent;
      if (!logSubscriptionId || evt.subscriptionId !== logSubscriptionId) return;
      setLogSubscriptionId(null);
      if (logFollow) {
        setLogState("reconnecting");
        void startLogs(false);
      } else {
        setLogState("stopped");
      }
    };
    const onError = (payload: unknown) => {
      const evt = payload as ComposeLogsErrorEvent;
      if (!logSubscriptionId || evt.subscriptionId !== logSubscriptionId) return;
      setMessage(evt.message);
      setLogBuffer((prev) => prev.concat([`[error] ${evt.message}`]));
    };
    win.composeEvents?.onStatusUpdate(onStatus);
    win.composeEvents?.onLogsData(onData);
    win.composeEvents?.onLogsClosed(onClosed);
    win.composeEvents?.onLogsError(onError);
    return () => {
      // best-effort: no off() provided; new handlers replace page lifecycle
    };
  }, [statusSubscriptionId, logSubscriptionId, logService, logFollow, logState, startLogs]);

  // Restart logs stream when selected service changes and a stream is active
  useEffect(() => {
    if (!logSubscriptionId) return;
    void startLogs();
  }, [logService, logSubscriptionId, startLogs]);

  // Ensure counts map includes all current services
  useEffect(() => {
    setLogCounts((prev) => {
      const next: Record<string, number> = { ...prev };
      if (!Object.prototype.hasOwnProperty.call(next, "")) next[""] = 0;
      for (const s of services) {
        if (!Object.prototype.hasOwnProperty.call(next, s.service)) next[s.service] = 0;
      }
      return next;
    });
  }, [services]);

  function parseServiceNameFromLine(line: string): string | undefined {
    const m = line.match(/^([A-Za-z0-9._-]+)\s+\|\s/);
    return m ? m[1] : undefined;
  }

  function setIdle(): void {
    setBusy("idle");
  }

  async function handleGenerate(): Promise<void> {
    setMessage(null);
    setBusy("generate");
    try {
      const res = await composeGenerate({ deploymentId });
      setMessage(`Compose ${res.changed ? "updated" : "unchanged"}: ${res.filePath}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to generate compose file");
    } finally {
      setIdle();
    }
  }

  async function handleStart(): Promise<void> {
    setMessage(null);
    setBusy("start");
    try {
      const res = await composeUp({ deploymentId });
      setMessage(`Started: ${res.services.join(", ")}`);
      // ensure status watch is running after up
      if (!statusSubscriptionId) {
        try {
          const { subscriptionId } = await composeStatusStart({ deploymentId, intervalMs: 2000 });
          setStatusSubscriptionId(subscriptionId);
        } catch {
          // ignore
        }
      }
      // auto-start logs for current selection (All or service)
      if (!logSubscriptionId) {
        await startLogs();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to start services");
    } finally {
      setIdle();
    }
  }

  async function handleStop(): Promise<void> {
    setMessage(null);
    setBusy("stop");
    try {
      const res = await composeDown({ deploymentId });
      setMessage(`Stopped: ${res.services.join(", ")}`);
      // stop status watch on down
      if (statusSubscriptionId) {
        try {
          await composeStatusStop({ subscriptionId: statusSubscriptionId });
        } catch {
          // ignore
        } finally {
          setStatusSubscriptionId(null);
        }
      }
      // stop logs stream if active
      if (logSubscriptionId) {
        try {
          await composeLogsStop({ subscriptionId: logSubscriptionId });
        } catch {
          // ignore
        } finally {
          setLogSubscriptionId(null);
        }
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to stop services");
    } finally {
      setIdle();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          className="rounded bg-slate-800 px-3 py-1 text-white hover:bg-slate-900 disabled:opacity-50"
          onClick={() => void handleGenerate()}
          disabled={isBusy}
          title="Generate docker-compose.yml"
        >
          {busy === "generate" ? <Spinner /> : "Generate"}
        </button>
        <button
          className="rounded bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700 disabled:opacity-50"
          onClick={() => void handleStart()}
          disabled={isBusy}
          title="docker compose up -d"
        >
          {busy === "start" ? <Spinner /> : "Start"}
        </button>
        <button
          className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700 disabled:opacity-50"
          onClick={() => void handleStop()}
          disabled={isBusy}
          title="docker compose down"
        >
          {busy === "stop" ? <Spinner /> : "Stop"}
        </button>
      </div>
      {message && (
        <ErrorBanner
          message={message}
          onClose={() => setMessage(null)}
        />
      )}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            className={`rounded px-2 py-1 text-sm ${!logService ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            onClick={() => setLogService(undefined)}
            title="Show logs from all services"
          >
            All ({logCounts[""] ?? 0})
          </button>
          {services.map((s) => (
            <button
              key={s.service}
              className={`rounded px-2 py-1 text-sm ${logService === s.service ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              onClick={() => setLogService(s.service)}
              title={`Show logs from ${s.service}`}
            >
              {s.service} ({logCounts[s.service] ?? 0})
            </button>
          ))}
        </div>
        <input
          className="w-48 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          placeholder="Filter (substring)"
          value={logFilter}
          onChange={(e) => setLogFilter(e.target.value)}
        />
        {logSubscriptionId ? (
          <button
            className="rounded bg-slate-700 px-3 py-1 text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={() => void stopLogs()}
          >
            Stop Logs
          </button>
        ) : (
          <button
            className="rounded bg-slate-700 px-3 py-1 text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={() => void startLogs()}
          >
            Follow Logs
          </button>
        )}
        <label className="flex items-center gap-1 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={logFollow}
            onChange={(e) => setLogFollow(e.target.checked)}
          />
          Auto-scroll
        </label>
        {logState !== "idle" && (
          <span className="text-xs text-slate-600">
            Logs: {logState === "connected" ? "live" : logState === "reconnecting" ? "reconnecting…" : "stopped"}
          </span>
        )}
        <button
          className="rounded px-3 py-1 text-slate-700 hover:bg-slate-100"
          onClick={() => {
            setLogBuffer([]);
            setLogCounts((_prev) => {
              const next: Record<string, number> = { "": 0 };
              for (const s of services) next[s.service] = 0;
              return next;
            });
          }}
        >
          Clear
        </button>
        <button
          className="rounded px-3 py-1 text-slate-700 hover:bg-slate-100"
          onClick={async () => {
            try {
              const content = logBuffer.join("\n");
              const res = await composeLogsExport({ deploymentId, service: logService, content });
              setMessage(`Exported logs to ${res.filePath}`);
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Failed to export logs");
            }
          }}
        >
          Export
        </button>
      </div>
      <div className="h-48 overflow-auto rounded border border-slate-200 bg-black p-2 font-mono text-xs text-slate-100">
        {logBuffer
          .filter((line) => (logFilter ? line.toLowerCase().includes(logFilter.toLowerCase()) : true))
          .map((line, idx) => (
            <div
              key={idx}
              className="whitespace-pre-wrap"
            >
              {line}
            </div>
          ))}
        <div ref={logsEndRef} />
      </div>
      <div className="rounded-md border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-sm font-medium text-slate-700">Status</div>
          <StatusRollup services={services} />
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="px-3 py-2">Service</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Health</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Container</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {services.map((s) => (
              <tr
                key={s.service}
                className="hover:bg-slate-50/50"
              >
                <td className="px-3 py-2 font-medium text-slate-900">{s.service}</td>
                <td className="px-3 py-2">
                  <StateBadge state={s.state} />
                </td>
                <td className="px-3 py-2">
                  <HealthBadge health={s.health} />
                </td>
                <td className="px-3 py-2 text-slate-600">{s.role ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600">{s.containerId ? s.containerId.slice(0, 12) : "-"}</td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td
                  className="px-3 py-3 text-slate-600"
                  colSpan={5}
                >
                  No services yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Spinner: React.FC = () => (
  <svg
    className="h-4 w-4 animate-spin"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    ></path>
  </svg>
);

const StatusRollup: React.FC<{ services: ComposeServiceStatus[] }> = ({ services }) => {
  const total = services.length;
  const running = services.filter((s) => s.state === "running").length;
  const exited = services.filter((s) => s.state === "exited").length;
  const unhealthy = services.filter((s) => s.health && s.health !== "healthy").length;
  return (
    <div className="flex items-center gap-3 text-xs text-slate-700">
      <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
        Running {running}/{total}
      </span>
      <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">Exited {exited}</span>
      <span className="rounded bg-red-50 px-2 py-0.5 text-red-700">Unhealthy {unhealthy}</span>
    </div>
  );
};

const StateBadge: React.FC<{ state: ComposeServiceStatus["state"] }> = ({ state }) => {
  const classes =
    state === "running"
      ? "bg-emerald-50 text-emerald-700"
      : state === "exited"
        ? "bg-slate-100 text-slate-700"
        : "bg-yellow-50 text-yellow-700";
  return <span className={`rounded px-2 py-0.5 text-xs ${classes}`}>{state}</span>;
};

const HealthBadge: React.FC<{ health?: string }> = ({ health }) => {
  if (!health) return <span className="text-slate-500">-</span>;
  const classes =
    health === "healthy"
      ? "bg-emerald-50 text-emerald-700"
      : health === "starting"
        ? "bg-yellow-50 text-yellow-700"
        : "bg-red-50 text-red-700";
  return <span className={`rounded px-2 py-0.5 text-xs ${classes}`}>{health}</span>;
};

const ErrorBanner: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  const hint = computeErrorHint(message);
  const base = "mb-2 rounded-md border px-3 py-2";
  const color =
    hint.severity === "warn"
      ? "border-yellow-200 bg-yellow-50 text-yellow-800"
      : "border-red-200 bg-red-50 text-red-800";
  return (
    <div className={`${base} ${color}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{hint.title}</div>
          <div className="mt-0.5 text-sm opacity-90">{message}</div>
          {hint.suggestions.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {hint.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          className="rounded px-2 py-1 text-sm hover:bg-black/5"
          onClick={onClose}
          aria-label="Dismiss error"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

function computeErrorHint(message: string): { title: string; suggestions: string[]; severity: "error" | "warn" } {
  const msg = message.toLowerCase();
  if (msg.includes("docker daemon is not running") || msg.includes("not reachable")) {
    return {
      title: "Docker daemon not running",
      suggestions: [
        "Start Docker Desktop and wait until it reports running.",
        "Run 'docker ps' in a terminal to verify connectivity.",
        "On Windows, ensure WSL integration is enabled for your distro.",
      ],
      severity: "error",
    };
  }
  if (msg.includes("docker cli not found") || msg.includes("not found in path")) {
    return {
      title: "Docker CLI not found",
      suggestions: [
        "Install Docker Desktop and ensure 'docker' is available in PATH.",
        "Restart your terminal/IDE after installation.",
      ],
      severity: "error",
    };
  }
  if (msg.includes("deployment not found")) {
    return {
      title: "Deployment not found",
      suggestions: ["Refresh the Deployments list.", "Create or select a valid deployment."],
      severity: "error",
    };
  }
  if (msg.includes("deployment file is missing")) {
    return {
      title: "Deployment files missing",
      suggestions: [
        "Regenerate docker-compose.yml using Generate.",
        "Open the Asterisk editor to (re)write config files.",
      ],
      severity: "error",
    };
  }
  if (msg.includes("port is already allocated") || msg.includes("address already in use")) {
    return {
      title: "Port conflict detected",
      suggestions: [
        "Stop the conflicting service or container using that port.",
        "Adjust the exposed ports in your deployment's Asterisk settings.",
        "Run Preflight to detect port conflicts early.",
      ],
      severity: "error",
    };
  }
  if (msg.includes("timed out")) {
    return {
      title: "Operation timed out",
      suggestions: ["Check network connectivity and image availability.", "Try again; initial pulls may take longer."],
      severity: "warn",
    };
  }
  return {
    title: "Action failed",
    suggestions: [
      "Review the error details above.",
      "Run Preflight to surface configuration issues.",
      "Check Docker Desktop for container logs and status.",
    ],
    severity: "error",
  };
}
