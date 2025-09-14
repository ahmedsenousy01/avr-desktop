import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Providers } from "@shared/types/providers";
import { ProvidersChannels } from "@shared/ipc";
import * as store from "@main/services/providers-store";

import { registerProvidersIpcHandlers } from "../providers";

// Mock electron's ipcMain and provide a helper to invoke handlers
const handlers = new Map<string, Function>();
vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: Function) => {
      handlers.set(channel, handler);
    },
  },
  __mockInvoke: async (channel: string, payload: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler(undefined, payload);
  },
}));

// Mock the providers store
vi.mock("@main/services/providers-store", async () => {
  const actual = await vi.importActual<any>("@main/services/providers-store");
  return {
    ...actual,
    readProviders: vi.fn(),
    saveProviders: vi.fn(),
  };
});

const invoke = async (channel: string, payload?: unknown) => {
  const electron = await import("electron");
  // @ts-expect-error mocked helper
  return electron.__mockInvoke(channel, payload);
};

const defaults: Providers = {
  openai: { apiKey: "" },
  anthropic: { apiKey: "" },
  gemini: { apiKey: "" },
  deepgram: { apiKey: "" },
  elevenlabs: { apiKey: "" },
};

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  registerProvidersIpcHandlers();
});

describe("providers IPC", () => {
  it("providers:list returns providers", async () => {
    (store.readProviders as any).mockReturnValue({ ...defaults, openai: { apiKey: "abc" } });
    const res = await invoke(ProvidersChannels.list);
    expect(res.providers.openai.apiKey).toBe("abc");
  });

  it("providers:get returns apiKey for valid id", async () => {
    (store.readProviders as any).mockReturnValue({ ...defaults, gemini: { apiKey: "key" } });
    const res = await invoke(ProvidersChannels.get, { id: "gemini" });
    expect(res).toEqual({ id: "gemini", apiKey: "key" });
  });

  it("providers:get rejects invalid id", async () => {
    (store.readProviders as any).mockReturnValue(defaults);
    await expect(invoke(ProvidersChannels.get, { id: "invalid" })).rejects.toThrow(/Invalid provider id/);
  });

  it("providers:save validates and returns merged providers", async () => {
    (store.saveProviders as any).mockReturnValue({ ...defaults, openai: { apiKey: "saved" } });
    const res = await invoke(ProvidersChannels.save, { partial: { openai: { apiKey: "saved" } } });
    expect(store.saveProviders).toHaveBeenCalledWith({ openai: { apiKey: "saved" } });
    expect(res.providers.openai.apiKey).toBe("saved");
  });

  it("providers:test returns presence result", async () => {
    (store.readProviders as any).mockReturnValue({ ...defaults, deepgram: { apiKey: "" } });
    const res1 = await invoke(ProvidersChannels.test, { id: "deepgram" });
    expect(res1).toEqual({ ok: false, message: "Missing or empty apiKey" });

    (store.readProviders as any).mockReturnValue({ ...defaults, deepgram: { apiKey: "z" } });
    const res2 = await invoke(ProvidersChannels.test, { id: "deepgram" });
    expect(res2).toEqual({ ok: true, message: "Key present" });
  });
});
