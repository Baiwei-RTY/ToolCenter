import type { PluginContext } from "./services";

export interface PluginLifecycle {
  activate?(context: PluginContext): void | Promise<void>;
  suspend?(): void | Promise<void>;
  resume?(): void | Promise<void>;
  deactivate?(): void | Promise<void>;
  dispose?(): void | Promise<void>;
}

export type PluginRuntimeState =
  | "registered"
  | "loading"
  | "active"
  | "suspended"
  | "disposing"
  | "unloaded"
  | "loading-failed"
  | "runtime-failed"
  | "permission-denied"
  | "disabled"
  | "incompatible";

export interface PluginRuntimeSnapshot {
  readonly pluginId: string;
  readonly entrypoint: PluginEntrypointKind;
  readonly instanceId?: string;
  readonly state: PluginRuntimeState;
  readonly error?: string;
}

export type PluginEntrypointKind = "actions" | "widget" | "page" | "service";
