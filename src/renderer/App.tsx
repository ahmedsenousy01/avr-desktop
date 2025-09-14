import React, { useEffect, useMemo, useState } from "react";

import { ProvidersPage } from "@renderer/pages/providers-page";
import { TemplatesPage } from "@renderer/pages/templates-page";

export const App: React.FC = () => {
  const [route, setRoute] = useState<string>(() => window.location.hash || "#providers");

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || "#providers");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const content = useMemo(() => {
    switch (route) {
      case "#templates":
        return <TemplatesPage />;
      case "#providers":
      default:
        return <ProvidersPage />;
    }
  }, [route]);

  return (
    <div className="flex h-screen">
      <nav className="w-[220px] border-r border-gray-200 p-3">
        <div className="mb-3 font-semibold">AVR GUI</div>
        <ul className="m-0 list-none p-0">
          <li>
            <a
              href="#providers"
              className="block px-2.5 py-2 font-semibold"
            >
              Providers & Keys
            </a>
          </li>
          <li>
            <a
              href="#templates"
              className="block px-2.5 py-2 font-semibold"
            >
              Templates
            </a>
          </li>
        </ul>
      </nav>
      <main className="flex-1 overflow-auto">{content}</main>
    </div>
  );
};
