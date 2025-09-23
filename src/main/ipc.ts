import { registerAsteriskIpcHandlers } from "@main/ipc/asterisk";
import { registerComposeIpcHandlers } from "@main/ipc/compose";
import { registerDeploymentsIpcHandlers } from "@main/ipc/deployments";
import { registerEnvIpcHandlers } from "@main/ipc/env";
import { registerPreflightIpcHandlers } from "@main/ipc/preflight";
import { registerProvidersIpcHandlers } from "@main/ipc/providers";

export const registerIpcHandlers = (): void => {
  registerProvidersIpcHandlers();
  registerDeploymentsIpcHandlers();
  registerAsteriskIpcHandlers();
  registerPreflightIpcHandlers();
  registerComposeIpcHandlers();
  registerEnvIpcHandlers();
};
