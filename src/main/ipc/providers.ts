import { ipcMain } from "electron";
import { z } from "zod/v4";

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

const ProviderIdSchema = z.enum([...PROVIDER_IDS] as [ProviderId, ...ProviderId[]]);
const ProvidersGetSchema = z.object({ id: ProviderIdSchema });

const ProviderCredentialsSchema = z.object({ apiKey: z.string() });
const ProvidersPartialObjectSchema = z
  .object(
    Object.fromEntries(PROVIDER_IDS.map((id) => [id, ProviderCredentialsSchema])) as Record<
      ProviderId,
      typeof ProviderCredentialsSchema
    >
  )
  .partial();

const ProvidersSaveSchema = z.object({ partial: ProvidersPartialObjectSchema });
const ProvidersTestSchema = z.object({ id: ProviderIdSchema });

export function registerProvidersIpcHandlers(): void {
  // providers:list → { providers }
  ipcMain.handle(ProvidersChannels.list, async (): Promise<ProvidersListResponse> => {
    const providers = readProviders();
    return { providers };
  });

  // providers:get { id } → { id, apiKey }
  ipcMain.handle(ProvidersChannels.get, async (_event, req: unknown): Promise<ProvidersGetResponse> => {
    try {
      const parsed = ProvidersGetSchema.parse(req);
      const providers = readProviders();
      return { id: parsed.id, apiKey: providers[parsed.id].apiKey };
    } catch {
      throw new Error("Invalid provider id");
    }
  });

  // providers:save { partial } → { providers }
  ipcMain.handle(ProvidersChannels.save, async (_event, req: unknown): Promise<ProvidersSaveResponse> => {
    const parsed = ProvidersSaveSchema.parse(req);
    const providers = saveProviders(parsed.partial as ProvidersPartial);
    return { providers };
  });

  // providers:test { id } → { ok, message }
  ipcMain.handle(ProvidersChannels.test, async (_event, req: unknown): Promise<ProvidersTestResponse> => {
    try {
      const parsed = ProvidersTestSchema.parse(req);
      const providers = readProviders();
      const key = providers[parsed.id].apiKey.trim();
      const ok = key.length > 0;
      const message = ok ? "Key present" : "Missing or empty apiKey";
      return { ok, message };
    } catch {
      throw new Error("Invalid provider id");
    }
  });
}
