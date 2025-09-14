import { ipcMain } from "electron";
import { z } from "zod/v4";

import type { PreflightLastResponse, PreflightRunResponse } from "@shared/ipc";
import { PreflightChannels } from "@shared/ipc";
import { DeploymentSchema } from "@shared/types/deployments";
import {
  findDeploymentDirById,
  readPreflightResultByDeploymentId,
  writePreflightResultByDeploymentId,
} from "@main/services/deployments-store";
import { buildPreflightChecks, createDockerAvailabilityCheck, runPreflight } from "@main/services/preflight";

const RunSchema = z.object({ deploymentId: z.string() });

export function registerPreflightIpcHandlers(): void {
  ipcMain.handle(PreflightChannels.run, async (_event, req: unknown): Promise<PreflightRunResponse> => {
    const parsed = RunSchema.parse(req);
    const dir = findDeploymentDirById(parsed.deploymentId);
    if (!dir) throw new Error("Deployment not found");

    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const deploymentFile = join(dir, "deployment.json");
    const dep = DeploymentSchema.parse(JSON.parse(readFileSync(deploymentFile, "utf8")));

    const checks = [createDockerAvailabilityCheck(), ...buildPreflightChecks(dep)];
    const result = await runPreflight(checks);

    writePreflightResultByDeploymentId(parsed.deploymentId, result);
    return { result };
  });

  ipcMain.handle(PreflightChannels.last, async (_event, req: unknown): Promise<PreflightLastResponse> => {
    const parsed = RunSchema.parse(req);
    const dir = findDeploymentDirById(parsed.deploymentId);
    if (!dir) throw new Error("Deployment not found");
    const result = readPreflightResultByDeploymentId(parsed.deploymentId);
    return { result };
  });
}
