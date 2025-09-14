import type { ProvidersApi } from "@shared/ipc";

declare global {
  interface Window {
    providers?: ProvidersApi;
  }
}

export const providers: ProvidersApi | undefined = window.providers;
