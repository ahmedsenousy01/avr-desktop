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
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Providers & Keys</h1>
      <p style={{ marginTop: 6, color: "#475569" }}>
        Store API keys locally. Keys are optional and can be added later.
      </p>

      {!providersApi && (
        <div style={{ marginTop: 8, color: "#991b1b", fontWeight: 600 }}>
          Preload bridge not available. Reload the app (preload must expose window.providers).
        </div>
      )}

      {editingId && (
        <div style={{ marginTop: 16 }}>
          <ProviderForm
            providerId={editingId}
            apiKey={providers[editingId].apiKey}
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
            onTest={async () => {
              if (!providersApi) {
                const present = providers[editingId].apiKey.trim().length > 0;
                const res = present
                  ? { ok: true, message: "Key present" }
                  : { ok: false, message: "Missing or empty apiKey" };
                showToast(res.message, res.ok ? "success" : "error");
                return res;
              }
              try {
                const res = await providersApi.test({ id: editingId });
                showToast(res.message, res.ok ? "success" : "error");
                return res;
              } catch {
                const res = { ok: false, message: "Test failed" } as const;
                showToast(res.message, "error");
                return res;
              }
            }}
          />
        </div>
      )}

      <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Provider</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Key</th>
              <th style={{ width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {PROVIDER_IDS.map((id) => {
              const key = providers[id].apiKey;
              const present = key.trim().length > 0;
              return (
                <tr
                  key={id}
                  style={{ borderTop: "1px solid #e5e7eb" }}
                >
                  <td style={{ padding: "10px 12px", textTransform: "capitalize" }}>{id}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        color: present ? "#065f46" : "#991b1b",
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 9999,
                          background: present ? "#10b981" : "#ef4444",
                          display: "inline-block",
                        }}
                      />
                      {present ? "Configured" : "Missing"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {present ? "••••••••" : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      type="button"
                      onClick={() => onEdit(id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #e5e7eb",
                        background: "#f8fafc",
                        cursor: "pointer",
                      }}
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
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            background: toast.variant === "success" ? "#ecfdf5" : "#fef2f2",
            color: toast.variant === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${toast.variant === "success" ? "#a7f3d0" : "#fecaca"}`,
            padding: "8px 12px",
            borderRadius: 8,
            boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
            fontWeight: 600,
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
};
