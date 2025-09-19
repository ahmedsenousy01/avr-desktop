import { createRootRoute, createRoute, createRouter, redirect, RouterProvider } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { AsteriskPage } from "@renderer/pages/asterisk-page";
import { ComposerPage } from "@renderer/pages/composer-page";
import { DeploymentsPage } from "@renderer/pages/deployments-page";
import { ProvidersPage } from "@renderer/pages/providers-page";
import { TemplatesPage } from "@renderer/pages/templates-page";
import { RootLayout } from "@renderer/root-layout";

import { EnvironmentPage } from "./pages/environment-page";

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/providers" });
  },
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

const asteriskRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/asterisk",
  component: AsteriskPage,
});

const environmentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/environment",
  component: EnvironmentPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  providersRoute,
  templatesRoute,
  deploymentsRoute,
  composerRoute,
  asteriskRoute,
  environmentRoute,
]);

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
