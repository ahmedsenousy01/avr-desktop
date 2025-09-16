import fs from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import { z } from "zod/v4";

import type {
  ComposeDownResponse,
  ComposeGenerateResponse,
  ComposeStatusResponse,
  ComposeUpResponse,
} from "@shared/ipc";
import { ComposeChannels, ComposeEventChannels } from "@shared/ipc";
import { DeploymentSchema } from "@shared/types/deployments";
import { buildComposeObject, getRoleForServiceName, writeComposeFile } from "@main/services/compose-writer";
import { findDeploymentDirById } from "@main/services/deployments-store";
import { getFriendlyDockerErrorMessage, runDocker, runDockerStream } from "@main/services/docker-cli";
import { readProviders } from "@main/services/providers-store";

// Runtime type guards to avoid unsafe casts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

const GenerateSchema = z.object({ deploymentId: z.string() });
const LogsStartSchema = z.object({ deploymentId: z.string(), service: z.string().optional() });

export function registerComposeIpcHandlers(): void {
  ipcMain.handle(ComposeChannels.generate, async (_event, req: unknown): Promise<ComposeGenerateResponse> => {
    const parsed = GenerateSchema.parse(req);

    const depDir = findDeploymentDirById(parsed.deploymentId);
    if (!depDir) throw new Error("Deployment not found");
    const depFile = path.join(depDir, "deployment.json");
    if (!fs.existsSync(depFile)) throw new Error("Deployment file is missing");
    const dep = DeploymentSchema.parse(JSON.parse(fs.readFileSync(depFile, "utf8")));

    const providers = readProviders();

    const { spec } = buildComposeObject(dep, providers, dep.asterisk);
    const { filePath, changed } = writeComposeFile(dep, providers, dep.asterisk);

    const services = Object.keys(spec.services);
    return { filePath, changed, services };
  });

  ipcMain.handle(ComposeChannels.up, async (_event, req: unknown): Promise<ComposeUpResponse> => {
    const parsed = GenerateSchema.parse(req);

    const depDir = findDeploymentDirById(parsed.deploymentId);
    if (!depDir) throw new Error("Deployment not found");
    const depFile = path.join(depDir, "deployment.json");
    if (!fs.existsSync(depFile)) throw new Error("Deployment file is missing");
    const dep = DeploymentSchema.parse(JSON.parse(fs.readFileSync(depFile, "utf8")));
    const providers = readProviders();

    try {
      const { spec } = buildComposeObject(dep, providers, dep.asterisk);
      const { stdout } = await runDocker(["compose", "up", "-d"], { cwd: depDir, timeoutMs: 60_000 });
      const services = Object.keys(spec.services);
      return { services, stdout };
    } catch (err) {
      const message = getFriendlyDockerErrorMessage(err);
      throw new Error(message);
    }
  });

  ipcMain.handle(ComposeChannels.down, async (_event, req: unknown): Promise<ComposeDownResponse> => {
    const parsed = GenerateSchema.parse(req);

    const depDir = findDeploymentDirById(parsed.deploymentId);
    if (!depDir) throw new Error("Deployment not found");
    const depFile = path.join(depDir, "deployment.json");
    if (!fs.existsSync(depFile)) throw new Error("Deployment file is missing");
    const dep = DeploymentSchema.parse(JSON.parse(fs.readFileSync(depFile, "utf8")));
    const providers = readProviders();

    try {
      const { spec } = buildComposeObject(dep, providers, dep.asterisk);
      const { stdout } = await runDocker(["compose", "down"], { cwd: depDir, timeoutMs: 60_000 });
      const services = Object.keys(spec.services);
      return { services, stdout };
    } catch (err) {
      const message = getFriendlyDockerErrorMessage(err);
      throw new Error(message);
    }
  });

  ipcMain.handle(ComposeChannels.status, async (_event, req: unknown): Promise<ComposeStatusResponse> => {
    const parsed = GenerateSchema.parse(req);

    const depDir = findDeploymentDirById(parsed.deploymentId);
    if (!depDir) throw new Error("Deployment not found");
    const depFile = path.join(depDir, "deployment.json");
    if (!fs.existsSync(depFile)) throw new Error("Deployment file is missing");
    const dep = DeploymentSchema.parse(JSON.parse(fs.readFileSync(depFile, "utf8")));
    const providers = readProviders();

    const { spec } = buildComposeObject(dep, providers, dep.asterisk);
    const wanted = new Set(Object.keys(spec.services));

    let out = "";
    try {
      const res = await runDocker(["compose", "ps", "--format", "json"], { cwd: depDir, timeoutMs: 30_000 });
      out = res.stdout.trim();
    } catch {
      // Try without json formatting; we'll mark unknown if parsing fails
      try {
        const res2 = await runDocker(["compose", "ps"], { cwd: depDir, timeoutMs: 30_000 });
        out = res2.stdout.trim();
      } catch {
        out = "";
      }
    }

    const statuses: ComposeStatusResponse["services"] = [];
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(out);
    } catch {
      parsedJson = null;
    }

    const byService: Partial<Record<string, { state?: string; health?: string; id?: string }>> = {};
    if (isRecordArray(parsedJson)) {
      for (const item of parsedJson) {
        const service = String(item["Service"] ?? "");
        if (!service) continue;
        byService[service] = {
          state: String(item["State"] ?? "").toLowerCase(),
          health: item["Health"] !== undefined ? String(item["Health"]) : undefined,
          id: item["ID"] !== undefined ? String(item["ID"]) : undefined,
        };
      }
    }

    // Fallback: enrich health via `docker inspect` for services lacking health
    const needsHealth: string[] = [];
    for (const svc of wanted) {
      if (!byService[svc] || byService[svc].health === undefined) needsHealth.push(svc);
    }
    if (needsHealth.length > 0) {
      try {
        const res = await runDocker(["inspect", ...needsHealth], { cwd: depDir, timeoutMs: 30_000 });
        const inspRaw: unknown = JSON.parse(res.stdout);
        if (Array.isArray(inspRaw)) {
          for (const obj of inspRaw) {
            if (!isRecord(obj)) continue;
            const rawName = obj["Name"];
            const name = typeof rawName === "string" ? rawName.replace(/^\//, "") : "";
            if (!name) continue;
            let health: string | undefined;
            const stateVal = obj["State"];
            if (isRecord(stateVal)) {
              const healthVal = stateVal["Health"];
              if (isRecord(healthVal)) {
                const statusVal = healthVal["Status"];
                if (typeof statusVal === "string") health = statusVal;
              }
            }
            if (!byService[name]) byService[name] = {};
            if (health) byService[name].health = health;
          }
        }
      } catch {
        // ignore inspect failures; health remains undefined
      }
    }

    for (const svc of wanted) {
      const info = byService[svc] ?? {};
      const state =
        typeof info.state === "string" && info.state.includes("running")
          ? "running"
          : typeof info.state === "string" && info.state.includes("exit")
            ? "exited"
            : "unknown";
      const role = getRoleForServiceName(svc, dep.slug);
      statuses.push({ service: svc, state, containerId: info.id, health: info.health, role });
    }

    return { services: statuses };
  });

  const LOG_BUFFER_MAX_LINES = 2000;
  const logStreams = new Map<string, { cancel: () => void; buffer: string[]; pendingPartial?: string }>();

  function appendToRing(entry: { buffer: string[]; pendingPartial?: string }, chunkText: string): void {
    const text = (entry.pendingPartial ? entry.pendingPartial : "") + chunkText;
    const hasTrailingNewline = text.endsWith("\n");
    const parts = text.split(/\n/);
    const completeLines = hasTrailingNewline ? parts : parts.slice(0, -1);
    for (const line of completeLines) {
      if (line.length === 0) {
        entry.buffer.push("");
      } else {
        entry.buffer.push(line);
      }
    }
    // keep last partial if there is one
    entry.pendingPartial = hasTrailingNewline ? undefined : parts[parts.length - 1];
    // trim to max lines
    if (entry.buffer.length > LOG_BUFFER_MAX_LINES) {
      entry.buffer.splice(0, entry.buffer.length - LOG_BUFFER_MAX_LINES);
    }
  }
  function genId(): string {
    return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  ipcMain.handle(ComposeChannels.logsStart, async (event, req: unknown): Promise<{ subscriptionId: string }> => {
    const parsed = LogsStartSchema.parse(req);

    const depDir = findDeploymentDirById(parsed.deploymentId);
    if (!depDir) throw new Error("Deployment not found");

    try {
      const args = ["compose", "logs", "--no-color", "--follow"];
      if (parsed.service) args.push(parsed.service);
      const stream = runDockerStream(args, { cwd: depDir, timeoutMs: 0 });
      const id = genId();
      const ring = { cancel: () => stream.cancel(), buffer: [] as string[] };
      logStreams.set(id, ring);
      stream.on("data", (chunk) => {
        const text = String(chunk);
        appendToRing(ring, text);
        event.sender.send(ComposeEventChannels.logsData, { subscriptionId: id, chunk: text });
      });
      stream.on("error", (err) => {
        const message = err instanceof Error ? err.message : String(err);
        event.sender.send(ComposeEventChannels.logsError, { subscriptionId: id, message });
      });
      stream.on("close", (code: number) => {
        event.sender.send(ComposeEventChannels.logsClosed, { subscriptionId: id, exitCode: code });
      });
      return { subscriptionId: id };
    } catch (err) {
      const message = getFriendlyDockerErrorMessage(err);
      throw new Error(message);
    }
  });

  ipcMain.handle(ComposeChannels.logsStop, async (_event, req: unknown): Promise<{ stopped: boolean }> => {
    const parsed = z.object({ subscriptionId: z.string() }).parse(req);
    const entry = logStreams.get(parsed.subscriptionId);
    if (!entry) return { stopped: false };
    entry.cancel();
    logStreams.delete(parsed.subscriptionId);
    return { stopped: true };
  });

  ipcMain.handle(ComposeChannels.logsExport, async (_event, req: unknown): Promise<{ filePath: string }> => {
    const parsed = z
      .object({ deploymentId: z.string(), service: z.string().optional(), content: z.string() })
      .parse(req);

    const depDir = findDeploymentDirById(parsed.deploymentId);
    if (!depDir) throw new Error("Deployment not found");
    const logsDir = path.join(depDir, "logs");
    try {
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const base = parsed.service ? `logs-${parsed.service}-${ts}.log` : `logs-all-${ts}.log`;
      const filePath = path.join(logsDir, base);
      fs.writeFileSync(filePath, parsed.content, "utf8");
      return { filePath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to export logs: ${message}`);
    }
  });

  // Status polling subscriptions (task 3.3)
  const statusPollers = new Map<string, { stop: () => void }>();
  ipcMain.handle(ComposeChannels.statusStart, async (event, req: unknown): Promise<{ subscriptionId: string }> => {
    const parsed = z.object({ deploymentId: z.string(), intervalMs: z.number().optional() }).parse(req);
    const depDir = findDeploymentDirById(parsed.deploymentId);
    if (!depDir) throw new Error("Deployment not found");
    const depFile = path.join(depDir, "deployment.json");
    if (!fs.existsSync(depFile)) throw new Error("Deployment file is missing");
    const dep = DeploymentSchema.parse(JSON.parse(fs.readFileSync(depFile, "utf8")));
    const providers = readProviders();
    const intervalMs = Math.max(500, parsed.intervalMs ?? 2000);
    const id = `status_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const { services } = await (async () => {
          const { spec } = buildComposeObject(dep, providers, dep.asterisk);
          const wanted = new Set(Object.keys(spec.services));
          let out = "";
          try {
            const res = await runDocker(["compose", "ps", "--format", "json"], { cwd: depDir, timeoutMs: 30_000 });
            out = res.stdout.trim();
          } catch {
            try {
              const res2 = await runDocker(["compose", "ps"], { cwd: depDir, timeoutMs: 30_000 });
              out = res2.stdout.trim();
            } catch {
              out = "";
            }
          }
          // parse compose ps output
          let parsedJson: unknown;
          try {
            parsedJson = JSON.parse(out);
          } catch {
            parsedJson = null;
          }
          const byService: Partial<Record<string, { state?: string; health?: string; id?: string }>> = {};
          if (isRecordArray(parsedJson)) {
            for (const item of parsedJson) {
              const service = String(item["Service"] ?? "");
              if (!service) continue;
              byService[service] = {
                state: String(item["State"] ?? "").toLowerCase(),
                health: item["Health"] !== undefined ? String(item["Health"]) : undefined,
                id: item["ID"] !== undefined ? String(item["ID"]) : undefined,
              };
            }
          }
          const statusesOut: ComposeStatusResponse["services"] = [];
          for (const svc of wanted) {
            const info = byService[svc] ?? {};
            const state =
              typeof info.state === "string" && info.state.includes("running")
                ? "running"
                : typeof info.state === "string" && info.state.includes("exit")
                  ? "exited"
                  : "unknown";
            const role = getRoleForServiceName(svc, dep.slug);
            statusesOut.push({ service: svc, state, containerId: info.id, health: info.health, role });
          }
          return { services: statusesOut };
        })();
        event.sender.send(ComposeEventChannels.statusUpdate, { subscriptionId: id, services });
      } catch {
        // ignore tick errors
      }
    };

    const timer = setInterval(() => {
      void tick();
    }, intervalMs);
    statusPollers.set(id, {
      stop: () => {
        stopped = true;
        clearInterval(timer);
      },
    });
    // fire initial tick
    void tick();
    return { subscriptionId: id };
  });

  ipcMain.handle(ComposeChannels.statusStop, async (_event, req: unknown): Promise<{ stopped: boolean }> => {
    const parsed = z.object({ subscriptionId: z.string() }).parse(req);
    const entry = statusPollers.get(parsed.subscriptionId);
    if (!entry) return { stopped: false };
    entry.stop();
    statusPollers.delete(parsed.subscriptionId);
    return { stopped: true };
  });
}
