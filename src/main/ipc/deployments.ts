import { ipcMain } from "electron";
import { z } from "zod/v4";

import type { TemplateId } from "@main/services/template-registry";
import type { DeploymentsCreateFromSelectionResponse, DeploymentsCreateFromTemplateResponse } from "@shared/ipc";
import { DeploymentsChannels } from "@shared/ipc";
import {
  createDeployment,
  deleteDeployment,
  duplicateDeployment,
  listDeployments,
  updateDeployment,
} from "@main/services/deployments-store";
import { TEMPLATE_IDS, templateToDeployment } from "@main/services/template-registry";

const CreateFromTemplateSchema = z.object({
  templateId: z.enum([...TEMPLATE_IDS] as [TemplateId, ...TemplateId[]]),
  name: z.string().optional(),
});

const ModularProvidersSchema = z.object({
  llm: z.enum(["openai", "anthropic", "gemini"] as const),
  asr: z.enum(["deepgram", "google", "vosk"] as const),
  tts: z.enum(["elevenlabs", "google"] as const),
});

const StsProvidersSchema = z.object({
  sts: z.enum(["openai-realtime", "ultravox"] as const),
});

const CreateFromSelectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("modular"), name: z.string().optional(), providers: ModularProvidersSchema }),
  z.object({ type: z.literal("sts"), name: z.string().optional(), providers: StsProvidersSchema }),
]);

const ListSchema = z.undefined();
const UpdateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  providers: z.record(z.string(), z.string()).optional(),
  asterisk: z.any().optional(),
});
const DuplicateSchema = z.object({ id: z.string(), name: z.string().optional() });
const DeleteSchema = z.object({ id: z.string() });

export function registerDeploymentsIpcHandlers(): void {
  ipcMain.handle(
    DeploymentsChannels.createFromTemplate,
    async (_event, req: unknown): Promise<DeploymentsCreateFromTemplateResponse> => {
      const parsed = CreateFromTemplateSchema.parse(req);
      const skeleton = templateToDeployment(parsed.templateId, parsed.name);
      if (skeleton.type === "sts") {
        const dep = createDeployment({ type: "sts", name: skeleton.name, providers: { sts: skeleton.providers.sts } });
        return { id: dep.id, name: dep.name };
      }
      // Ensure required fields for modular are present (guaranteed by our registry mapping)
      const llm = skeleton.providers.llm ?? "openai";
      const asr = skeleton.providers.asr ?? "deepgram";
      const tts = skeleton.providers.tts ?? "elevenlabs";
      const dep = createDeployment({
        type: "modular",
        name: skeleton.name,
        providers: { llm, asr, tts },
      });
      return { id: dep.id, name: dep.name };
    }
  );

  ipcMain.handle(
    DeploymentsChannels.createFromSelection,
    async (_event, req: unknown): Promise<DeploymentsCreateFromSelectionResponse> => {
      const parsed = CreateFromSelectionSchema.parse(req);
      if (parsed.type === "sts") {
        const dep = createDeployment({ type: "sts", providers: { sts: parsed.providers.sts }, name: parsed.name });
        return { id: dep.id, name: dep.name };
      }
      const dep = createDeployment({
        type: "modular",
        providers: {
          llm: parsed.providers.llm,
          asr: parsed.providers.asr,
          tts: parsed.providers.tts,
        },
        name: parsed.name,
      });
      return { id: dep.id, name: dep.name };
    }
  );

  ipcMain.handle(
    DeploymentsChannels.list,
    async (): Promise<{
      deployments: { id: string; slug: string; name: string; type: "modular" | "sts"; updatedAt: string }[];
    }> => {
      ListSchema.parse(undefined);
      const all = listDeployments();
      return {
        deployments: all.map((d) => ({ id: d.id, slug: d.slug, name: d.name, type: d.type, updatedAt: d.updatedAt })),
      };
    }
  );

  ipcMain.handle(DeploymentsChannels.update, async (_event, req: unknown): Promise<{ id: string; name: string }> => {
    const parsed = UpdateSchema.parse(req);
    const next = await updateDeployment(parsed.id, {
      name: parsed.name,
      providers: parsed.providers,
      asterisk: parsed.asterisk,
    });
    return { id: next.id, name: next.name };
  });

  ipcMain.handle(DeploymentsChannels.duplicate, async (_event, req: unknown): Promise<{ id: string; name: string }> => {
    const parsed = DuplicateSchema.parse(req);
    const dep = duplicateDeployment(parsed.id, parsed.name);
    return { id: dep.id, name: dep.name };
  });

  ipcMain.handle(DeploymentsChannels.delete, async (_event, req: unknown): Promise<{ ok: boolean }> => {
    const parsed = DeleteSchema.parse(req);
    const ok = deleteDeployment(parsed.id);
    return { ok };
  });
}
