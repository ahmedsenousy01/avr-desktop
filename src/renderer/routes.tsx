import { createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ComposerPage } from "@renderer/pages/composer-page";
import { DeploymentsPage } from "@renderer/pages/deployments-page";
import { ProvidersPage } from "@renderer/pages/providers-page";
import { TemplatesPage } from "@renderer/pages/templates-page";

function RootLayout() {
  return (
    <div className="flex h-screen">
      <nav className="w-[220px] border-r border-gray-200 p-3">
        <div className="mb-3 font-semibold">AVR GUI</div>
        <ul className="m-0 list-none p-0">
          <li>
            <Link
              to="/providers"
              className="block px-2.5 py-2 font-semibold"
              activeProps={{ className: "text-blue-600" }}
            >
              Providers & Keys
            </Link>
          </li>
          <li>
            <Link
              to="/templates"
              className="block px-2.5 py-2 font-semibold"
              activeProps={{ className: "text-blue-600" }}
            >
              Templates
            </Link>
          </li>
          <li>
            <Link
              to="/deployments"
              className="block px-2.5 py-2 font-semibold"
              activeProps={{ className: "text-blue-600" }}
            >
              Deployments
            </Link>
          </li>
        </ul>
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ProvidersPage,
});

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/providers",
  component: ProvidersPage,
});

const templatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/templates",
  component: TemplatesPage,
});

const deploymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deployments",
  component: DeploymentsPage,
});

const composerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/composer",
  component: ComposerPage,
});

const routeTree = rootRoute.addChildren([indexRoute, providersRoute, templatesRoute, deploymentsRoute, composerRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return (
    <>
      <RouterProvider router={router} />
      {import.meta.env.DEV && (
        <TanStackRouterDevtools
          router={router}
          position="bottom-right"
        />
      )}
    </>
  );
}
