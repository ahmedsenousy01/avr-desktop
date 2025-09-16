interface Props {
  onRetry: () => Promise<void>;
  running: boolean;
  message?: string;
}

export function DockerUnavailableRemediation({ onRetry, running, message }: Props) {
  return (
    <div className="mt-2 text-xs text-slate-800">
      <div>Docker is not available. Start Docker Desktop and wait until it shows Running.</div>
      {message && <div className="mt-1 text-red-700">{message}</div>}
      <button
        type="button"
        className="mt-2 inline-block rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-700"
        onClick={async () => {
          await onRetry();
        }}
        disabled={running}
      >
        Retry Preflight
      </button>
    </div>
  );
}
