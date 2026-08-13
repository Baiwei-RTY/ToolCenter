import type { ComponentType, LazyExoticComponent } from "react";

import { PluginContractError } from "./errors";
import type { PluginLifecycle } from "./lifecycle";
import type { PluginContext, TaskSummary } from "./services";

export type KnownPermission =
  | "clipboard.read"
  | "clipboard.write"
  | "files.select"
  | "files.read-selected"
  | "files.write-selected"
  | "files.read-directory"
  | "files.write-directory"
  | "audio.read"
  | "audio.control"
  | "display.read"
  | "display.control"
  | "system.read-basic"
  | "system.monitor"
  | "system.process-read"
  | "system.process-control"
  | "network.request"
  | "proxy.read"
  | "proxy.control"
  | "notifications.show"
  | "hotkeys.register"
  | "background.run"
  | "window.detached"
  | "shell.open-safe"
  | "administrator.request";

export type PluginPermission = KnownPermission | (string & {});

export interface ActionResult {
  readonly success: boolean;
  readonly message?: string;
  readonly data?: unknown;
  readonly task?: TaskSummary;
}

export interface ToolAction {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly icon?: string;
  run(context: PluginContext, input?: unknown): Promise<ActionResult>;
}

export type WidgetSize = "small" | "medium" | "wide";

export type WidgetDisplayMode = "desktop" | "always-on-top";

export interface WidgetMinimumSize {
  readonly width: number;
  readonly height: number;
}

export interface WidgetInstanceProps {
  readonly instanceId: string;
  readonly visible: boolean;
  readonly size: WidgetSize;
  readonly locked: boolean;
}

export interface WidgetProps {
  readonly context: PluginContext;
  readonly widget: WidgetInstanceProps;
}

export interface WidgetDefinition {
  readonly id: string;
  readonly title: string;
  readonly supportedSizes: readonly WidgetSize[];
  readonly defaultSize: WidgetSize;
  readonly defaultVisible: boolean;
  readonly minimumSize: WidgetMinimumSize;
  readonly component: LazyExoticComponent<ComponentType<WidgetProps>>;
}

export interface PluginPageProps {
  readonly context: PluginContext;
}

export interface PluginPageDefinition {
  readonly id: string;
  readonly route: string;
  readonly title: string;
  readonly component: LazyExoticComponent<ComponentType<PluginPageProps>>;
}

export interface ServiceStatus {
  readonly state: "stopped" | "starting" | "running" | "failed";
  readonly startedAt?: string;
  readonly lastError?: string;
}

export interface BackgroundServiceDefinition {
  readonly id: string;
  readonly title: string;
  readonly defaultEnabled: false;
  start(context: PluginContext): Promise<void>;
  stop(): Promise<void>;
  status(): Promise<ServiceStatus>;
}

export interface EntrypointModuleBase {
  readonly lifecycle?: PluginLifecycle;
}

export interface ActionsEntrypointModule extends EntrypointModuleBase {
  readonly actions: readonly ToolAction[];
}

export interface WidgetEntrypointModule extends EntrypointModuleBase {
  readonly widgets: readonly WidgetDefinition[];
}

export interface PageEntrypointModule extends EntrypointModuleBase {
  readonly pages: readonly PluginPageDefinition[];
}

export interface ServiceEntrypointModule extends EntrypointModuleBase {
  readonly services: readonly BackgroundServiceDefinition[];
}

export type PluginEntrypointModule =
  | ActionsEntrypointModule
  | WidgetEntrypointModule
  | PageEntrypointModule
  | ServiceEntrypointModule;

export interface PluginEntrypoints {
  readonly actions?: () => Promise<ActionsEntrypointModule>;
  readonly widget?: () => Promise<WidgetEntrypointModule>;
  readonly page?: () => Promise<PageEntrypointModule>;
  readonly service?: () => Promise<ServiceEntrypointModule>;
}

export interface ActionContribution {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
}

export interface WidgetContribution {
  readonly id: string;
  readonly title: string;
  readonly supportedSizes: readonly WidgetSize[];
  readonly defaultSize: WidgetSize;
  readonly defaultVisible: boolean;
  readonly minimumSize: WidgetMinimumSize;
}

export interface PageContribution {
  readonly id: string;
  readonly title: string;
  readonly route: string;
}

export interface ServiceContribution {
  readonly id: string;
  readonly title: string;
}

export interface PluginContributions {
  readonly actions?: readonly ActionContribution[];
  readonly widgets?: readonly WidgetContribution[];
  readonly pages?: readonly PageContribution[];
  readonly services?: readonly ServiceContribution[];
}

export interface PluginDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: string;
  readonly icon?: string;
  readonly minHostVersion: string;
  readonly entrypoints: PluginEntrypoints;
  readonly contributes: PluginContributions;
  readonly permissions: readonly PluginPermission[];
  readonly background?: {
    readonly supported: boolean;
    readonly defaultEnabled: false;
  };
}

const pluginIdPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function definePlugin(definition: PluginDefinition): PluginDefinition {
  if (!pluginIdPattern.test(definition.id)) {
    throw new PluginContractError(
      "manifest.invalid-id",
      `Plugin id "${definition.id}" must be a stable, lowercase, dot- or dash-separated identifier.`,
    );
  }

  if (!versionPattern.test(definition.version) || !versionPattern.test(definition.minHostVersion)) {
    throw new PluginContractError(
      "manifest.invalid-version",
      `Plugin "${definition.id}" must use semantic versions for version and minHostVersion.`,
    );
  }

  if (definition.background !== undefined && definition.background.defaultEnabled !== false) {
    throw new PluginContractError(
      "manifest.background-default",
      `Plugin "${definition.id}" background services must be disabled by default.`,
    );
  }

  for (const widget of definition.contributes.widgets ?? []) {
    if (
      widget.supportedSizes.length === 0 ||
      !widget.supportedSizes.includes(widget.defaultSize)
    ) {
      throw new PluginContractError(
        "manifest.invalid-widget-sizes",
        `Widget "${widget.id}" must support its default size.`,
      );
    }
    if (
      !Number.isFinite(widget.minimumSize.width) ||
      !Number.isFinite(widget.minimumSize.height) ||
      widget.minimumSize.width <= 0 ||
      widget.minimumSize.height <= 0
    ) {
      throw new PluginContractError(
        "manifest.invalid-widget-minimum-size",
        `Widget "${widget.id}" must declare a positive finite minimum size.`,
      );
    }
  }

  return Object.freeze(definition);
}
