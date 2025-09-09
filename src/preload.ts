// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";
import type { CounterApi } from "@shared/ipc";

const api: CounterApi = {
  readCounter: () => ipcRenderer.invoke("counter:read"),
  incrementCounter: () => ipcRenderer.invoke("counter:increment"),
};

contextBridge.exposeInMainWorld("api", api);
