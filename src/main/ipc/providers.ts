import fs from "node:fs";
import path from "node:path";
import { dialog, ipcMain } from "electron";
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
import { validateApiKey } from "@main/services/api-validators";
import { getProvidersDirPath, readProviders, saveProviders } from "@main/services/providers-store";

const ProviderIdSchema = z.enum([...PROVIDER_IDS] as [ProviderId, ...ProviderId[]]);
const ProvidersGetSchema = z.object({ id: ProviderIdSchema });

const ProviderCredentialsSchemaApiKey = z.object({ apiKey: z.string() });
const ProviderCredentialsSchemaGoogle = z.object({ credentialsFilePath: z.string() });
const ProviderCredentialsSchemaVosk = z.object({ modelPath: z.string() });

const schemaById: Record<ProviderId, z.ZodType<unknown>> = {
  openai: ProviderCredentialsSchemaApiKey,
  anthropic: ProviderCredentialsSchemaApiKey,
  gemini: ProviderCredentialsSchemaApiKey,
  deepgram: ProviderCredentialsSchemaApiKey,
  elevenlabs: ProviderCredentialsSchemaApiKey,
  google: ProviderCredentialsSchemaGoogle,
  vosk: ProviderCredentialsSchemaVosk,
  openrouter: ProviderCredentialsSchemaApiKey,
  ultravox: ProviderCredentialsSchemaApiKey,
};

const ProvidersPartialObjectSchema = z
  .object(Object.fromEntries(PROVIDER_IDS.map((id) => [id, schemaById[id]])) as Record<ProviderId, z.ZodType<unknown>>)
  .partial();

const ProvidersSaveSchema = z.object({ partial: ProvidersPartialObjectSchema });
const ProvidersTestSchema = z.object({
  id: ProviderIdSchema,
  apiKey: z.string().optional(),
});

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
      return { id: parsed.id, apiKey: providers[parsed.id].apiKey ?? "" };
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

  // providers:test { id } → { ok, message, validationType, errorCode?, details? }
  ipcMain.handle(ProvidersChannels.test, async (_event, req: unknown): Promise<ProvidersTestResponse> => {
    try {
      const parsed = ProvidersTestSchema.parse(req);
      // Non-API-key providers: presence-only validation
      if (parsed.id === "google") {
        const credentialsPath = readProviders().google.credentialsFilePath ?? "";
        const ok = credentialsPath.trim().length > 0;
        return {
          ok,
          message: ok ? "Credentials path set" : "Missing credentials file path",
          validationType: "presence",
          errorCode: ok ? undefined : "invalid_key",
        };
      }
      if (parsed.id === "vosk") {
        const modelPath = readProviders().vosk.modelPath ?? "";
        const ok = modelPath.trim().length > 0;
        return {
          ok,
          message: ok ? "Model path set" : "Missing model path",
          validationType: "presence",
          errorCode: ok ? undefined : "invalid_key",
        };
      }

      // API-key providers
      const stored = readProviders()[parsed.id].apiKey ?? "";
      const key = parsed.apiKey !== undefined ? parsed.apiKey.trim() : stored.trim();

      // If UI provided a key to test, do NOT fall back to presence; require real API validation.
      const fallback = parsed.apiKey === undefined; // only fallback when testing stored key implicitly
      return await validateApiKey(parsed.id, key, fallback);
    } catch {
      throw new Error("Invalid provider id");
    }
  });

  // providers:uploadGoogleJson → { storedPath }
  ipcMain.handle(ProvidersChannels.uploadGoogleJson, async (): Promise<{ storedPath: string | null }> => {
    const picked = await dialog.showOpenDialog({
      title: "Select Google Service Account JSON",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (picked.canceled || picked.filePaths.length === 0) {
      return { storedPath: null };
    }
    const sourcePath = picked.filePaths[0];
    const targetDir = getProvidersDirPath();
    const destPath = path.join(targetDir, "google.json");
    try {
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(sourcePath, destPath);
      const providers = readProviders();
      providers.google = { credentialsFilePath: destPath };
      const providersFile = path.join(targetDir, "providers.json");
      fs.writeFileSync(providersFile, JSON.stringify(providers, null, 2), "utf8");
      return { storedPath: destPath };
    } catch {
      return { storedPath: null };
    }
  });

  // providers:deleteGoogleJson → { deleted }
  ipcMain.handle(ProvidersChannels.deleteGoogleJson, async (): Promise<{ deleted: boolean }> => {
    try {
      const targetDir = getProvidersDirPath();
      const destPath = path.join(targetDir, "google.json");
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath);
      }
      const providers = readProviders();
      providers.google = { credentialsFilePath: "" };
      const providersFile = path.join(targetDir, "providers.json");
      fs.writeFileSync(providersFile, JSON.stringify(providers, null, 2), "utf8");
      return { deleted: true };
    } catch {
      return { deleted: false };
    }
  });

  // providers:browseVoskModelDir → { selectedPath }
  ipcMain.handle(ProvidersChannels.browseVoskModelDir, async (): Promise<{ selectedPath: string | null }> => {
    const picked = await dialog.showOpenDialog({
      title: "Select Vosk Model Directory",
      properties: ["openDirectory"],
    });
    if (picked.canceled || picked.filePaths.length === 0) return { selectedPath: null };
    return { selectedPath: picked.filePaths[0] };
  });
}
