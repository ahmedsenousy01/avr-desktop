import type {
  AsteriskApi,
  AsteriskRenderConfigRequest,
  AsteriskRenderConfigResponse,
  AsteriskValidateConfigRequest,
  AsteriskValidateConfigResponse,
  ComposeApi,
  ComposeDownResponse,
  ComposeGenerateRequest,
  ComposeGenerateResponse,
  ComposeLogsExportRequest,
  ComposeLogsExportResponse,
  ComposeLogsStartRequest,
  ComposeLogsStartResponse,
  ComposeLogsStopRequest,
  ComposeLogsStopResponse,
  ComposeStatusResponse,
  ComposeStatusStartRequest,
  ComposeStatusStartResponse,
  ComposeStatusStopRequest,
  ComposeStatusStopResponse,
  ComposeUpResponse,
  DeploymentsApi,
  DeploymentsCreateFromSelectionRequest,
  DeploymentsCreateFromSelectionResponse,
  DeploymentsCreateFromTemplateResponse,
  DeploymentsDeleteRequest,
  DeploymentsDeleteResponse,
  DeploymentsDuplicateRequest,
  DeploymentsDuplicateResponse,
  DeploymentsListResponse,
  DeploymentsUpdateRequest,
  DeploymentsUpdateResponse,
  PreflightApi,
  PreflightFixRequest,
  PreflightFixResponse,
  PreflightLastRequest,
  PreflightLastResponse,
  PreflightRunRequest,
  PreflightRunResponse,
  ProvidersApi,
} from "@shared/ipc";

declare global {
  interface Window {
    providers?: ProvidersApi;
    deployments?: DeploymentsApi;
    asterisk?: AsteriskApi;
    preflight?: PreflightApi;
    compose?: ComposeApi;
  }
}

export const providers: ProvidersApi | undefined = window.providers;

export const deployments: DeploymentsApi | undefined = window.deployments;

export const asterisk: AsteriskApi | undefined = window.asterisk;

export const preflight: PreflightApi | undefined = window.preflight;

export const compose: ComposeApi | undefined = window.compose;

export async function asteriskValidateConfig(
  req: AsteriskValidateConfigRequest
): Promise<AsteriskValidateConfigResponse> {
  if (!window.asterisk) throw new Error("Asterisk API is not available in preload");
  return window.asterisk.validateConfig(req);
}

export async function asteriskRenderConfig(req: AsteriskRenderConfigRequest): Promise<AsteriskRenderConfigResponse> {
  if (!window.asterisk) throw new Error("Asterisk API is not available in preload");
  return window.asterisk.renderConfig(req);
}

export async function deploymentsCreateFromTemplate(
  templateId: string,
  name?: string
): Promise<DeploymentsCreateFromTemplateResponse> {
  if (!window.deployments) {
    throw new Error("Deployments API is not available in preload");
  }
  return window.deployments.createFromTemplate({ templateId, name });
}

export async function deploymentsCreateFromSelection(
  req: DeploymentsCreateFromSelectionRequest
): Promise<DeploymentsCreateFromSelectionResponse> {
  if (!window.deployments) {
    throw new Error("Deployments API is not available in preload");
  }
  return window.deployments.createFromSelection(req);
}

export async function deploymentsList(): Promise<DeploymentsListResponse> {
  if (!window.deployments) throw new Error("Deployments API is not available in preload");
  return window.deployments.list();
}

export async function deploymentsUpdate(req: DeploymentsUpdateRequest): Promise<DeploymentsUpdateResponse> {
  if (!window.deployments) throw new Error("Deployments API is not available in preload");
  return window.deployments.update(req);
}

export async function deploymentsDuplicate(req: DeploymentsDuplicateRequest): Promise<DeploymentsDuplicateResponse> {
  if (!window.deployments) throw new Error("Deployments API is not available in preload");
  return window.deployments.duplicate(req);
}

export async function deploymentsDelete(req: DeploymentsDeleteRequest): Promise<DeploymentsDeleteResponse> {
  if (!window.deployments) throw new Error("Deployments API is not available in preload");
  return window.deployments.delete(req);
}

export async function preflightRun(req: PreflightRunRequest): Promise<PreflightRunResponse> {
  if (!window.preflight) throw new Error("Preflight API is not available in preload");
  return window.preflight.run(req);
}

export async function preflightLast(req: PreflightLastRequest): Promise<PreflightLastResponse> {
  if (!window.preflight) throw new Error("Preflight API is not available in preload");
  return window.preflight.last(req);
}

export async function preflightFix(req: PreflightFixRequest): Promise<PreflightFixResponse> {
  if (!window.preflight) throw new Error("Preflight API is not available in preload");
  return window.preflight.fix(req);
}

export async function composeGenerate(req: ComposeGenerateRequest): Promise<ComposeGenerateResponse> {
  if (!window.compose) throw new Error("Compose API is not available in preload");
  return window.compose.generate(req);
}

export async function composeUp(req: ComposeGenerateRequest): Promise<ComposeUpResponse> {
  if (!window.compose) throw new Error("Compose API is not available in preload");
  return window.compose.up(req);
}

export async function composeDown(req: ComposeGenerateRequest): Promise<ComposeDownResponse> {
  if (!window.compose) throw new Error("Compose API is not available in preload");
  return window.compose.down(req);
}

export async function composeStatus(req: ComposeGenerateRequest): Promise<ComposeStatusResponse> {
  if (!window.compose) throw new Error("Compose API is not available in preload");
  return window.compose.status(req);
}

export async function composeLogsStart(req: ComposeLogsStartRequest): Promise<ComposeLogsStartResponse> {
  if (!window.compose) throw new Error("Compose API is not available in preload");
  return window.compose.logsStart(req);
}

export async function composeLogsStop(req: ComposeLogsStopRequest): Promise<ComposeLogsStopResponse> {
  if (!window.compose) throw new Error("Compose API is not available in preload");
  return window.compose.logsStop(req);
}

export async function composeLogsExport(req: ComposeLogsExportRequest): Promise<ComposeLogsExportResponse> {
  if (!window.compose) throw new Error("Compose API is not available in preload");
  return window.compose.logsExport(req);
}

export async function composeStatusStart(req: ComposeStatusStartRequest): Promise<ComposeStatusStartResponse> {
  if (!window.compose) throw new Error("Compose API is not available in preload");
  return window.compose.statusStart(req);
}

export async function composeStatusStop(req: ComposeStatusStopRequest): Promise<ComposeStatusStopResponse> {
  if (!window.compose) throw new Error("Compose API is not available in preload");
  return window.compose.statusStop(req);
}
