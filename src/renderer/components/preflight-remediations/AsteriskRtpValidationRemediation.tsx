import type { PreflightItem } from "@shared/types/preflight";
import { preflightFix } from "@renderer/lib/api";

interface Props {
  deploymentId: string;
  item: PreflightItem;
  running: boolean;
  onRerun: () => Promise<void>;
}

export function AsteriskRtpValidationRemediation({ deploymentId, item, running, onRerun }: Props) {
  return (
    <div className="mt-2">
      <a
        href={`/asterisk?id=${deploymentId}`}
        className="inline-block rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-700"
      >
        Open Asterisk settings
      </a>
      <button
        type="button"
        className="ml-2 inline-block rounded bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700"
        onClick={async () => {
          try {
            await preflightFix({ deploymentId, itemId: item.id });
            await onRerun();
          } catch {}
        }}
        disabled={running}
      >
        Auto-fix
      </button>
      <div className="mt-2 text-xs text-slate-700">
        Suggestions:
        <ul className="mt-1 list-inside list-disc space-y-1">
          <li>Ensure rtpStart &lt; rtpEnd</li>
          <li>Ensure SIP port is outside the RTP range</li>
          <li>Use a practical range like 10000–20000 or 30000–40000</li>
        </ul>
      </div>
    </div>
  );
}
