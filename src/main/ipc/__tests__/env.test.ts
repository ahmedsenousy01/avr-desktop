import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EnvIpcChannels, GetDeploymentEnvRequestSchema } from "@shared/types/env";
import { registerEnvIpcHandlers } from "@main/ipc/env";
import { createDeployment } from "@main/services/deployments-store";
import { setWorkspaceRootForTesting } from "@main/services/workspace-root";

// Mock electron's ipcMain and provide a helper to invoke handlers
// Reuse the pattern from providers IPC tests

type IpcHandler = (event: unknown, payload: unknown) => unknown | Promise<unknown>;
const handlers = new Map<string, IpcHandler>();
vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    },
  },
  __mockInvoke: async (channel: string, payload: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler(undefined, payload);
  },
  app: {
    getPath: () => ".tmp-ipc-test",
  },
}));

const invoke = async (channel: string, payload?: unknown) => {
  const electron = await import("electron");
  // @ts-expect-error mocked helper
  return electron.__mockInvoke(channel, payload);
};

const tmpRoot = path.join(process.cwd(), `.tmp-ipc-${Date.now()}`);

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  setWorkspaceRootForTesting(tmpRoot);
  registerEnvIpcHandlers();
});

afterEach(() => {
  setWorkspaceRootForTesting(null);
  if (fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("env IPC", () => {
  it("deploymentEnv:get seeds and returns env", async () => {
    const dep = createDeployment({ type: "sts", providers: { sts: "openai-realtime" } });
    const payload = GetDeploymentEnvRequestSchema.parse({ deploymentId: dep.id });
    const res = await invoke(EnvIpcChannels.getDeploymentEnv, payload);
    expect(res.env.deploymentId).toBe(dep.id);
  });

  it("deploymentEnv:upsertVar and removeVar mutate env", async () => {
    const dep = createDeployment({ type: "sts", providers: { sts: "openai-realtime" } });
    await invoke(EnvIpcChannels.upsertDeploymentEnvVar, {
      deploymentId: dep.id,
      serviceName: "svc",
      variableName: "FOO",
      value: "bar",
    });
    const afterUpsert = await invoke(EnvIpcChannels.getDeploymentEnv, { deploymentId: dep.id });
    expect(afterUpsert.env.services.svc.FOO).toBe("bar");

    await invoke(EnvIpcChannels.removeDeploymentEnvVar, {
      deploymentId: dep.id,
      serviceName: "svc",
      variableName: "FOO",
    });
    const afterRemove = await invoke(EnvIpcChannels.getDeploymentEnv, { deploymentId: dep.id });
    expect(afterRemove.env.services.svc).toBeUndefined();
  });

  it("deploymentEnv:validate reports presence-only missing", async () => {
    const dep = createDeployment({ type: "sts", providers: { sts: "openai-realtime" } });
    const res = await invoke(EnvIpcChannels.validatePresence, { deploymentId: dep.id });
    expect(typeof res.missingByService).toBe("object");
  });
});
