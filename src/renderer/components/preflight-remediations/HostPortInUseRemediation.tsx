interface Props {
  port: number;
}

export function HostPortInUseRemediation({ port }: Props) {
  return (
    <div className="mt-2 text-xs text-slate-800">
      <div>This host port is in use by another process.</div>
      <div className="mt-1">Identify and stop the process if appropriate:</div>
      <pre className="mt-1 rounded border border-slate-200 bg-slate-50 p-2">{`PowerShell:
Get-NetTCPConnection -LocalPort ${port} | Format-Table -Auto
# take the OwningProcess/PID
Get-Process -Id <pid>`}</pre>
    </div>
  );
}
