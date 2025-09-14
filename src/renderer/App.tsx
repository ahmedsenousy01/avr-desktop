import React from "react";

import { ProvidersPage } from "@renderer/pages/providers-page";

export const App: React.FC = () => {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <nav style={{ width: 220, borderRight: "1px solid #e5e7eb", padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>AVR GUI</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <li>
            <span style={{ display: "block", padding: "8px 10px", fontWeight: 600 }}>Providers & Keys</span>
          </li>
        </ul>
      </nav>
      <main style={{ flex: 1, overflow: "auto" }}>
        <ProvidersPage />
      </main>
    </div>
  );
};
