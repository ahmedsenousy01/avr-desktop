import { ipcMain } from "electron";

import type {
  AsteriskRenderConfigRequest,
  AsteriskRenderConfigResponse,
  AsteriskValidateConfigRequest,
  AsteriskValidateConfigResponse,
} from "@shared/ipc";
import { AsteriskChannels } from "@shared/ipc";
import { renderAsteriskConfig, validateAsteriskConfig } from "@main/services/asterisk-config";

export function registerAsteriskIpcHandlers(): void {
  ipcMain.handle(
    AsteriskChannels.validateConfig,
    async (_event, req: AsteriskValidateConfigRequest): Promise<AsteriskValidateConfigResponse> => {
      return validateAsteriskConfig(req.config);
    }
  );

  ipcMain.handle(
    AsteriskChannels.renderConfig,
    async (_event, req: AsteriskRenderConfigRequest): Promise<AsteriskRenderConfigResponse> => {
      const { files, written } = await renderAsteriskConfig(
        req.config,
        req.sourceDir,
        req.targetDir,
        req.preview ?? true
      );
      if (req.preview === false) return { written };
      return { files };
    }
  );
}
