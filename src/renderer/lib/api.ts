import type {
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
  ProvidersApi,
} from "@shared/ipc";

declare global {
  interface Window {
    providers?: ProvidersApi;
    deployments?: DeploymentsApi;
  }
}

export const providers: ProvidersApi | undefined = window.providers;

export const deployments: DeploymentsApi | undefined = window.deployments;

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
