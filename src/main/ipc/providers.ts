import { ipcMain } from "electron";

import type {
  ProvidersGetResponse,
  ProvidersListResponse,
  ProvidersSaveResponse,
  ProvidersTestResponse,
} from "@shared/ipc";
import type { ProviderId, ProvidersPartial } from "@shared/types/providers";
import { ProvidersChannels } from "@shared/ipc";
import { PROVIDER_IDS } from "@shared/types/providers";
import { readProviders, saveProviders } from "@main/services/providers-store";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertValidProviderId(id: unknown): asserts id is (typeof PROVIDER_IDS)[number] {
  if (typeof id !== "string" || !PROVIDER_IDS.includes(id as ProviderId)) {
    throw new Error("Invalid provider id");
  }
}

export function registerProvidersIpcHandlers(): void {
  // providers:list → { providers }
  ipcMain.handle(ProvidersChannels.list, async (): Promise<ProvidersListResponse> => {
    const providers = readProviders();
    return { providers };
  });

  // providers:get { id } → { id, apiKey }
  ipcMain.handle(ProvidersChannels.get, async (_event, req: unknown): Promise<ProvidersGetResponse> => {
    if (!isPlainObject(req) || typeof req.id !== "string") {
      throw new Error("Invalid request payload");
    }
    assertValidProviderId(req.id);
    const providers = readProviders();
    return { id: req.id, apiKey: providers[req.id].apiKey };
  });

  // providers:save { partial } → { providers }
  ipcMain.handle(ProvidersChannels.save, async (_event, req: unknown): Promise<ProvidersSaveResponse> => {
    if (!isPlainObject(req) || !isPlainObject(req.partial)) {
      throw new Error("Invalid request payload");
    }
    const providers = saveProviders(req.partial as unknown as ProvidersPartial);
    return { providers };
  });

  // providers:test { id } → { ok, message }
  ipcMain.handle(ProvidersChannels.test, async (_event, req: unknown): Promise<ProvidersTestResponse> => {
    if (!isPlainObject(req) || typeof req.id !== "string") {
      throw new Error("Invalid request payload");
    }
    assertValidProviderId(req.id);
    const providers = readProviders();
    const key = providers[req.id].apiKey.trim();
    const ok = key.length > 0;
    const message = ok ? "Key present" : "Missing or empty apiKey";
    return { ok, message };
  });
}
