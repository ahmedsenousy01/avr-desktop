// Preload currently does not expose any APIs.
import { contextBridge, ipcRenderer } from "electron";

import type { ProvidersApi } from "@shared/ipc";
import { ProvidersChannels } from "@shared/ipc";

const providers: ProvidersApi = {
  list: () => ipcRenderer.invoke(ProvidersChannels.list),
  get: (req) => ipcRenderer.invoke(ProvidersChannels.get, req),
  save: (req) => ipcRenderer.invoke(ProvidersChannels.save, req),
  test: (req) => ipcRenderer.invoke(ProvidersChannels.test, req),
};

contextBridge.exposeInMainWorld("providers", providers);
