import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PreflightCheckSpec } from "@main/services/preflight";
import type { PreflightItem } from "@shared/types/preflight";
import { DeploymentsChannels, PreflightChannels } from "@shared/ipc";
import { registerDeploymentsIpcHandlers } from "@main/ipc/deployments";
import { registerPreflightIpcHandlers } from "@main/ipc/preflight";

// Mock electron's ipcMain and provide a helper to invoke handlers
type IpcHandler = (event: unknown, payload: unknown) => unknown | Promise<unknown>;
const handlers = new Map<string, IpcHandler>();
vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    },
  },
  app: {
    getPath: () => os.tmpdir(),
  },
  __mockInvoke: async (channel: string, payload: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler(undefined, payload);
  },
}));

// Mock preflight service to avoid calling Docker/ports
vi.mock("@main/services/preflight", () => ({
  createDockerAvailabilityCheck: () => ({ id: "docker:available", title: "", run: async () => undefined }),
  buildPreflightChecks: () => [
    { id: "stub", title: "", run: async () => ({ id: "check", title: "T", severity: "pass", message: "ok" }) },
  ],
  runPreflight: async (checks: PreflightCheckSpec[]) => {
    const items: PreflightItem[] = [];
    for (const c of checks) {
      const res = await c.run({});
      if (Array.isArray(res)) items.push(...(res as PreflightItem[]));
      else if (res) items.push(res as PreflightItem);
    }
    return {
      items,
      summary: {
        total: items.length,
        pass: items.length,
        warn: 0,
        fail: 0,
        startedAt: Date.now(),
        finishedAt: Date.now(),
        durationMs: 0,
        overall: "pass",
      },
    };
  },
}));

const invoke = async (channel: string, payload?: unknown): Promise<unknown> => {
  const electron = await import("electron");
  // @ts-expect-error mocked helper
  return electron.__mockInvoke(channel, payload);
};

describe("preflight IPC", () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    registerDeploymentsIpcHandlers();
    registerPreflightIpcHandlers();
  });

  it("run executes checks and writes preflight.json", async () => {
    const created = (await invoke(DeploymentsChannels.createFromSelection, {
      type: "sts",
      providers: { sts: "openai-realtime" },
      name: "PF",
    })) as { id: string };
    await invoke(PreflightChannels.run, { deploymentId: created.id });
    // Find deployment slug via list
    const list = (await invoke(DeploymentsChannels.list)) as { deployments: { id: string; slug: string }[] };
    const item = list.deployments.find((d) => d.id === created.id);
    if (!item) throw new Error("Not found");
    const root = path.join(os.tmpdir(), "avr-workspace");
    const file = path.join(root, "deployments", item.slug, "preflight.json");
    expect(fs.existsSync(file)).toBe(true);
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(json.summary.total).toBeGreaterThan(0);
    // cleanup created deployment directory
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });

  it("last returns null when no results exist, then returns persisted results", async () => {
    const created = (await invoke(DeploymentsChannels.createFromSelection, {
      type: "sts",
      providers: { sts: "openai-realtime" },
      name: "PF2",
    })) as { id: string };
    const none = (await invoke(PreflightChannels.last, { deploymentId: created.id })) as { result: unknown };
    expect(none.result).toBeNull();
    await invoke(PreflightChannels.run, { deploymentId: created.id });
    const some = (await invoke(PreflightChannels.last, { deploymentId: created.id })) as {
      result: { summary: { total: number } } | null;
    };
    expect(some.result?.summary.total).toBeGreaterThan(0);
    // cleanup created deployment directory
    const list2 = (await invoke(DeploymentsChannels.list)) as { deployments: { id: string; slug: string }[] };
    const item2 = list2.deployments.find((d) => d.id === created.id);
    if (item2) {
      const root = path.join(os.tmpdir(), "avr-workspace");
      fs.rmSync(path.join(root, "deployments", item2.slug), { recursive: true, force: true });
    }
  });

  it("fix updates deployment asterisk fields for docker ports conflicts", async () => {
    const created = (await invoke(DeploymentsChannels.createFromSelection, {
      type: "sts",
      providers: { sts: "openai-realtime" },
      name: "PF3",
    })) as { id: string };

    // ensure fix handler is registered
    if (!handlers.get(PreflightChannels.fix)) throw new Error("No fix handler");

    // Write a fake preflight.json with a docker ports conflict
    const list = (await invoke(DeploymentsChannels.list)) as { deployments: { id: string; slug: string }[] };
    const item = list.deployments.find((d) => d.id === created.id);
    if (!item) throw new Error("Not found");
    const root = path.join(os.tmpdir(), "avr-workspace");
    const dir = path.join(root, "deployments", item.slug);
    fs.mkdirSync(dir, { recursive: true });
    const result = {
      items: [
        {
          id: "docker:ports:conflicts",
          title: "Docker port mapping conflicts detected",
          severity: "fail",
          message: "conflict",
          data: {
            sipPort: 5060,
            rtpRange: { start: 10000, end: 10010 },
            conflicts: [{ container: "x", hostPort: 5060, protocol: "tcp" }],
          },
        },
      ],
      summary: { total: 1, pass: 0, warn: 0, fail: 1, startedAt: 0, finishedAt: 0, durationMs: 0, overall: "fail" },
    };
    fs.writeFileSync(path.join(dir, "preflight.json"), JSON.stringify(result, null, 2), "utf8");

    const res = (await invoke(PreflightChannels.fix, {
      deploymentId: created.id,
      itemId: "docker:ports:conflicts",
    })) as { fixed: boolean; applied?: { asterisk?: { sipPort?: number; rtpStart?: number; rtpEnd?: number } } };
    expect(res.fixed).toBe(true);
    expect(res.applied?.asterisk?.sipPort).toBeDefined();
    expect(res.applied?.asterisk?.rtpStart).toBeDefined();
    expect(res.applied?.asterisk?.rtpEnd).toBeDefined();

    // cleanup
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
