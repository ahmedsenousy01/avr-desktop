import os from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as DeploymentsStoreModule from "@main/services/deployments-store";
import { DeploymentsChannels } from "@shared/ipc";
import { registerDeploymentsIpcHandlers } from "@main/ipc/deployments";
import * as store from "@main/services/deployments-store";

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

// Mock the deployments store
vi.mock("@main/services/deployments-store", async () => {
  const actual = await vi.importActual<typeof DeploymentsStoreModule>("@main/services/deployments-store");
  return {
    ...actual,
    createDeployment: vi.fn(actual.createDeployment),
  };
});

const invoke = async (channel: string, payload?: unknown) => {
  const electron = await import("electron");
  // @ts-expect-error mocked helper
  return electron.__mockInvoke(channel, payload);
};

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  registerDeploymentsIpcHandlers();
});

describe("deployments IPC", () => {
  it("createFromTemplate creates a deployment from template skeleton (modular)", async () => {
    const res = await invoke(DeploymentsChannels.createFromTemplate, { templateId: "google", name: "G" });
    expect(res.id).toBeTruthy();
    expect(res.name).toBeTruthy();
    expect(store.createDeployment).toHaveBeenCalled();
  });

  it("createFromSelection accepts modular selection and returns id/name", async () => {
    const res = await invoke(DeploymentsChannels.createFromSelection, {
      type: "modular",
      providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" },
    });
    expect(res.id).toBeTruthy();
    expect(res.name).toBeTruthy();
  });

  it("createFromSelection rejects invalid payload", async () => {
    await expect(
      invoke(DeploymentsChannels.createFromSelection, { type: "modular", providers: { llm: "invalid" } })
    ).rejects.toThrow();
  });

  it("list returns deployments", async () => {
    const res = await invoke(DeploymentsChannels.list);
    expect(Array.isArray(res.deployments)).toBe(true);
  });

  it("duplicate and delete work end-to-end", async () => {
    const created = await invoke(DeploymentsChannels.createFromSelection, {
      type: "modular",
      providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" },
      name: "Orig",
    });
    const dup = await invoke(DeploymentsChannels.duplicate, { id: created.id, name: "Copy" });
    expect(dup.id).toBeTruthy();
    const del = await invoke(DeploymentsChannels.delete, { id: dup.id });
    expect(del.ok).toBe(true);
  });
});
