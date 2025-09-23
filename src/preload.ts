// Preload currently does not expose any APIs.
import { contextBridge, ipcRenderer } from "electron";

import type { AsteriskApi, ComposeApi, ComposePlanApi, DeploymentsApi, PreflightApi, ProvidersApi } from "@shared/ipc";
import type { EnvApi } from "@shared/types/env";
import {
  AsteriskChannels,
  ComposeChannels,
  ComposeEventChannels,
  ComposePlanChannels,
  DeploymentsChannels,
  PreflightChannels,
  ProvidersChannels,
} from "@shared/ipc";
import { EnvIpcChannels } from "@shared/types/env";

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
  get: (req) => ipcRenderer.invoke(DeploymentsChannels.get, req),
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
  fix: (req) => ipcRenderer.invoke(PreflightChannels.fix, req),
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
const composePlan: ComposePlanApi = {
  plan: (req) => ipcRenderer.invoke(ComposePlanChannels.plan, req),
};
contextBridge.exposeInMainWorld("composePlan", composePlan);
contextBridge.exposeInMainWorld("composeEvents", {
  onStatusUpdate: (cb: (payload: unknown) => void) => {
    const handler = (_e: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(ComposeEventChannels.statusUpdate, handler as never);
    return () => ipcRenderer.removeListener(ComposeEventChannels.statusUpdate, handler as never);
  },
  onLogsData: (cb: (payload: unknown) => void) => {
    const handler = (_e: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(ComposeEventChannels.logsData, handler as never);
    return () => ipcRenderer.removeListener(ComposeEventChannels.logsData, handler as never);
  },
  onLogsClosed: (cb: (payload: unknown) => void) => {
    const handler = (_e: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(ComposeEventChannels.logsClosed, handler as never);
    return () => ipcRenderer.removeListener(ComposeEventChannels.logsClosed, handler as never);
  },
  onLogsError: (cb: (payload: unknown) => void) => {
    const handler = (_e: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(ComposeEventChannels.logsError, handler as never);
    return () => ipcRenderer.removeListener(ComposeEventChannels.logsError, handler as never);
  },
});

const env: EnvApi = {
  getRegistry: () => ipcRenderer.invoke(EnvIpcChannels.getRegistry),
  getDeploymentEnv: (req) => ipcRenderer.invoke(EnvIpcChannels.getDeploymentEnv, req),
  upsertVar: (req) => ipcRenderer.invoke(EnvIpcChannels.upsertDeploymentEnvVar, req),
  removeVar: (req) => ipcRenderer.invoke(EnvIpcChannels.removeDeploymentEnvVar, req),
  validatePresence: (req) => ipcRenderer.invoke(EnvIpcChannels.validatePresence, req),
};

contextBridge.exposeInMainWorld("env", env);
