// Preload currently does not expose any APIs.
import { contextBridge, ipcRenderer } from "electron";

import type { AsteriskApi, DeploymentsApi, ProvidersApi } from "@shared/ipc";
import { AsteriskChannels, DeploymentsChannels, ProvidersChannels } from "@shared/ipc";

const providers: ProvidersApi = {
  list: () => ipcRenderer.invoke(ProvidersChannels.list),
  get: (req) => ipcRenderer.invoke(ProvidersChannels.get, req),
  save: (req) => ipcRenderer.invoke(ProvidersChannels.save, req),
  test: (req) => ipcRenderer.invoke(ProvidersChannels.test, req),
};

contextBridge.exposeInMainWorld("providers", providers);

const deployments: DeploymentsApi = {
  createFromTemplate: (req) => ipcRenderer.invoke(DeploymentsChannels.createFromTemplate, req),
  createFromSelection: (req) => ipcRenderer.invoke(DeploymentsChannels.createFromSelection, req),
  list: () => ipcRenderer.invoke(DeploymentsChannels.list),
  update: (req) => ipcRenderer.invoke(DeploymentsChannels.update, req),
  duplicate: (req) => ipcRenderer.invoke(DeploymentsChannels.duplicate, req),
  delete: (req) => ipcRenderer.invoke(DeploymentsChannels.delete, req),
};

contextBridge.exposeInMainWorld("deployments", deployments);

const asterisk: AsteriskApi = {
  validateConfig: (req) => ipcRenderer.invoke(AsteriskChannels.validateConfig, req),
  renderConfig: (req) => ipcRenderer.invoke(AsteriskChannels.renderConfig, req),
};

contextBridge.exposeInMainWorld("asterisk", asterisk);
