import type {
  AsteriskApi,
  AsteriskRenderConfigRequest,
  AsteriskRenderConfigResponse,
  AsteriskValidateConfigRequest,
  AsteriskValidateConfigResponse,
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
  }
}

export const providers: ProvidersApi | undefined = window.providers;

export const deployments: DeploymentsApi | undefined = window.deployments;

export const asterisk: AsteriskApi | undefined = window.asterisk;

export const preflight: PreflightApi | undefined = window.preflight;

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
