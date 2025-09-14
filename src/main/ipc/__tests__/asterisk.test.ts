import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AsteriskChannels } from "@shared/ipc";
import { DEFAULT_ASTERISK_CONFIG } from "@shared/types/asterisk";
import { registerAsteriskIpcHandlers } from "@main/ipc/asterisk";

// Mock electron's ipcMain and provide a helper to invoke handlers
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
}));

const invoke = async (channel: string, payload?: unknown) => {
  const electron = await import("electron");
  // @ts-expect-error mocked helper
  return electron.__mockInvoke(channel, payload);
};

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  registerAsteriskIpcHandlers();
});

describe("asterisk IPC", () => {
  it("validateConfig returns valid for default config", async () => {
    const res = await invoke(AsteriskChannels.validateConfig, { config: DEFAULT_ASTERISK_CONFIG });
    expect(res).toEqual({ valid: true, errors: [] });
  });

  it("renderConfig returns files in preview mode", async () => {
    const res = await invoke(AsteriskChannels.renderConfig, { config: DEFAULT_ASTERISK_CONFIG, preview: true });
    expect(res.files).toBeTruthy();
    expect(Object.keys(res.files)).toEqual(
      expect.arrayContaining(["ari.conf", "pjsip.conf", "extensions.conf", "manager.conf", "queues.conf"])
    );
    for (const content of Object.values(res.files)) {
      expect(typeof content).toBe("string");
    }
  });

  it("renderConfig writes files when preview is false", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "avr-ast-"));
    const res = await invoke(AsteriskChannels.renderConfig, {
      config: DEFAULT_ASTERISK_CONFIG,
      targetDir: tmp,
      preview: false,
    });
    expect(Array.isArray(res.written)).toBe(true);
    expect(res.written.length).toBeGreaterThanOrEqual(4);
    for (const p of res.written) {
      const st = await fs.stat(p);
      expect(st.isFile()).toBe(true);
    }
    await fs.rm(tmp, { recursive: true, force: true });
  });
});
