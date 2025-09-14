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

// Deployments IPC channels (scaffold for Templates & Composer)
export const DeploymentsChannels = {
  createFromTemplate: "deployments:createFromTemplate",
  createFromSelection: "deployments:createFromSelection",
  list: "deployments:list",
  update: "deployments:update",
  duplicate: "deployments:duplicate",
  delete: "deployments:delete",
} as const;

export interface DeploymentsCreateFromTemplateRequest {
  templateId: string;
  name?: string;
}

export interface DeploymentsCreateFromTemplateResponse {
  id: string;
  name: string;
}

export interface DeploymentsCreateFromSelectionRequest {
  name?: string;
  type: "modular" | "sts";
  providers: Record<string, string>;
}

export interface DeploymentsCreateFromSelectionResponse {
  id: string;
  name: string;
}

export interface DeploymentsListItem {
  id: string;
  slug: string;
  name: string;
  type: "modular" | "sts";
  updatedAt: string;
}

export interface DeploymentsListResponse {
  deployments: DeploymentsListItem[];
}

export interface DeploymentsUpdateRequest {
  id: string;
  name?: string;
  providers?: Record<string, string>;
}

export interface DeploymentsUpdateResponse {
  id: string;
  name: string;
}

export interface DeploymentsDuplicateRequest {
  id: string;
  name?: string;
}

export interface DeploymentsDuplicateResponse {
  id: string;
  name: string;
}

export interface DeploymentsDeleteRequest {
  id: string;
}

export interface DeploymentsDeleteResponse {
  ok: boolean;
}

export type DeploymentsApi = {
  createFromTemplate: (req: DeploymentsCreateFromTemplateRequest) => Promise<DeploymentsCreateFromTemplateResponse>;
  createFromSelection: (req: DeploymentsCreateFromSelectionRequest) => Promise<DeploymentsCreateFromSelectionResponse>;
  list: () => Promise<DeploymentsListResponse>;
  update: (req: DeploymentsUpdateRequest) => Promise<DeploymentsUpdateResponse>;
  duplicate: (req: DeploymentsDuplicateRequest) => Promise<DeploymentsDuplicateResponse>;
  delete: (req: DeploymentsDeleteRequest) => Promise<DeploymentsDeleteResponse>;
};
