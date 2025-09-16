import type { PreflightItem } from "@shared/types/preflight";
import { preflightFix } from "@renderer/lib/api";

interface Props {
  deploymentId: string;
  item: PreflightItem;
  running: boolean;
  onRerun: () => Promise<void>;
}

export function DockerPortsConflictRemediation({ deploymentId, item, running, onRerun }: Props) {
  const data = (item as unknown as { data?: Record<string, unknown> }).data || {};
  const sipPort = Number((data as { sipPort?: number }).sipPort);
  const rtp = ((data as { rtpRange?: { start: number; end: number } }).rtpRange || {
    start: 0,
    end: 0,
  }) as { start: number; end: number };
  const conflictsArr = (data as { conflicts?: unknown[] }).conflicts;
  const conflicts: { container: string; hostPort: number; protocol: string }[] = Array.isArray(conflictsArr)
    ? (data as { conflicts: { container: string; hostPort: number; protocol: string }[] }).conflicts
    : [];

  const used = new Set<number>(conflicts.map((c) => c.hostPort));
  function isInRtpRange(p: number): boolean {
    return p >= rtp.start && p <= rtp.end;
  }
  function findNextFreePort(start: number): number {
    let p = Math.max(1024, start);
    while (used.has(p) || isInRtpRange(p)) p += 1;
    return p;
  }
  function findFreeRange(size: number, startFrom = Math.max(1024, rtp.start)) {
    let start = startFrom;
    while (true) {
      const end = start + size - 1;
      let ok = true;
      for (let p = start; p <= end; p += 1) {
        if (used.has(p) || p === sipPort) {
          ok = false;
          break;
        }
      }
      if (ok) return { start, end } as const;
      start = end + 1;
      if (start > 65000) return null;
    }
  }

  const sipSuggested = used.has(sipPort) || isInRtpRange(sipPort) ? findNextFreePort(sipPort + 1) : null;
  const size = Math.max(0, rtp.end - rtp.start + 1);
  let rtpSuggested: { start: number; end: number } | null = null;
  if (conflicts.some((c) => c.hostPort >= rtp.start && c.hostPort <= rtp.end)) {
    rtpSuggested = findFreeRange(size);
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="text-sm">
        Planned: SIP {sipPort}, RTP {rtp.start}-{rtp.end}
      </div>
      {conflicts.length > 0 && (
        <div className="text-xs text-red-900">
          Conflicts:
          <ul className="mt-1 list-inside list-disc space-y-1">
            {conflicts.map((c, idx) => (
              <li key={`${c.container}:${c.hostPort}:${idx}`}>
                {c.container} maps {c.hostPort}/{c.protocol}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(sipSuggested || rtpSuggested) && (
        <div className="text-xs text-slate-800">
          Suggestions:
          <ul className="mt-1 list-inside list-disc space-y-1">
            {sipSuggested && <li>Use SIP port {sipSuggested}</li>}
            {rtpSuggested && (
              <li>
                Use RTP range {rtpSuggested.start}-{rtpSuggested.end}
              </li>
            )}
          </ul>
        </div>
      )}
      <div>
        <a
          href={`/asterisk?id=${deploymentId}`}
          className="inline-block rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-700"
        >
          Change ports in Asterisk settings
        </a>
        <button
          type="button"
          className="ml-2 inline-block rounded bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700"
          onClick={async () => {
            try {
              await preflightFix({ deploymentId, itemId: item.id });
              await onRerun();
            } catch {
              /* ignore */
            }
          }}
          disabled={running}
        >
          Auto-fix
        </button>
      </div>
    </div>
  );
}
