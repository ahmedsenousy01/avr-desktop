// Preload currently does not expose any APIs.
import { contextBridge, ipcRenderer } from "electron";

import type { AsteriskApi, ComposeApi, DeploymentsApi, PreflightApi, ProvidersApi } from "@shared/ipc";
import {
  AsteriskChannels,
  ComposeChannels,
  ComposeEventChannels,
  DeploymentsChannels,
  PreflightChannels,
  ProvidersChannels,
} from "@shared/ipc";

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

const preflight: PreflightApi = {
  run: (req) => ipcRenderer.invoke(PreflightChannels.run, req),
  last: (req) => ipcRenderer.invoke(PreflightChannels.last, req),
};

contextBridge.exposeInMainWorld("preflight", preflight);

const compose: ComposeApi = {
  generate: (req) => ipcRenderer.invoke(ComposeChannels.generate, req),
  up: (req) => ipcRenderer.invoke(ComposeChannels.up, req),
  down: (req) => ipcRenderer.invoke(ComposeChannels.down, req),
  status: (req) => ipcRenderer.invoke(ComposeChannels.status, req),
  logsStart: (req) => ipcRenderer.invoke(ComposeChannels.logsStart, req),
  logsStop: (req) => ipcRenderer.invoke(ComposeChannels.logsStop, req),
  logsExport: (req) => ipcRenderer.invoke(ComposeChannels.logsExport, req),
  statusStart: (req) => ipcRenderer.invoke(ComposeChannels.statusStart, req),
  statusStop: (req) => ipcRenderer.invoke(ComposeChannels.statusStop, req),
};

contextBridge.exposeInMainWorld("compose", compose);
contextBridge.exposeInMainWorld("composeEvents", {
  onStatusUpdate: (cb: (payload: unknown) => void) =>
    ipcRenderer.on(ComposeEventChannels.statusUpdate, (_e, payload) => cb(payload)),
  onLogsData: (cb: (payload: unknown) => void) =>
    ipcRenderer.on(ComposeEventChannels.logsData, (_e, payload) => cb(payload)),
  onLogsClosed: (cb: (payload: unknown) => void) =>
    ipcRenderer.on(ComposeEventChannels.logsClosed, (_e, payload) => cb(payload)),
  onLogsError: (cb: (payload: unknown) => void) =>
    ipcRenderer.on(ComposeEventChannels.logsError, (_e, payload) => cb(payload)),
});
