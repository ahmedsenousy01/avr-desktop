import type { CounterApi } from "@shared/ipc";

export const api: CounterApi = (globalThis as unknown as { api: CounterApi })
  .api;
