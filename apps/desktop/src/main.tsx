import { RouterProvider } from "@tanstack/react-router";
import type { WidgetDisplayMode, WidgetSize } from "@tool-center/plugin-contract";
import { isTauriHost } from "@tool-center/plugin-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "mdui/mdui.css";
import "mdui/components/button.js";
import "mdui/components/chip.js";
import "mdui/components/linear-progress.js";

import { router } from "./app/router";
import { WidgetHostSurface } from "./components/WidgetHostSurface";
import { pluginRegistry } from "./plugin-registry.generated";
import { pluginRuntime } from "./runtime/host";
import { notify } from "./services/notifications";
import { widgetService } from "./services/widgets";
import { useAppStore } from "./stores/app-store";
import "./styles/app.css";
import "./styles/material3.css";

async function start(): Promise<void> {
  const parameters = new URLSearchParams(window.location.search);
  if (parameters.get("surface") === "widget-host") {
    await startWidgetHost(parameters);
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

async function startWidgetHost(parameters: URLSearchParams): Promise<void> {
  const monitorId = parameters.get("monitorId");
  const displayMode = parameters.get("displayMode");
  if (!monitorId || !isWidgetDisplayMode(displayMode)) {
    throw new Error("Widget host parameters are invalid.");
  }
  document.documentElement.dataset.surface = "widget-host";
  await createBrowserPreviewWidget(parameters, monitorId, displayMode);
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element was not found.");
  }
  createRoot(rootElement).render(
    <WidgetHostSurface monitorId={monitorId} displayMode={displayMode} />,
  );
}

async function createBrowserPreviewWidget(
  parameters: URLSearchParams,
  monitorId: string,
  displayMode: WidgetDisplayMode,
): Promise<void> {
  if (!import.meta.env.DEV || isTauriHost()) {
    return;
  }
  const pluginId = parameters.get("previewPluginId");
  const widgetId = parameters.get("previewWidgetId");
  const size = parameters.get("previewSize");
  const width = Number(parameters.get("previewWidth"));
  const height = Number(parameters.get("previewHeight"));
  if (
    !pluginId ||
    !widgetId ||
    !isWidgetSize(size) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return;
  }
  await widgetService.create({
    pluginId,
    widgetId,
    size,
    visible: true,
    dimensions: { width, height },
    monitorId,
  });
  if (displayMode !== "desktop") {
    const [instance] = await widgetService.listForHost(monitorId, "desktop");
    if (instance) {
      await widgetService.update({ instanceId: instance.instanceId, displayMode });
    }
  }
}

function isWidgetDisplayMode(value: string | null): value is WidgetDisplayMode {
  return value === "desktop" || value === "always-on-top";
}

function isWidgetSize(value: string | null): value is WidgetSize {
  return value === "small" || value === "medium" || value === "wide";
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
