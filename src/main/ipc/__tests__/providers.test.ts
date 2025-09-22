import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as ApiValidatorsModule from "@main/services/api-validators";
import type * as ProvidersStoreModule from "@main/services/providers-store";
import type { Providers } from "@shared/types/providers";
import { ProvidersChannels } from "@shared/ipc";
import * as store from "@main/services/providers-store";

import { registerProvidersIpcHandlers } from "../providers";

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

// Mock the providers store
vi.mock("@main/services/providers-store", async () => {
  const actual = await vi.importActual<typeof ProvidersStoreModule>("@main/services/providers-store");
  return {
    ...actual,
    readProviders: vi.fn(actual.readProviders),
    saveProviders: vi.fn(actual.saveProviders),
  };
});

// Mock API validation to avoid real network calls; return presence-only results
vi.mock("@main/services/api-validators", async () => {
  const actual = await vi.importActual<typeof ApiValidatorsModule>("@main/services/api-validators");
  return {
    ...actual,
    validateApiKey: vi.fn(async (_id, key: string) => {
      const trimmed = key.trim();
      if (trimmed.length === 0) {
        return {
          ok: false,
          message: "Missing or empty apiKey",
          validationType: "presence",
          errorCode: "invalid_key",
          details: undefined,
        } as const;
      }
      return {
        ok: true,
        message: "Key present",
        validationType: "presence",
        errorCode: undefined,
        details: undefined,
      } as const;
    }),
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
    vi.mocked(store).readProviders.mockReturnValue({ ...defaults, openai: { apiKey: "abc" } });
    const res = await invoke(ProvidersChannels.list);
    expect(res.providers.openai.apiKey).toBe("abc");
  });

  it("providers:get returns apiKey for valid id", async () => {
    vi.mocked(store).readProviders.mockReturnValue({ ...defaults, gemini: { apiKey: "key" } });
    const res = await invoke(ProvidersChannels.get, { id: "gemini" });
    expect(res).toEqual({ id: "gemini", apiKey: "key" });
  });

  it("providers:get rejects invalid id", async () => {
    vi.mocked(store).readProviders.mockReturnValue(defaults);
    await expect(invoke(ProvidersChannels.get, { id: "invalid" })).rejects.toThrow(/Invalid provider id/);
  });

  it("providers:save validates and returns merged providers", async () => {
    vi.mocked(store).saveProviders.mockReturnValue({ ...defaults, openai: { apiKey: "saved" } });
    const res = await invoke(ProvidersChannels.save, { partial: { openai: { apiKey: "saved" } } });
    expect(store.saveProviders).toHaveBeenCalledWith({ openai: { apiKey: "saved" } });
    expect(res.providers.openai.apiKey).toBe("saved");
  });

  it("providers:test returns presence result", async () => {
    vi.mocked(store).readProviders.mockReturnValue({ ...defaults, deepgram: { apiKey: "" } });
    const res1 = await invoke(ProvidersChannels.test, { id: "deepgram" });
    expect(res1).toEqual({
      ok: false,
      message: "Missing or empty apiKey",
      validationType: "presence",
      errorCode: "invalid_key",
      details: undefined,
    });

    vi.mocked(store).readProviders.mockReturnValue({ ...defaults, deepgram: { apiKey: "z" } });
    const res2 = await invoke(ProvidersChannels.test, { id: "deepgram" });
    expect(res2).toEqual({
      ok: true,
      message: "Key present",
      validationType: "presence",
      errorCode: undefined,
      details: undefined,
    });
  });
});
