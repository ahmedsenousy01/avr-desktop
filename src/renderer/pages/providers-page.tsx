import React from "react";

import { createDefaultProviders, PROVIDER_IDS } from "@shared/types/providers";
import { ProviderForm } from "@renderer/components/provider-form";
import { providers as providersApi } from "@renderer/lib/api";

export const ProvidersPage: React.FC = () => {
  const [providers, setProviders] = React.useState(() => createDefaultProviders());
  const [editingId, setEditingId] = React.useState<null | (typeof PROVIDER_IDS)[number]>(null);
  const [toast, setToast] = React.useState<null | { text: string; variant: "success" | "error" }>(null);
  const toastTimerRef = React.useRef<number | null>(null);

  const showToast = (text: string, variant: "success" | "error") => {
    setToast({ text, variant });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  };

  React.useEffect(() => {
    let mounted = true;
    if (providersApi) {
      providersApi
        .list()
        .then((res) => {
          if (mounted) setProviders(res.providers);
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, []);

  const onEdit = (id: (typeof PROVIDER_IDS)[number]) => {
    setEditingId(id);
  };

  return (
    <div className="p-4">
      <h1 className="m-0 text-2xl font-bold">Providers & Keys</h1>
      <p className="mt-1.5 text-slate-600">Store API keys locally. Keys are optional and can be added later.</p>

      {!providersApi && (
        <div className="mt-2 font-semibold text-red-800">
          Preload bridge not available. Reload the app (preload must expose window.providers).
        </div>
      )}

      {editingId && editingId !== "google" && editingId !== "vosk" && (
        <div className="mt-4">
          <ProviderForm
            providerId={editingId}
            apiKey={providers[editingId].apiKey ?? ""}
            onChange={(next) => setProviders((p) => ({ ...p, [editingId]: { apiKey: next } }))}
            onSave={async () => {
              const optimistic = providers;
              if (!providersApi) {
                setEditingId(null);
                showToast("Saved locally", "success");
                return;
              }
              try {
                const res = await providersApi.save({
                  partial: { [editingId]: { apiKey: optimistic[editingId].apiKey } },
                });
                setProviders(res.providers);
                setEditingId(null);
                showToast("Saved", "success");
              } catch {
                setEditingId(null);
                showToast("Save failed", "error");
              }
            }}
            onCancel={() => setEditingId(null)}
            onTest={async (keyToTest: string) => {
              if (!providersApi) {
                const present = keyToTest.trim().length > 0;
                const res = {
                  ok: present,
                  message: present ? "Key present" : "Missing or empty apiKey",
                  validationType: "presence" as const,
                  errorCode: present ? undefined : ("invalid_key" as const),
                };
                showToast(res.message, res.ok ? "success" : "error");
                return res;
              }
              try {
                const res = await providersApi.test({ id: editingId, apiKey: keyToTest });
                showToast(res.message, res.ok ? "success" : "error");
                return res;
              } catch {
                const res = {
                  ok: false,
                  message: "Test failed",
                  validationType: "fallback" as const,
                  errorCode: "unknown_error" as const,
                };
                showToast(res.message, "error");
                return res;
              }
            }}
          />
        </div>
      )}

      {editingId === "google" && (
        <div className="mt-4 rounded-lg border border-gray-200 p-3">
          <div className="font-bold">Google Cloud</div>
          <div className="mt-2 text-sm text-gray-600">
            Upload a service account JSON. It will be stored inside the app workspace.
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-slate-50 px-2.5 py-1.5 font-medium hover:bg-slate-100"
              onClick={async () => {
                if (!providersApi?.uploadGoogleJson) return;
                const res = await providersApi.uploadGoogleJson();
                if (res.storedPath) {
                  const updated = await providersApi.list();
                  setProviders(updated.providers);
                  showToast("Credentials uploaded", "success");
                } else {
                  showToast("Upload cancelled or failed", "error");
                }
              }}
            >
              Upload JSON
            </button>
            <button
              type="button"
              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 font-medium text-red-800 hover:bg-red-100"
              onClick={async () => {
                if (!providersApi?.deleteGoogleJson) return;
                const res = await providersApi.deleteGoogleJson();
                if (res.deleted) {
                  const updated = await providersApi.list();
                  setProviders(updated.providers);
                  showToast("Credentials removed", "success");
                } else {
                  showToast("Delete failed", "error");
                }
              }}
            >
              Delete JSON
            </button>
            <div className="text-xs text-gray-700">
              {providers.google.credentialsFilePath && providers.google.credentialsFilePath.length > 0
                ? providers.google.credentialsFilePath
                : "No file selected"}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-200 px-2.5 py-1.5"
              onClick={() => setEditingId(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {editingId === "vosk" && (
        <div className="mt-4 rounded-lg border border-gray-200 p-3">
          <div className="font-bold">Vosk</div>
          <div className="mt-2 text-sm text-gray-600">Set local model directory path.</div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm"
              placeholder="C:\\path\\to\\vosk-model"
              value={providers.vosk.modelPath ?? ""}
              onChange={(e) => setProviders((p) => ({ ...p, vosk: { modelPath: e.target.value } }))}
            />
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-slate-50 px-2.5 py-1.5 font-medium hover:bg-slate-100"
              onClick={async () => {
                if (!providersApi?.browseVoskModelDir) return;
                const res = await providersApi.browseVoskModelDir();
                if (res.selectedPath) {
                  setProviders((p) => ({ ...p, vosk: { modelPath: res.selectedPath ?? "" } }));
                }
              }}
            >
              Browse…
            </button>
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-slate-50 px-2.5 py-1.5 font-medium hover:bg-slate-100"
              onClick={async () => {
                if (!providersApi) return;
                try {
                  const res = await providersApi.save({
                    partial: { vosk: { modelPath: providers.vosk.modelPath ?? "" } },
                  });
                  setProviders(res.providers);
                  setEditingId(null);
                  showToast("Saved", "success");
                } catch {
                  showToast("Save failed", "error");
                }
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="rounded-md border border-gray-200 px-2.5 py-1.5"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full border-separate border-spacing-0">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">Provider</th>
              <th className="px-3 py-2.5 text-left font-semibold">Status</th>
              <th className="px-3 py-2.5 text-left font-semibold">Key</th>
              <th className="w-[120px]" />
            </tr>
          </thead>
          <tbody>
            {PROVIDER_IDS.map((id) => {
              const row = providers[id] as { apiKey?: string; credentialsFilePath?: string; modelPath?: string };
              const present =
                id === "google"
                  ? typeof row.credentialsFilePath === "string" && row.credentialsFilePath.trim().length > 0
                  : id === "vosk"
                    ? typeof row.modelPath === "string" && row.modelPath.trim().length > 0
                    : typeof row.apiKey === "string" && row.apiKey.trim().length > 0;
              return (
                <tr
                  key={id}
                  className="border-t border-gray-200"
                >
                  <td className="px-3 py-2.5 capitalize">{id}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={
                        "inline-flex items-center gap-2 font-semibold " +
                        (present ? "text-emerald-700" : "text-red-800")
                      }
                    >
                      <span
                        className={
                          "inline-block h-2.5 w-2.5 rounded-full " + (present ? "bg-emerald-500" : "bg-red-500")
                        }
                      />
                      {present ? "Configured" : "Missing"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono">
                    {id === "google"
                      ? row.credentialsFilePath || "—"
                      : id === "vosk"
                        ? row.modelPath || "—"
                        : present
                          ? "••••••••"
                          : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onEdit(id)}
                      className="rounded-md border border-gray-200 bg-slate-50 px-2.5 py-1.5 font-medium hover:bg-slate-100"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={
            "fixed right-4 bottom-4 rounded-lg border px-3 py-2 font-semibold shadow " +
            (toast.variant === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800")
          }
        >
          {toast.text}
        </div>
      )}
    </div>
  );
};
