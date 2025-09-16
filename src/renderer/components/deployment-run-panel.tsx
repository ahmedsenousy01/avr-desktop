import React, { useEffect, useMemo, useRef, useState } from "react";

import type { ComposeLogsClosedEvent, ComposeLogsDataEvent, ComposeServiceStatus } from "@shared/ipc";
import {
  composeDown,
  composeGenerate,
  composeLogsStart,
  composeLogsStop,
  composeStatus,
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
  const pollingRef = useRef<number | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const [logFollow, setLogFollow] = useState<boolean>(true);
  const [logFilter, setLogFilter] = useState<string>("");
  const [logService, setLogService] = useState<string | undefined>(undefined);
  const [logSubscriptionId, setLogSubscriptionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>("");
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const isBusy = useMemo(() => busy !== "idle", [busy]);

  useEffect(() => {
    async function tick(): Promise<void> {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const res = await composeStatus({ deploymentId });
        setServices(res.services);
      } catch {
        // swallow errors for polling
      } finally {
        inFlightRef.current = false;
      }
    }

    void tick();
    pollingRef.current = window.setInterval(() => {
      void tick();
    }, 2000);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [deploymentId]);

  async function startLogs(): Promise<void> {
    try {
      if (logSubscriptionId) {
        await composeLogsStop({ subscriptionId: logSubscriptionId });
        setLogSubscriptionId(null);
      }
      setLogs("");
      const { subscriptionId } = await composeLogsStart({ deploymentId, service: logService });
      setLogSubscriptionId(subscriptionId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to start logs");
    }
  }

  async function stopLogs(): Promise<void> {
    try {
      if (!logSubscriptionId) return;
      await composeLogsStop({ subscriptionId: logSubscriptionId });
    } catch {
      // non-fatal
    } finally {
      setLogSubscriptionId(null);
    }
  }

  useEffect(() => {
    if (!logFollow) return;
    if (
      logsEndRef.current &&
      typeof (logsEndRef.current as unknown as { scrollIntoView?: unknown }).scrollIntoView === "function"
    ) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, logFollow]);

  useEffect(() => {
    // Subscribe to logs events
    const win = window as unknown as {
      composeEvents?: {
        onLogsData: (cb: (payload: unknown) => void) => void;
        onLogsClosed: (cb: (payload: unknown) => void) => void;
      };
    };
    const onData = (payload: unknown) => {
      const evt = payload as ComposeLogsDataEvent;
      if (!logSubscriptionId || evt.subscriptionId !== logSubscriptionId) return;
      setLogs((prev) => (prev.length ? prev + "\n" + evt.chunk : evt.chunk));
    };
    const onClosed = (payload: unknown) => {
      const evt = payload as ComposeLogsClosedEvent;
      if (!logSubscriptionId || evt.subscriptionId !== logSubscriptionId) return;
      setLogSubscriptionId(null);
    };
    win.composeEvents?.onLogsData(onData);
    win.composeEvents?.onLogsClosed(onClosed);
    return () => {
      // best-effort: no off() provided; new handlers replace page lifecycle
    };
  }, [logSubscriptionId]);

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
        <select
          className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          value={logService ?? ""}
          onChange={(e) => setLogService(e.target.value || undefined)}
        >
          <option value="">All services</option>
          {services.map((s) => (
            <option
              key={s.service}
              value={s.service}
            >
              {s.service}
            </option>
          ))}
        </select>
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
        <button
          className="rounded px-3 py-1 text-slate-700 hover:bg-slate-100"
          onClick={() => setLogs("")}
        >
          Clear
        </button>
      </div>
      <div className="h-48 overflow-auto rounded border border-slate-200 bg-black p-2 font-mono text-xs text-slate-100">
        {logs
          .split(/\n/)
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
