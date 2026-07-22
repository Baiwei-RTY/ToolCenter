import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { router } from "./app/router";
import { pluginRegistry } from "./plugin-registry.generated";
import { pluginRuntime } from "./runtime/host";
import { notify } from "./services/notifications";
import { widgetService } from "./services/widgets";
import { useAppStore } from "./stores/app-store";
import "./styles/app.css";
import { WidgetHostSurface } from "./components/WidgetHostSurface";
import type { WidgetDisplayMode } from "@tool-center/plugin-contract";

async function start(): Promise<void> {
  const parameters = new URLSearchParams(window.location.search);
  if (parameters.get("surface") === "widget-host") {
    startWidgetHost(parameters);
    return;
  }

  await useAppStore.getState().initialize(pluginRegistry.map((plugin) => plugin.id));
  const enabledIds = useAppStore.getState().enabledPluginIds;
  await Promise.all(
    pluginRegistry
      .filter((plugin) => !enabledIds.includes(plugin.id))
      .map((plugin) => pluginRuntime.setEnabled(plugin.id, false)),
  );
  await widgetService.syncHosts(enabledIds);
  let previousEnabledIds = enabledIds;
  useAppStore.subscribe((state) => {
    if (state.enabledPluginIds === previousEnabledIds) {
      return;
    }
    previousEnabledIds = state.enabledPluginIds;
    void widgetService.syncHosts(state.enabledPluginIds).catch(reportStartError);
  });

  const defaultRoute = useAppStore.getState().defaultRoute;
  if (window.location.pathname === "/" && defaultRoute !== "/") {
    await router.history.replace(defaultRoute);
  }

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element was not found.");
  }
  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

function startWidgetHost(parameters: URLSearchParams): void {
  const monitorId = parameters.get("monitorId");
  const displayMode = parameters.get("displayMode");
  if (!monitorId || !isWidgetDisplayMode(displayMode)) {
    throw new Error("Widget host parameters are invalid.");
  }
  document.documentElement.dataset.surface = "widget-host";
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element was not found.");
  }
  createRoot(rootElement).render(
    <WidgetHostSurface monitorId={monitorId} displayMode={displayMode} />,
  );
}

function isWidgetDisplayMode(value: string | null): value is WidgetDisplayMode {
  return value === "desktop" || value === "always-on-top";
}

function reportStartError(error: unknown): void {
  notify({
    title: "桌面小组件宿主同步失败",
    message: error instanceof Error ? error.message : String(error),
    level: "error",
  });
}

void start().catch((error: unknown) => {
  notify({
    title: "启动器初始化失败",
    message: error instanceof Error ? error.message : String(error),
    level: "error",
  });
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.textContent = "启动器初始化失败，请查看日志。";
  }
});
