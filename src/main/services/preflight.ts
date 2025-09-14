// -- Provider keys check -----------------------------------------------------

import { createServer } from "node:net";

import type { AsteriskConfig } from "@shared/types/asterisk";
import type { Deployment } from "@shared/types/deployments";
import type { PreflightItem, PreflightSeverity } from "@shared/types/preflight";
import type { ProviderId } from "@shared/types/providers";
import { DEFAULT_ASTERISK_CONFIG } from "@shared/types/asterisk";
import { getProviderDisplayLabel } from "@shared/types/providers";
import { checkDockerAvailable, runDocker } from "@main/services/docker-cli";
import { readProviders } from "@main/services/providers-store";

export type PreflightContext = Record<string, never>;

export interface PreflightCheckSpec {
  id: string;
  title: string;
  run: (ctx: PreflightContext) => Promise<PreflightItem | PreflightItem[] | void>;
  timeoutMs?: number;
}

export interface PreflightRunOptions {
  timeoutPerCheckMs?: number;
  now?: () => number;
}

export interface PreflightSummary {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  overall: PreflightSeverity; // Highest severity observed
}

export interface PreflightRunResult {
  items: PreflightItem[];
  summary: PreflightSummary;
}

function computeOverallSeverity(counts: { pass: number; warn: number; fail: number }): PreflightSeverity {
  if (counts.fail > 0) return "fail";
  if (counts.warn > 0) return "warn";
  return "pass";
}

async function runWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Preflight check timed out"));
    }, ms);
    promise
      .then((v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function runPreflight(
  checks: PreflightCheckSpec[],
  options?: PreflightRunOptions
): Promise<PreflightRunResult> {
  const now = options?.now ?? (() => Date.now());
  const defaultTimeout = options?.timeoutPerCheckMs ?? 10_000;
  const startedAt = now();

  const ctx: PreflightContext = {};
  const items: PreflightItem[] = [];

  for (const spec of checks) {
    const timeoutMs = spec.timeoutMs ?? defaultTimeout;
    try {
      const result = await runWithTimeout(Promise.resolve(spec.run(ctx)), timeoutMs);
      if (Array.isArray(result)) {
        for (const it of result) items.push(it);
      } else if (result) {
        items.push(result);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      items.push({
        id: `${spec.id}:error`,
        title: `${spec.title} Error`,
        severity: "fail",
        message,
        data: { checkId: spec.id },
      });
    }
  }

  const counts = items.reduce(
    (acc, it) => {
      if (it.severity === "pass") acc.pass += 1;
      else if (it.severity === "warn") acc.warn += 1;
      else acc.fail += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 }
  );

  const finishedAt = now();
  const summary: PreflightSummary = {
    total: items.length,
    pass: counts.pass,
    warn: counts.warn,
    fail: counts.fail,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    overall: computeOverallSeverity(counts),
  };

  const sorted = sortPreflightItems(items);
  return { items: sorted, summary };
}

function asRequiredProviderIds(deployment: Deployment): ProviderId[] {
  const required = new Set<ProviderId>();
  if (deployment.type === "modular") {
    const { llm, asr, tts } = deployment.providers;
    if (llm === "openai" || llm === "anthropic" || llm === "gemini") required.add(llm);
    if (asr === "deepgram") required.add("deepgram");
    if (tts === "elevenlabs") required.add("elevenlabs");
  } else {
    // MVP: STS selections do not require stored API keys in providers.json
    // (e.g., 'openai-realtime', 'ultravox'). No-op.
  }
  return Array.from(required);
}

export function createProviderKeysCheck(deployment: Deployment): PreflightCheckSpec {
  return {
    id: "providers:keys",
    title: "Provider API Keys",
    async run() {
      const providers = readProviders();
      const required = asRequiredProviderIds(deployment);
      const items: PreflightItem[] = [];
      for (const pid of required) {
        const apiKey = providers[pid].apiKey;
        const hasKey = typeof apiKey === "string" && apiKey.trim().length > 0;
        const label = getProviderDisplayLabel(pid);
        items.push({
          id: `provider:${pid}:apiKey`,
          title: `${label} API Key`,
          severity: hasKey ? "pass" : "fail",
          message: hasKey ? `${label} API key is configured` : `${label} API key is missing`,
          remediation: hasKey ? undefined : `Add your ${label} API key in Providers settings`,
          data: { providerId: pid },
        });
      }
      return items;
    },
  };
}

// -- Docker name collisions ---------------------------------------------------

async function execDocker(args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await runDocker(args, { timeoutMs });
  return { stdout, stderr };
}

// -- Result grouping and sorting ---------------------------------------------

const SEVERITY_ORDER: Readonly<Record<PreflightSeverity, number>> = {
  fail: 0,
  warn: 1,
  pass: 2,
};

export function sortPreflightItems(items: PreflightItem[]): PreflightItem[] {
  return [...items].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    // Tie-break by title then id for stable ordering
    const byTitle = a.title.localeCompare(b.title);
    if (byTitle !== 0) return byTitle;
    return a.id.localeCompare(b.id);
  });
}

export function groupPreflightItemsBySeverity(items: PreflightItem[]): {
  fail: PreflightItem[];
  warn: PreflightItem[];
  pass: PreflightItem[];
} {
  const groups = { fail: [] as PreflightItem[], warn: [] as PreflightItem[], pass: [] as PreflightItem[] };
  for (const it of items) {
    if (it.severity === "fail") groups.fail.push(it);
    else if (it.severity === "warn") groups.warn.push(it);
    else groups.pass.push(it);
  }
  groups.fail = sortPreflightItems(groups.fail);
  groups.warn = sortPreflightItems(groups.warn);
  groups.pass = sortPreflightItems(groups.pass);
  return groups;
}

function parseListOutput(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function createNameCollisionCheck(deployment: Deployment): PreflightCheckSpec {
  return {
    id: "docker:names",
    title: "Docker Name Collisions",
    async run() {
      const prefix = `${deployment.slug}-`;
      try {
        const containers = parseListOutput(
          (await execDocker(["ps", "-a", "--format", "{{.Names}}"], 8_000)).stdout
        ).filter((n) => n.startsWith(prefix));
        const networks = parseListOutput(
          (await execDocker(["network", "ls", "--format", "{{.Name}}"], 8_000)).stdout
        ).filter((n) => n.startsWith(prefix));
        const volumes = parseListOutput(
          (await execDocker(["volume", "ls", "--format", "{{.Name}}"], 8_000)).stdout
        ).filter((n) => n.startsWith(prefix));

        const total = containers.length + networks.length + volumes.length;
        if (total > 0) {
          return {
            id: "docker:names:collisions",
            title: "Docker name collisions detected",
            severity: "fail",
            message: `Found ${total} existing Docker resource(s) matching '${prefix}*'`,
            remediation: "Remove or rename conflicting containers/networks/volumes before starting",
            data: { prefix, containers, networks, volumes },
          } as PreflightItem;
        }

        return {
          id: "docker:names:none",
          title: "No Docker name collisions",
          severity: "pass",
          message: `No existing Docker resources match '${prefix}*'`,
          data: { prefix },
        } as PreflightItem;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          id: "docker:names:error",
          title: "Failed to inspect Docker resources",
          severity: "warn",
          message,
        } as PreflightItem;
      }
    },
  };
}

// -- Port probe planning ------------------------------------------------------

export interface PortProbePlan {
  sipPort: number;
  rtpRange: { start: number; end: number };
  servicePorts: number[]; // reserved for future declared service ports
}

function getEffectiveAsteriskConfig(fromDeployment?: AsteriskConfig): AsteriskConfig {
  const base = DEFAULT_ASTERISK_CONFIG;
  if (!fromDeployment) return base;
  return { ...base, ...fromDeployment };
}

export function buildPortProbePlan(deployment: Deployment): PortProbePlan {
  const ast = getEffectiveAsteriskConfig(deployment.asterisk as AsteriskConfig | undefined);
  return {
    sipPort: ast.sipPort,
    rtpRange: { start: ast.rtpStart, end: ast.rtpEnd },
    servicePorts: [],
  };
}

// -- Host TCP port availability ----------------------------------------------

async function isTcpPortFree(port: number, host = "127.0.0.1", timeoutMs = 750): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const server = createServer();
    const timer = setTimeout(() => {
      try {
        server.close();
      } catch {
        // ignore
      }
      resolve(false);
    }, timeoutMs);

    server.once("error", (err: unknown) => {
      clearTimeout(timer);
      const code = (err as { code?: string } | undefined)?.code;
      // EADDRINUSE: already in use -> not free; EACCES: permission -> treat as not free
      if (code === "EADDRINUSE" || code === "EACCES") resolve(false);
      else resolve(false);
    });

    server.listen({ port, host, exclusive: true }, () => {
      clearTimeout(timer);
      server.close(() => resolve(true));
    });
  });
}

export function createHostPortsCheck(deployment: Deployment): PreflightCheckSpec {
  return {
    id: "host:ports",
    title: "Host TCP Ports Availability",
    async run() {
      const plan = buildPortProbePlan(deployment);
      const ports: number[] = [plan.sipPort];
      const sampleCount = Math.min(16, Math.max(0, plan.rtpRange.end - plan.rtpRange.start + 1));
      for (let i = 0; i < sampleCount; i += 1) {
        const p = plan.rtpRange.start + i;
        if (!ports.includes(p)) ports.push(p);
      }
      for (const p of plan.servicePorts) if (!ports.includes(p)) ports.push(p);

      const items: PreflightItem[] = [];
      for (const port of ports) {
        const free = await isTcpPortFree(port);
        const isSipOrService = port === plan.sipPort || plan.servicePorts.includes(port);
        const severity: PreflightSeverity = free ? "pass" : isSipOrService ? "fail" : "warn";
        items.push({
          id: `port:tcp:127.0.0.1:${port}`,
          title: `TCP ${port}`,
          severity,
          message: free ? `Port ${port} is free on localhost` : `Port ${port} is in use on localhost`,
          data: { port, host: "127.0.0.1" },
        });
      }
      return items;
    },
  };
}

// -- Docker container port mappings vs planned ports -------------------------

interface DockerMappedPort {
  container: string;
  hostPort: number;
  protocol: string; // "tcp" | "udp" | other
  raw: string; // original token
}

// -- Docker availability ------------------------------------------------------

export function createDockerAvailabilityCheck(): PreflightCheckSpec {
  return {
    id: "docker:available",
    title: "Docker Availability",
    async run() {
      const res = await checkDockerAvailable(5_000);
      if (res.available) {
        return {
          id: "docker:available:ok",
          title: "Docker is available",
          severity: "pass",
          message: res.version ? `Docker daemon version ${res.version}` : "Docker daemon is available",
          data: { version: res.version ?? null },
        } as PreflightItem;
      }
      return {
        id: "docker:available:nok",
        title: "Docker is not available",
        severity: "fail",
        message: res.message ?? "Docker CLI/daemon not available",
      } as PreflightItem;
    },
  };
}

// -- Composer ----------------------------------------------------------------

export function buildPreflightChecks(deployment: Deployment): PreflightCheckSpec[] {
  return [
    createProviderKeysCheck(deployment),
    createAsteriskRtpValidationCheck(deployment),
    createNameCollisionCheck(deployment),
    createDockerPortConflictsCheck(deployment),
    createHostPortsCheck(deployment),
  ];
}

async function listDockerMappedHostPorts(): Promise<DockerMappedPort[]> {
  const { stdout } = await execDocker(["ps", "--format", "{{.Names}}|{{.Ports}}"], 8_000);
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const results: DockerMappedPort[] = [];
  for (const line of lines) {
    const [name, portsStr = ""] = line.split("|");
    if (!portsStr) continue;
    const tokens = portsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    for (const tok of tokens) {
      // Examples: "0.0.0.0:8080->80/tcp", ":::5060->5060/udp", "80/tcp" (no host mapping)
      const arrowIdx = tok.indexOf("->");
      if (arrowIdx === -1) continue; // skip unmapped
      const left = tok.slice(0, arrowIdx);
      const right = tok.slice(arrowIdx + 2);
      // host part can be "0.0.0.0:PORT" or ":::PORT" or "[::]:PORT"; extract trailing number
      const mLeft = left.match(/(\d+)\s*$/);
      const mRight = right.match(/\/(tcp|udp)/i);
      if (!mLeft) continue;
      const hostPort = Number(mLeft[1]);
      const protocol = mRight ? mRight[1].toLowerCase() : "tcp";
      if (Number.isFinite(hostPort)) {
        results.push({ container: name, hostPort, protocol, raw: tok });
      }
    }
  }
  return results;
}

export function createDockerPortConflictsCheck(deployment: Deployment): PreflightCheckSpec {
  return {
    id: "docker:ports",
    title: "Docker Port Mappings Conflicts",
    async run() {
      const plan = buildPortProbePlan(deployment);
      try {
        const mapped = await listDockerMappedHostPorts();
        const conflicts: DockerMappedPort[] = [];
        for (const mp of mapped) {
          if (mp.hostPort === plan.sipPort) conflicts.push(mp);
          else if (mp.hostPort >= plan.rtpRange.start && mp.hostPort <= plan.rtpRange.end) conflicts.push(mp);
          else if (plan.servicePorts.includes(mp.hostPort)) conflicts.push(mp);
        }
        if (conflicts.length > 0) {
          const hasHard = conflicts.some((c) => c.hostPort === plan.sipPort || plan.servicePorts.includes(c.hostPort));
          const severity: PreflightSeverity = hasHard ? "fail" : "warn"; // RTP-only overlaps are soft
          return {
            id: "docker:ports:conflicts",
            title: "Docker port mapping conflicts detected",
            severity,
            message: `Found ${conflicts.length} Docker port mapping(s) conflicting with planned ports`,
            remediation: "Stop or reconfigure the conflicting containers, or change your planned ports",
            data: {
              sipPort: plan.sipPort,
              rtpRange: plan.rtpRange,
              conflicts: conflicts.map((c) => ({
                container: c.container,
                hostPort: c.hostPort,
                protocol: c.protocol,
                raw: c.raw,
              })),
            },
          } as PreflightItem;
        }
        return {
          id: "docker:ports:none",
          title: "No Docker port mapping conflicts",
          severity: "pass",
          message: "No existing Docker host port mappings conflict with planned ports",
          data: { sipPort: plan.sipPort, rtpRange: plan.rtpRange },
        } as PreflightItem;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          id: "docker:ports:error",
          title: "Failed to inspect Docker port mappings",
          severity: "warn",
          message,
        } as PreflightItem;
      }
    },
  };
}

// -- Asterisk RTP range validation --------------------------------------------

export function createAsteriskRtpValidationCheck(deployment: Deployment): PreflightCheckSpec {
  return {
    id: "asterisk:rtp",
    title: "Asterisk RTP Range Validation",
    async run() {
      const plan = buildPortProbePlan(deployment);
      const items: PreflightItem[] = [];

      const rtpStart = plan.rtpRange.start;
      const rtpEnd = plan.rtpRange.end;
      const sipPort = plan.sipPort;
      const rangeSize = Math.max(0, rtpEnd - rtpStart + 1);

      // Bounds validity
      if (!(Number.isFinite(rtpStart) && Number.isFinite(rtpEnd)) || rtpStart <= 0 || rtpEnd <= 0) {
        items.push({
          id: "asterisk:rtp:bounds:invalid",
          title: "Invalid RTP port bounds",
          severity: "fail",
          message: `RTP range must be positive integers; got ${rtpStart}..${rtpEnd}`,
          remediation: "Set valid numeric RTP port bounds in Asterisk settings",
          data: { rtpStart, rtpEnd },
        });
      } else if (rtpStart >= rtpEnd) {
        items.push({
          id: "asterisk:rtp:bounds:order",
          title: "RTP start must be less than end",
          severity: "fail",
          message: `RTP start (${rtpStart}) must be less than end (${rtpEnd})`,
          remediation: "Adjust RTP start/end so start < end",
          data: { rtpStart, rtpEnd },
        });
      }

      // Overlap with SIP
      if (sipPort >= rtpStart && sipPort <= rtpEnd) {
        items.push({
          id: "asterisk:rtp:overlap:sip",
          title: "SIP port overlaps RTP range",
          severity: "fail",
          message: `SIP port ${sipPort} lies within RTP range ${rtpStart}-${rtpEnd}`,
          remediation: "Move SIP port or adjust RTP range to avoid overlap",
          data: { sipPort, rtpStart, rtpEnd },
        });
      }

      // Range hints
      if (rangeSize > 50_000) {
        items.push({
          id: "asterisk:rtp:size:huge",
          title: "RTP range is unusually large",
          severity: "warn",
          message: `RTP range spans ${rangeSize} ports (${rtpStart}-${rtpEnd})`,
          remediation: "Consider narrowing the RTP range to a practical size",
          data: { rangeSize },
        });
      } else if (rangeSize > 0 && rangeSize < 10) {
        items.push({
          id: "asterisk:rtp:size:small",
          title: "RTP range may be too small",
          severity: "warn",
          message: `Only ${rangeSize} RTP ports available (${rtpStart}-${rtpEnd}); may limit concurrent streams`,
          remediation: "Increase RTP end or lower start to allow more concurrent media streams",
          data: { rangeSize },
        });
      }

      // Ports below 1024 warning (privileged)
      if (rtpStart < 1024 || rtpEnd < 1024) {
        items.push({
          id: "asterisk:rtp:privileged",
          title: "RTP uses privileged ports",
          severity: "warn",
          message: `RTP range includes ports below 1024 (${rtpStart}-${rtpEnd}) which may require elevated privileges`,
          remediation: "Prefer RTP ports above 1024 unless you manage capabilities explicitly",
          data: { rtpStart, rtpEnd },
        });
      }

      return items.length > 0
        ? items
        : ({
            id: "asterisk:rtp:ok",
            title: "RTP range is valid",
            severity: "pass",
            message: `RTP ${rtpStart}-${rtpEnd} does not overlap SIP ${sipPort}`,
            data: { rtpStart, rtpEnd, sipPort },
          } as PreflightItem);
    },
  };
}
