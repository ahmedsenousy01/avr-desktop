import type { AsteriskConfig } from "./types/asterisk";
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
  asterisk?: AsteriskConfig;
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

// Asterisk IPC channels
export const AsteriskChannels = {
  renderConfig: "asterisk:render-config",
  validateConfig: "asterisk:validate-config",
} as const;

export interface AsteriskValidateConfigRequest {
  config: AsteriskConfig;
}

export interface AsteriskValidateConfigResponse {
  valid: boolean;
  errors: string[];
}

export interface AsteriskRenderConfigRequest {
  config: AsteriskConfig;
  /** Optional: templates source directory; defaults to built-in templates when omitted */
  sourceDir?: string;
  /** Optional: target directory; when provided and preview=false, files will be written */
  targetDir?: string;
  /** If true (default), returns rendered file contents without writing to disk */
  preview?: boolean;
}

export interface AsteriskRenderConfigResponse {
  /** For preview mode: filename -> rendered content */
  files?: Record<string, string>;
  /** For write mode: list of file paths written */
  written?: string[];
}

// Typed API exposed via preload (window.asterisk)
export type AsteriskApi = {
  validateConfig: (req: AsteriskValidateConfigRequest) => Promise<AsteriskValidateConfigResponse>;
  renderConfig: (req: AsteriskRenderConfigRequest) => Promise<AsteriskRenderConfigResponse>;
};
