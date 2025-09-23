import { z } from "zod";

export const DeploymentEnvSchema = z.object({
  deploymentId: z.string().min(1),
  registryVersion: z.string().min(1),
  // services[serviceName][variableName] = value
  services: z.record(z.string().min(1), z.record(z.string().min(1), z.string())),
});

export type DeploymentEnv = z.infer<typeof DeploymentEnvSchema>;

// IPC: channels
export const EnvIpcChannels = {
  getRegistry: "envRegistry:get",
  getDeploymentEnv: "deploymentEnv:get",
  upsertDeploymentEnvVar: "deploymentEnv:upsertVar",
  removeDeploymentEnvVar: "deploymentEnv:removeVar",
  validatePresence: "deploymentEnv:validate",
} as const;

// IPC: payload schemas
export const GetDeploymentEnvRequestSchema = z.object({ deploymentId: z.string().min(1) });
export type GetDeploymentEnvRequest = z.infer<typeof GetDeploymentEnvRequestSchema>;
export const GetDeploymentEnvResponseSchema = z.object({ env: DeploymentEnvSchema.nullable() });
export type GetDeploymentEnvResponse = z.infer<typeof GetDeploymentEnvResponseSchema>;

export const UpsertDeploymentEnvVarRequestSchema = z.object({
  deploymentId: z.string().min(1),
  serviceName: z.string().min(1),
  variableName: z.string().min(1),
  value: z.string(),
});
export type UpsertDeploymentEnvVarRequest = z.infer<typeof UpsertDeploymentEnvVarRequestSchema>;
export const UpsertDeploymentEnvVarResponseSchema = z.object({ env: DeploymentEnvSchema });
export type UpsertDeploymentEnvVarResponse = z.infer<typeof UpsertDeploymentEnvVarResponseSchema>;

export const RemoveDeploymentEnvVarRequestSchema = z.object({
  deploymentId: z.string().min(1),
  serviceName: z.string().min(1),
  variableName: z.string().min(1),
});
export type RemoveDeploymentEnvVarRequest = z.infer<typeof RemoveDeploymentEnvVarRequestSchema>;
export const RemoveDeploymentEnvVarResponseSchema = z.object({ env: DeploymentEnvSchema });
export type RemoveDeploymentEnvVarResponse = z.infer<typeof RemoveDeploymentEnvVarResponseSchema>;

export const ValidatePresenceResponseSchema = z.object({ missingByService: z.record(z.string(), z.array(z.string())) });
export type ValidatePresenceResponse = z.infer<typeof ValidatePresenceResponseSchema>;

export type EnvApi = {
  getRegistry: () => Promise<unknown>;
  getDeploymentEnv: (req: GetDeploymentEnvRequest) => Promise<GetDeploymentEnvResponse>;
  upsertVar: (req: UpsertDeploymentEnvVarRequest) => Promise<UpsertDeploymentEnvVarResponse>;
  removeVar: (req: RemoveDeploymentEnvVarRequest) => Promise<RemoveDeploymentEnvVarResponse>;
  validatePresence: (req: GetDeploymentEnvRequest) => Promise<ValidatePresenceResponse>;
};
