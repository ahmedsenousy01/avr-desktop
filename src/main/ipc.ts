import { registerAsteriskIpcHandlers } from "@main/ipc/asterisk";
import { registerDeploymentsIpcHandlers } from "@main/ipc/deployments";
import { registerProvidersIpcHandlers } from "@main/ipc/providers";

export const registerIpcHandlers = (): void => {
  registerProvidersIpcHandlers();
  registerDeploymentsIpcHandlers();
  registerAsteriskIpcHandlers();
};
