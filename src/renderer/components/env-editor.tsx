import { useEffect, useMemo, useState } from "react";

import type { EnvRegistry, EnvVariableMeta } from "@main/services/env-registry";
import type { GetDeploymentEnvResponse, ValidatePresenceResponse } from "@shared/types/env";
import type { ProviderId } from "@shared/types/providers";
import { EnvServicePanel } from "@renderer/components/env-service-panel";
import { composePlanGet } from "@renderer/lib/api";

function getDisplayName(slug: string, exampleServiceName: string): string {
  // exampleServiceName like "avr-sts-gemini" -> suffix after "avr-"
  const suffix = exampleServiceName.startsWith("avr-") ? exampleServiceName.slice(4) : exampleServiceName;
  return `${slug}-${suffix}`;
}

export function EnvEditor({ deploymentId }: { deploymentId?: string }) {
  const [data, setData] = useState<GetDeploymentEnvResponse | null>(null);
  const [_validation, setValidation] = useState<ValidatePresenceResponse | null>(null);
  const [registry, setRegistry] = useState<EnvRegistry | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  const [providerPresence, setProviderPresence] = useState<Record<ProviderId, boolean>>(
    {} as Record<ProviderId, boolean>
  );
  const [deploymentSlug, setDeploymentSlug] = useState<string | undefined>(undefined);
  const [composeServices, setComposeServices] = useState<string[] | null>(null); // slugged names

  useEffect(() => {
    (async () => {
      const envApi = window.env;
      const providersApi = window.providers;
      const deploymentsApi = window.deployments;
      const composeApi = window.compose; // legacy generate
      if (!deploymentId || !envApi) {
        setData(null);
        setValidation(null);
        return;
      }
      const [reg, res, val] = await Promise.all([
        envApi.getRegistry(),
        envApi.getDeploymentEnv({ deploymentId }),
        envApi.validatePresence({ deploymentId }),
      ]);
      setRegistry(reg as EnvRegistry);
      setData(res);
      setValidation(val);

      if (providersApi) {
        const providersList = await providersApi.list();
        const present: Record<ProviderId, boolean> = {
          openai: !!providersList.providers.openai.apiKey,
          anthropic: !!providersList.providers.anthropic.apiKey,
          gemini: !!providersList.providers.gemini.apiKey,
          deepgram: !!providersList.providers.deepgram.apiKey,
          elevenlabs: !!providersList.providers.elevenlabs.apiKey,
        } as Record<ProviderId, boolean>;
        setProviderPresence(present);
      } else {
        setProviderPresence({} as Record<ProviderId, boolean>);
      }

      // Fetch slug and compose services for strict filtering
      try {
        if (deploymentsApi) {
          const dep = await deploymentsApi.get({ id: deploymentId });
          setDeploymentSlug(dep.slug);
        } else {
          setDeploymentSlug(undefined);
        }
      } catch {
        setDeploymentSlug(undefined);
      }

      // Prefer plan endpoint (no write); fallback to generate
      try {
        const plan = await composePlanGet({ deploymentId });
        setComposeServices(plan.services.map((s) => s.slugServiceName));
      } catch {
        try {
          if (composeApi) {
            const gen = await composeApi.generate({ deploymentId });
            setComposeServices(gen.services);
          } else {
            setComposeServices(null);
          }
        } catch {
          setComposeServices(null);
        }
      }
    })();
  }, [deploymentId]);

  const valuesByService = useMemo(() => data?.env?.services ?? ({} as Record<string, Record<string, string>>), [data]);

  const allowedExampleNames = useMemo(() => {
    if (!composeServices || !deploymentSlug) return null;
    const allow = new Set<string>();
    for (const s of composeServices) {
      if (!s.startsWith(`${deploymentSlug}-`)) continue;
      const suffix = s.slice(deploymentSlug.length + 1);
      allow.add(`avr-${suffix}`);
    }
    return allow;
  }, [composeServices, deploymentSlug]);

  const services = useMemo(() => {
    if (!allowedExampleNames || allowedExampleNames.size === 0)
      return [] as { serviceName: string; variables: EnvVariableMeta[] }[];
    const all = (registry?.services ?? []) as { serviceName: string; variables: EnvVariableMeta[] }[];

    // Build order from composeServices
    const order: Record<string, number> = {};
    if (composeServices && deploymentSlug) {
      composeServices.forEach((s, idx) => {
        if (s.startsWith(`${deploymentSlug}-`)) {
          const suffix = s.slice(deploymentSlug.length + 1);
          order[`avr-${suffix}`] = idx;
        }
      });
    }

    const present = all.filter((s) => allowedExampleNames.has(s.serviceName));

    // Add synthetic entries for compose services that have no registry entry (e.g., avr-tts-elevenlabs)
    const registryNames = new Set(present.map((s) => s.serviceName));
    const synthetic: { serviceName: string; variables: EnvVariableMeta[] }[] = [];
    for (const name of allowedExampleNames) {
      if (!registryNames.has(name)) {
        synthetic.push({ serviceName: name, variables: [] });
      }
    }

    return [...present, ...synthetic].sort((a, b) => (order[a.serviceName] ?? 999) - (order[b.serviceName] ?? 999));
  }, [registry, allowedExampleNames, composeServices, deploymentSlug]);

  if (!deploymentId) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">All values are masked by default.</div>
        <button
          type="button"
          className="rounded border border-gray-300 px-2 py-1 text-xs"
          onClick={() => setRevealAll((v) => !v)}
        >
          {revealAll ? "Hide All" : "Reveal All"}
        </button>
      </div>
      {services.map((svc) => (
        <EnvServicePanel
          key={svc.serviceName}
          deploymentId={deploymentId}
          serviceName={svc.serviceName}
          variables={svc.variables}
          values={valuesByService[svc.serviceName]}
          masked={!revealAll}
          providerPresence={providerPresence}
          displayName={deploymentSlug ? getDisplayName(deploymentSlug, svc.serviceName) : undefined}
          onChange={(next) => {
            if (!data?.env || !next) return;
            const updated = { ...data.env.services };
            updated[svc.serviceName] = next;
            setData({ env: { ...data.env, services: updated } });
          }}
        />
      ))}
    </div>
  );
}
