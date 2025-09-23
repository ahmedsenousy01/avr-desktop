import { ipcMain } from "electron";

import {
  EnvIpcChannels,
  GetDeploymentEnvRequestSchema,
  GetDeploymentEnvResponseSchema,
  RemoveDeploymentEnvVarRequestSchema,
  RemoveDeploymentEnvVarResponseSchema,
  UpsertDeploymentEnvVarRequestSchema,
  UpsertDeploymentEnvVarResponseSchema,
  ValidatePresenceResponseSchema,
} from "@shared/types/env";
import {
  ensureDeploymentEnvSeeded,
  readDeploymentEnv,
  removeServiceVariable,
  upsertServiceVariable,
  validatePresenceOnly,
} from "@main/services/deployment-env-store";
import { ENV_REGISTRY } from "@main/services/env-registry";

export function registerEnvIpcHandlers(): void {
  ipcMain.handle(EnvIpcChannels.getRegistry, async () => {
    return ENV_REGISTRY;
  });

  ipcMain.handle(EnvIpcChannels.getDeploymentEnv, async (_e, payload) => {
    const req = GetDeploymentEnvRequestSchema.parse(payload);
    const env = readDeploymentEnv(req.deploymentId) ?? ensureDeploymentEnvSeeded(req.deploymentId);
    return GetDeploymentEnvResponseSchema.parse({ env });
  });

  ipcMain.handle(EnvIpcChannels.upsertDeploymentEnvVar, async (_e, payload) => {
    const req = UpsertDeploymentEnvVarRequestSchema.parse(payload);
    const env = upsertServiceVariable(req.deploymentId, req.serviceName, req.variableName, req.value);
    return UpsertDeploymentEnvVarResponseSchema.parse({ env });
  });

  ipcMain.handle(EnvIpcChannels.removeDeploymentEnvVar, async (_e, payload) => {
    const req = RemoveDeploymentEnvVarRequestSchema.parse(payload);
    const env = removeServiceVariable(req.deploymentId, req.serviceName, req.variableName);
    return RemoveDeploymentEnvVarResponseSchema.parse({ env });
  });

  ipcMain.handle(EnvIpcChannels.validatePresence, async (_e, payload) => {
    const req = GetDeploymentEnvRequestSchema.parse(payload);
    const result = validatePresenceOnly(req.deploymentId);
    return ValidatePresenceResponseSchema.parse(result);
  });
}
