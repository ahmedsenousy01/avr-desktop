import { useEffect, useMemo, useState } from "react";

import type { EnvRegistry, EnvVariableMeta } from "@main/services/env-registry";
import type { GetDeploymentEnvResponse } from "@shared/types/env";
import type { ProviderId } from "@shared/types/providers";
import { EnvServicePanel } from "@renderer/components/env-service-panel";
import { composePlanGet } from "@renderer/lib/api";

export function EnvEditor({ deploymentId }: { deploymentId?: string }) {
  const [data, setData] = useState<GetDeploymentEnvResponse | null>(null);
  const [registry, setRegistry] = useState<EnvRegistry | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  const [providerPresence, setProviderPresence] = useState<Record<ProviderId, boolean>>(
    {} as Record<ProviderId, boolean>
  );
  const [deploymentSlug, setDeploymentSlug] = useState<string | undefined>(undefined);
  const [composeServices, setComposeServices] = useState<string[] | null>(null); // slugged names
  const [displayNameByExample, setDisplayNameByExample] = useState<Record<string, string>>({});
  const [planValues, setPlanValues] = useState<Record<string, Record<string, string>> | null>(null);
  // planMeta reserved for future use; not needed in the renderer yet

  useEffect(() => {
    (async () => {
      const envApi = window.env;
      const providersApi = window.providers;
      // deployments API no longer needed; plan returns slug
      if (!deploymentId || !envApi) {
        setData(null);
        return;
      }
      const [reg, res] = await Promise.all([envApi.getRegistry(), envApi.getDeploymentEnv({ deploymentId })]);
      setRegistry(reg as EnvRegistry);
      setData(res);

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

      try {
        const plan = await composePlanGet({ deploymentId });
        setComposeServices(plan.services.map((s) => s.slugServiceName));
        setDisplayNameByExample(
          Object.fromEntries(plan.services.map((s) => [s.exampleServiceName, s.displayName ?? s.slugServiceName]))
        );
        setPlanValues(plan.values ?? null);
        setDeploymentSlug(plan.slug);
      } catch {
        setComposeServices(null);
        setDeploymentSlug(undefined);
      }
    })();
  }, [deploymentId]);

  const valuesByService = useMemo(
    () => planValues ?? data?.env?.services ?? ({} as Record<string, Record<string, string>>),
    [planValues, data]
  );

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
          displayName={displayNameByExample[svc.serviceName]}
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
