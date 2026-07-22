import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { AppShell } from "../components/AppShell";
import { PluginPageHost } from "../components/PluginPageHost";
import { DiagnosticsPage } from "../pages/DiagnosticsPage";
import { FavoritesPage } from "../pages/FavoritesPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { OverviewPage } from "../pages/OverviewPage";
import { PluginManagerPage } from "../pages/PluginManagerPage";
import { RecentPage } from "../pages/RecentPage";
import { RunningPage } from "../pages/RunningPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ToolsPage } from "../pages/ToolsPage";
import { WidgetsPage } from "../pages/WidgetsPage";

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: NotFoundPage,
  errorComponent: ({ error }) => (
    <section role="alert">
      <h1>启动器页面发生错误</h1>
      <p>{error.message}</p>
    </section>
  ),
});

const routes = [
  createRoute({ getParentRoute: () => rootRoute, path: "/", component: OverviewPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/tools", component: ToolsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/favorites", component: FavoritesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/recent", component: RecentPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/running", component: RunningPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/plugins", component: PluginManagerPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/widgets", component: WidgetsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/diagnostics", component: DiagnosticsPage }),
] as const;

const pluginPageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plugin/$pluginId/$pageId",
  component: () => {
    const { pluginId, pageId } = pluginPageRoute.useParams();
    return <PluginPageHost pluginId={pluginId} pageId={pageId} />;
  },
});

const routeTree = rootRoute.addChildren([...routes, pluginPageRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
