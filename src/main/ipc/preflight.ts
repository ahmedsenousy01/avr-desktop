import { ipcMain } from "electron";
import { z } from "zod/v4";

import type { PreflightFixResponse, PreflightLastResponse, PreflightRunResponse } from "@shared/ipc";
import { PreflightChannels } from "@shared/ipc";
import { DeploymentSchema } from "@shared/types/deployments";
import {
  findDeploymentDirById,
  readPreflightResultByDeploymentId,
  writePreflightResultByDeploymentId,
} from "@main/services/deployments-store";
import { runDocker } from "@main/services/docker-cli";
import { buildPreflightChecks, createDockerAvailabilityCheck, runPreflight } from "@main/services/preflight";

const RunSchema = z.object({ deploymentId: z.string() });

export function registerPreflightIpcHandlers(): void {
  ipcMain.handle(PreflightChannels.run, async (_event, req: unknown): Promise<PreflightRunResponse> => {
    const parsed = RunSchema.parse(req);
    const dir = findDeploymentDirById(parsed.deploymentId);
    if (!dir) throw new Error("Deployment not found");

    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const deploymentFile = join(dir, "deployment.json");
    const dep = DeploymentSchema.parse(JSON.parse(readFileSync(deploymentFile, "utf8")));

    const checks = [createDockerAvailabilityCheck(), ...buildPreflightChecks(dep)];
    const result = await runPreflight(checks);

    writePreflightResultByDeploymentId(parsed.deploymentId, result);
    return { result };
  });

  ipcMain.handle(PreflightChannels.last, async (_event, req: unknown): Promise<PreflightLastResponse> => {
    const parsed = RunSchema.parse(req);
    const dir = findDeploymentDirById(parsed.deploymentId);
    if (!dir) throw new Error("Deployment not found");
    const result = readPreflightResultByDeploymentId(parsed.deploymentId);
    return { result };
  });

  ipcMain.handle(PreflightChannels.fix, async (_event, req: unknown): Promise<PreflightFixResponse> => {
    const FixSchema = z.object({ deploymentId: z.string(), itemId: z.string() });
    const parsed = FixSchema.parse(req);

    const last = readPreflightResultByDeploymentId(parsed.deploymentId);
    if (!last) return { fixed: false, message: "No previous preflight results to infer a fix" };
    const item = last.items.find((i) => i.id === parsed.itemId);
    if (!item) return { fixed: false, message: "Preflight item not found in last results" };

    // Current auto-fix implementations
    if (item.id === "docker:ports:conflicts") {
      // Suggest new SIP/RTP and persist to deployment.json
      const data = (item.data ?? {}) as {
        sipPort?: number;
        rtpRange?: { start: number; end: number };
        conflicts?: { hostPort: number }[];
      };
      const sipPort = Number(data.sipPort ?? 5060);
      const rtp = data.rtpRange ?? { start: 10000, end: 20000 };
      const used = new Set<number>((data.conflicts ?? []).map((c) => c.hostPort));
      const isInRtp = (p: number) => p >= rtp.start && p <= rtp.end;
      function nextFree(start: number): number {
        let p = Math.max(1024, start);
        while (used.has(p) || isInRtp(p)) p += 1;
        return p;
      }
      function findFreeRange(size: number, startFrom = Math.max(1024, rtp.start)) {
        let s = startFrom;
        while (true) {
          const e = s + size - 1;
          let ok = true;
          for (let p = s; p <= e; p += 1) {
            if (used.has(p) || p === sipPort) {
              ok = false;
              break;
            }
          }
          if (ok) return { start: s, end: e } as const;
          s = e + 1;
          if (s > 65000) return null;
        }
      }
      const size = Math.max(0, rtp.end - rtp.start + 1);
      const suggestedRtp = findFreeRange(size) ?? { start: 30000, end: 30000 + size - 1 };
      const suggestedSip =
        used.has(sipPort) || (sipPort >= suggestedRtp.start && sipPort <= suggestedRtp.end)
          ? nextFree(suggestedRtp.end + 1)
          : sipPort;

      // Persist changes
      const dir = findDeploymentDirById(parsed.deploymentId);
      if (!dir) throw new Error("Deployment not found");
      const { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } = await import("node:fs");
      const { join } = await import("node:path");
      const file = join(dir, "deployment.json");
      const current = JSON.parse(readFileSync(file, "utf8"));
      const next = {
        ...current,
        asterisk: {
          ...(current.asterisk ?? {}),
          sipPort: suggestedSip,
          rtpStart: suggestedRtp.start,
          rtpEnd: suggestedRtp.end,
        },
        updatedAt: new Date().toISOString(),
      };
      // Atomic write to avoid readers seeing partial JSON
      const tmp = join(dir, `.deployment.json.tmp-${process.pid}-${Date.now()}`);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
      renameSync(tmp, file);
      return {
        fixed: true,
        applied: { asterisk: { sipPort: suggestedSip, rtpStart: suggestedRtp.start, rtpEnd: suggestedRtp.end } },
        message: "Updated SIP/RTP to avoid Docker port conflicts",
      };
    }

    if (item.id.startsWith("asterisk:rtp:")) {
      // Simple normalization: ensure rtpStart < rtpEnd and no overlap with SIP by shifting RTP up
      const dir = findDeploymentDirById(parsed.deploymentId);
      if (!dir) throw new Error("Deployment not found");
      const { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } = await import("node:fs");
      const { join } = await import("node:path");
      const file = join(dir, "deployment.json");
      const current = JSON.parse(readFileSync(file, "utf8"));
      const sip = Number(current.asterisk?.sipPort ?? 5060);
      let start = Number(current.asterisk?.rtpStart ?? 10000);
      let end = Number(current.asterisk?.rtpEnd ?? 20000);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) {
        start = 10000;
        end = 20000;
      }
      if (start >= end) end = start + 1000;
      if (sip >= start && sip <= end) {
        const width = Math.max(500, end - start + 1);
        start = 30000;
        end = start + width - 1;
      }
      const next = {
        ...current,
        asterisk: { ...(current.asterisk ?? {}), rtpStart: start, rtpEnd: end },
        updatedAt: new Date().toISOString(),
      };
      const tmp = join(dir, `.deployment.json.tmp-${process.pid}-${Date.now()}`);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
      renameSync(tmp, file);
      return { fixed: true, applied: { asterisk: { rtpStart: start, rtpEnd: end } }, message: "Adjusted RTP range" };
    }

    if (item.id.startsWith("port:tcp:127.0.0.1:")) {
      // Adjust SIP or RTP to avoid a host port usage
      const m = item.id.match(/port:tcp:127\.0\.0\.1:(\d+)/);
      const usedPort = m ? Number(m[1]) : NaN;
      if (!Number.isFinite(usedPort)) return { fixed: false, message: "Could not parse port from item id" };

      const dir = findDeploymentDirById(parsed.deploymentId);
      if (!dir) throw new Error("Deployment not found");
      const { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } = await import("node:fs");
      const { join } = await import("node:path");
      const file = join(dir, "deployment.json");
      const current = JSON.parse(readFileSync(file, "utf8"));
      const sipPort = Number(current.asterisk?.sipPort ?? 5060);
      const rtpStart = Number(current.asterisk?.rtpStart ?? 10000);
      const rtpEnd = Number(current.asterisk?.rtpEnd ?? 20000);
      const inRtp = usedPort >= rtpStart && usedPort <= rtpEnd;

      function nextFree(start: number, blockStart: number, blockEnd: number): number {
        let p = Math.max(1024, start);
        while (p >= blockStart && p <= blockEnd) p += 1;
        return p;
      }

      if (usedPort === sipPort) {
        const nextSip = nextFree(sipPort + 1, rtpStart, rtpEnd);
        const next = {
          ...current,
          asterisk: { ...(current.asterisk ?? {}), sipPort: nextSip },
          updatedAt: new Date().toISOString(),
        };
        const tmp = join(dir, `.deployment.json.tmp-${process.pid}-${Date.now()}`);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
        renameSync(tmp, file);
        return {
          fixed: true,
          applied: { asterisk: { sipPort: nextSip } },
          message: "Moved SIP port off busy host port",
        };
      }

      if (inRtp) {
        const width = Math.max(1, rtpEnd - rtpStart + 1);
        // Move RTP block above the busy port, preserving width
        const newStart = Math.max(1024, usedPort + 1);
        const newEnd = newStart + width - 1;
        const next = {
          ...current,
          asterisk: { ...(current.asterisk ?? {}), rtpStart: newStart, rtpEnd: newEnd },
          updatedAt: new Date().toISOString(),
        };
        const tmp = join(dir, `.deployment.json.tmp-${process.pid}-${Date.now()}`);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
        renameSync(tmp, file);
        return {
          fixed: true,
          applied: { asterisk: { rtpStart: newStart, rtpEnd: newEnd } },
          message: "Shifted RTP range to avoid busy host port",
        };
      }

      return { fixed: false, message: "Host port is unrelated to planned SIP/RTP; no change applied" };
    }

    if (item.id.startsWith("docker:names:")) {
      // Guarded cleanup: remove containers/networks/volumes matching prefix
      const data = (item.data ?? {}) as {
        prefix?: string;
        containers?: string[];
        networks?: string[];
        volumes?: string[];
      };
      const removed = { containers: [] as string[], networks: [] as string[], volumes: [] as string[] };
      try {
        if (Array.isArray(data.containers) && data.containers.length > 0) {
          await runDocker(["rm", "-f", ...data.containers], { timeoutMs: 8000 });
          removed.containers = data.containers.slice();
        }
      } catch {
        // continue; best-effort
      }
      try {
        if (Array.isArray(data.networks) && data.networks.length > 0) {
          await runDocker(["network", "rm", ...data.networks], { timeoutMs: 8000 });
          removed.networks = data.networks.slice();
        }
      } catch {
        // continue; best-effort
      }
      try {
        if (Array.isArray(data.volumes) && data.volumes.length > 0) {
          await runDocker(["volume", "rm", ...data.volumes], { timeoutMs: 8000 });
          removed.volumes = data.volumes.slice();
        }
      } catch {
        // continue; best-effort
      }
      const didSomething = removed.containers.length + removed.networks.length + removed.volumes.length > 0;
      return didSomething
        ? { fixed: true, applied: { removedDocker: removed }, message: "Removed conflicting Docker resources" }
        : { fixed: false, message: "No matching Docker resources to remove" };
    }

    if (item.id.startsWith("provider:") && item.id.endsWith(":apiKey")) {
      return { fixed: false, message: "Open Providers settings to add API key" };
    }

    return { fixed: false, message: "No auto-fix available for this item" };
  });
}
