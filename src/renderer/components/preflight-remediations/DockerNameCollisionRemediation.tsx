import type { PreflightItem } from "@shared/types/preflight";
import { preflightFix } from "@renderer/lib/api";

interface Props {
  deploymentId: string;
  item: PreflightItem;
  running: boolean;
  onRerun: () => Promise<void>;
}

export function DockerNameCollisionRemediation({ deploymentId, item, running, onRerun }: Props) {
  const data = item.data;
  const containers = Array.isArray(data?.containers) ? data.containers : [];
  const networks = Array.isArray(data?.networks) ? data.networks : [];
  const volumes = Array.isArray(data?.volumes) ? data.volumes : [];

  const hasAny = containers.length + networks.length + volumes.length > 0;

  return (
    <div className="mt-2 text-xs text-slate-800">
      <div className="mb-1">Resources matching this deployment&apos;s prefix may interfere.</div>
      {hasAny && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="font-semibold">Containers</div>
            <ul className="list-inside list-disc">
              {containers.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold">Networks</div>
            <ul className="list-inside list-disc">
              {networks.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold">Volumes</div>
            <ul className="list-inside list-disc">
              {volumes.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="mt-2">
        <button
          type="button"
          className="inline-block rounded bg-amber-600 px-2 py-1 text-white hover:bg-amber-700"
          onClick={async () => {
            try {
              await preflightFix({ deploymentId, itemId: item.id });
              await onRerun();
            } catch {}
          }}
          disabled={running}
        >
          Clean up matching Docker resources
        </button>
        <a
          href={`/deployments`}
          className="ml-2 inline-block rounded border border-slate-300 px-2 py-1 text-slate-800 hover:bg-slate-100"
        >
          Duplicate deployment with new name
        </a>
      </div>
    </div>
  );
}
