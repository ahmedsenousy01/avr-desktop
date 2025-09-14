import type { ProviderId, Providers, ProvidersPartial } from "./types/providers";

// Providers IPC channels
export const ProvidersChannels = {
  list: "providers:list",
  get: "providers:get",
  save: "providers:save",
  test: "providers:test",
} as const;

export interface ProvidersListResponse {
  providers: Providers;
}

export interface ProvidersGetRequest {
  id: ProviderId;
}

export interface ProvidersGetResponse {
  id: ProviderId;
  apiKey: string;
}

export interface ProvidersSaveRequest {
  partial: ProvidersPartial;
}

export interface ProvidersSaveResponse {
  providers: Providers;
}

export interface ProvidersTestRequest {
  id: ProviderId;
}

export interface ProvidersTestResponse {
  ok: boolean;
  message: string;
}

// Typed API exposed via preload (window.providers)
export type ProvidersApi = {
  list: () => Promise<ProvidersListResponse>;
  get: (req: ProvidersGetRequest) => Promise<ProvidersGetResponse>;
  save: (req: ProvidersSaveRequest) => Promise<ProvidersSaveResponse>;
  test: (req: ProvidersTestRequest) => Promise<ProvidersTestResponse>;
};
