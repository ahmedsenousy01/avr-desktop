//

import { IMAGES } from "../../shared/registry/images";

/*
  Env Registry derived from shared IMAGES registry
  - Single source of truth: src/shared/registry/images.ts
  - Defaults mirror image defaultEnv; required flags come from envSchema
  - All UI masking is global (not per-field). "required" is used for presence-only validation.
*/

export type EnvVariableMeta = {
  name: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
};

export type ServiceEnvTemplate = {
  serviceName: string;
  variables: readonly EnvVariableMeta[];
};

export type EnvRegistry = {
  version: string;
  source: "images";
  services: readonly ServiceEnvTemplate[];
};

// Helpers
function v(name: string, defaultValue?: string, description?: string): EnvVariableMeta {
  return {
    name,
    required: defaultValue === undefined,
    defaultValue,
    description,
  };
}

function dedupeAndSortVariables(variables: EnvVariableMeta[]): EnvVariableMeta[] {
  const byName = new Map<string, EnvVariableMeta>();
  for (const variable of variables) {
    if (!byName.has(variable.name)) {
      byName.set(variable.name, variable);
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeRegistry(registry: EnvRegistry): EnvRegistry {
  return {
    ...registry,
    services: registry.services.map((svc) => ({
      serviceName: svc.serviceName.trim(),
      variables: dedupeAndSortVariables(svc.variables as EnvVariableMeta[]),
    })),
  };
}

function buildRegistryFromImages(): EnvRegistry {
  const services: ServiceEnvTemplate[] = Object.entries(IMAGES).map(([serviceName, spec]) => {
    const EMPTY_DEFAULTS: Readonly<Record<string, string>> = Object.freeze({});
    const EMPTY_ENV_SCHEMA: readonly { key: string }[] = Object.freeze([]);

    const envSchema = spec.envSchema ?? EMPTY_ENV_SCHEMA;
    const defaults = spec.defaultEnv ?? EMPTY_DEFAULTS;
    const variables: EnvVariableMeta[] = envSchema.map((f) => v(f.key, defaults[f.key]));
    return { serviceName, variables: dedupeAndSortVariables(variables) };
  });
  return {
    version: "0.2.0",
    source: "images",
    services,
  };
}

const RAW_ENV_REGISTRY: EnvRegistry = buildRegistryFromImages();

export const ENV_REGISTRY_VERSION = RAW_ENV_REGISTRY.version;

export const ENV_REGISTRY: EnvRegistry = (function toFrozenRegistry() {
  const normalized = normalizeRegistry(RAW_ENV_REGISTRY);
  // Shallow-freeze top-level and service arrays for immutability guarantees
  const frozenServices = normalized.services.map((svc) => ({
    serviceName: svc.serviceName,
    variables: Object.freeze([...(svc.variables as EnvVariableMeta[])]),
  }));
  return Object.freeze({ ...normalized, services: Object.freeze(frozenServices) });
})();
