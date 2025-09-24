import { ipcMain } from "electron";
import { z } from "zod/v4";

import type {
  DeploymentsCreateFromSelectionResponse,
  DeploymentsCreateFromTemplateResponse,
  DeploymentsGetResponse,
} from "@shared/ipc";
import type { TemplateId } from "@shared/registry/templates";
import { DeploymentsChannels } from "@shared/ipc";
import { TEMPLATE_IDS } from "@shared/registry/templates";
import { DeploymentSchema } from "@shared/types/deployments";
import {
  createDeployment,
  deleteDeployment,
  duplicateDeployment,
  findDeploymentDirById,
  listDeployments,
  updateDeployment,
} from "@main/services/deployments-store";
import { templateToDeployment } from "@main/services/template-registry";

const CreateFromTemplateSchema = z.object({
  templateId: z.enum([...TEMPLATE_IDS] as [TemplateId, ...TemplateId[]]),
  name: z.string().optional(),
});

const ModularProvidersSchema = z.object({
  llm: z.enum(["openai", "anthropic", "gemini"] as const),
  asr: z.enum(["deepgram", "google", "vosk"] as const),
  tts: z.enum(["google"] as const),
});

const StsProvidersSchema = z.object({
  sts: z.enum(["openai-realtime", "ultravox", "gemini"] as const),
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
  environmentOverrides: z.record(z.string(), z.string()).optional(),
});
const DuplicateSchema = z.object({ id: z.string(), name: z.string().optional() });
const DeleteSchema = z.object({ id: z.string() });

export function registerDeploymentsIpcHandlers(): void {
  ipcMain.handle(DeploymentsChannels.get, async (_event, req: { id: string }): Promise<DeploymentsGetResponse> => {
    const parsed = z.object({ id: z.string() }).parse(req);
    const dir = findDeploymentDirById(parsed.id);
    if (!dir) throw new Error("Deployment not found");
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dep = DeploymentSchema.parse(JSON.parse(readFileSync(join(dir, "deployment.json"), "utf8")));
    return {
      id: dep.id,
      name: dep.name,
      slug: dep.slug,
      type: dep.type,
      asterisk: dep.asterisk,
      environmentOverrides: dep.environmentOverrides,
      updatedAt: dep.updatedAt,
    };
  });

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
      const tts = skeleton.providers.tts ?? "google";
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
      environmentOverrides: parsed.environmentOverrides,
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
