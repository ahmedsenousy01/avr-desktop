import type { AsteriskConfig } from "./types/asterisk";
import type { PreflightItem, PreflightSeverity } from "./types/preflight";
import type {
  ApiValidationErrorCode,
  ApiValidationType,
  ProviderId,
  Providers,
  ProvidersPartial,
} from "./types/providers";

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
  apiKey?: string; // Optional: if provided, test this key instead of stored key
}

export interface ProvidersTestResponse {
  ok: boolean;
  message: string;
  validationType: ApiValidationType;
  errorCode?: ApiValidationErrorCode;
  details?: string;
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
  get: "deployments:get",
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

export interface DeploymentsGetRequest {
  id: string;
}

export interface DeploymentsGetResponse {
  id: string;
  name: string;
  slug: string;
  type: "modular" | "sts";
  asterisk?: AsteriskConfig;
  environmentOverrides?: Record<string, string>;
  updatedAt: string;
}

export interface DeploymentsUpdateRequest {
  id: string;
  name?: string;
  providers?: Record<string, string>;
  asterisk?: AsteriskConfig;
  environmentOverrides?: Record<string, string>;
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
  get: (req: DeploymentsGetRequest) => Promise<DeploymentsGetResponse>;
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

// Preflight IPC channels
export const PreflightChannels = {
  run: "preflight:run",
  last: "preflight:last",
  fix: "preflight:fix",
} as const;

export interface PreflightRunRequest {
  /** Deployment id to run preflight for */
  deploymentId: string;
}

export interface PreflightSummary {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  startedAt: number; // epoch ms
  finishedAt: number; // epoch ms
  durationMs: number;
  overall: PreflightSeverity;
}

export interface PreflightResult {
  items: PreflightItem[];
  summary: PreflightSummary;
}

export interface PreflightRunResponse {
  result: PreflightResult;
}

export interface PreflightLastRequest {
  /** Deployment id to fetch last preflight results for */
  deploymentId: string;
}

export interface PreflightLastResponse {
  result: PreflightResult | null;
}

export type PreflightApi = {
  run: (req: PreflightRunRequest) => Promise<PreflightRunResponse>;
  last: (req: PreflightLastRequest) => Promise<PreflightLastResponse>;
  fix: (req: PreflightFixRequest) => Promise<PreflightFixResponse>;
};

export interface PreflightFixRequest {
  /** Deployment id to fix based on last preflight results */
  deploymentId: string;
  /** The preflight item id to target (e.g., "docker:ports:conflicts") */
  itemId: string;
}

export interface PreflightFixResponse {
  fixed: boolean;
  message?: string;
  /** Optional: applied changes summary */
  applied?: {
    asterisk?: Partial<AsteriskConfig>;
    removedDocker?: { containers: string[]; networks: string[]; volumes: string[] };
  };
}

// Compose IPC channels
export const ComposeChannels = {
  generate: "compose:generate",
  up: "compose:up",
  down: "compose:down",
  status: "compose:status",
  logsStart: "compose:logsStart",
  logsStop: "compose:logsStop",
  logsExport: "compose:logsExport",
  statusStart: "compose:statusStart",
  statusStop: "compose:statusStop",
} as const;

export interface ComposeGenerateRequest {
  deploymentId: string;
}

export interface ComposeGenerateResponse {
  filePath: string;
  changed: boolean;
  services: string[];
}

// Compose planning (no write) -------------------------------------------------

export const ComposePlanChannels = {
  plan: "compose:plan",
} as const;

export interface ComposePlanRequest {
  deploymentId: string;
}

export interface ComposePlannedService {
  exampleServiceName: string; // e.g., avr-sts-gemini
  slugServiceName: string; // e.g., ${slug}-sts-gemini
}

export interface ComposePlanResponse {
  slug: string;
  services: ComposePlannedService[]; // in compose order
}

export type ComposePlanApi = {
  plan: (req: ComposePlanRequest) => Promise<ComposePlanResponse>;
};

export type ComposeApi = {
  generate: (req: ComposeGenerateRequest) => Promise<ComposeGenerateResponse>;
  up: (req: ComposeGenerateRequest) => Promise<ComposeUpResponse>;
  down: (req: ComposeGenerateRequest) => Promise<ComposeDownResponse>;
  status: (req: ComposeGenerateRequest) => Promise<ComposeStatusResponse>;
  logsStart: (req: ComposeLogsStartRequest) => Promise<ComposeLogsStartResponse>;
  logsStop: (req: ComposeLogsStopRequest) => Promise<ComposeLogsStopResponse>;
  logsExport: (req: ComposeLogsExportRequest) => Promise<ComposeLogsExportResponse>;
  statusStart: (req: ComposeStatusStartRequest) => Promise<ComposeStatusStartResponse>;
  statusStop: (req: ComposeStatusStopRequest) => Promise<ComposeStatusStopResponse>;
};

export interface ComposeUpResponse {
  services: string[];
  stdout: string;
}

export interface ComposeDownResponse {
  services: string[];
  stdout: string;
}

export type ComposeServiceState = "running" | "exited" | "unknown";

export interface ComposeServiceStatus {
  service: string;
  state: ComposeServiceState;
  containerId?: string;
  health?: string;
  role?: string;
}

export interface ComposeStatusResponse {
  services: ComposeServiceStatus[];
}

export interface ComposeStatusStartRequest {
  deploymentId: string;
  intervalMs?: number; // default 2000
}

export interface ComposeStatusStartResponse {
  subscriptionId: string;
}

export interface ComposeStatusStopRequest {
  subscriptionId: string;
}

export interface ComposeStatusStopResponse {
  stopped: boolean;
}

export const ComposeEventChannels = {
  statusUpdate: "compose:statusUpdate",
  logsData: "compose:logsData",
  logsClosed: "compose:logsClosed",
  logsError: "compose:logsError",
} as const;

export interface ComposeLogsStartRequest {
  deploymentId: string;
  service?: string; // if omitted, aggregate logs
}

export interface ComposeLogsStartResponse {
  subscriptionId: string;
}

export interface ComposeLogsStopRequest {
  subscriptionId: string;
}

export interface ComposeLogsStopResponse {
  stopped: boolean;
}

export interface ComposeLogsExportRequest {
  deploymentId: string;
  /** Optional: service name; if omitted, exports aggregated logs */
  service?: string;
  /** Log content to write */
  content: string;
}

export interface ComposeLogsExportResponse {
  filePath: string;
}

export interface ComposeLogsDataEvent {
  subscriptionId: string;
  chunk: string;
}

export interface ComposeLogsClosedEvent {
  subscriptionId: string;
  exitCode: number;
}

export interface ComposeLogsErrorEvent {
  subscriptionId: string;
  message: string;
}
