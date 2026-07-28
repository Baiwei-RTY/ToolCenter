import type {
  AudioDefaultRole,
  AudioDeviceChange,
  AudioDeviceKind,
  AudioDeviceSummary,
  CommandService,
  DisplaySummary,
  HostCommand,
  LoggerService,
  PermissionDecision,
  PluginContext,
  Release,
  SystemSummary,
  UiNotification,
} from "@tool-center/plugin-contract";

import type { HostBridge } from "./bridge";
import { SharedEventBus } from "./event-bus";
import { ResourceLedger } from "./resource-ledger";
import { SharedScheduler } from "./scheduler";

export interface PermissionPromptRequest {
  readonly pluginId: string;
  readonly permission: string;
  readonly reason: string;
}

export type PermissionPrompt = (request: PermissionPromptRequest) => Promise<PermissionDecision>;

export interface PluginContextHandle {
  readonly context: PluginContext;
  readonly ledger: ResourceLedger;
  dispose(): Promise<void>;
}

export interface PluginContextFactory {
  create(pluginId: string, ownerId: string): PluginContextHandle;
}

export interface HostContextOptions {
  readonly bridge: HostBridge;
  readonly scheduler?: SharedScheduler;
  readonly eventBus?: SharedEventBus;
  readonly permissionPrompt?: PermissionPrompt;
  readonly commandHandlers?: Readonly<
    Record<string, (pluginId: string, payload: unknown) => Promise<unknown>>
  >;
  readonly notify?: (notification: UiNotification & { readonly pluginId: string }) => void;
  readonly confirm?: (options: {
    readonly title: string;
    readonly message: string;
    readonly dangerous?: boolean;
  }) => Promise<boolean>;
}

function unavailableService<T extends object>(name: string): T {
  return new Proxy(
    {},
    {
      get: () => async () => {
        throw new Error(`${name} is not available in the current host version.`);
      },
    },
  ) as T;
}

export function createPluginContextFactory(options: HostContextOptions): PluginContextFactory {
  const scheduler = options.scheduler ?? new SharedScheduler();
  const eventBus = options.eventBus ?? new SharedEventBus();

  return {
    create(pluginId: string, ownerId: string): PluginContextHandle {
      const ledger = new ResourceLedger();
      const bridge = options.bridge;

      const logger: LoggerService = {
        debug: (message, details) => writeLog(bridge, pluginId, "debug", message, details),
        info: (message, details) => writeLog(bridge, pluginId, "info", message, details),
        warn: (message, details) => writeLog(bridge, pluginId, "warn", message, details),
        error: (message, details) => writeLog(bridge, pluginId, "error", message, details),
      };

      const commands: CommandService = {
        async execute<TResult>(command: HostCommand<TResult>): Promise<TResult> {
          const handler = options.commandHandlers?.[command.id];
          if (handler === undefined) {
            throw new Error(`Plugin command "${command.id}" is not registered by the host.`);
          }
          return (await handler(pluginId, command.payload)) as TResult;
        },
      };

      const context: PluginContext = {
        pluginId,
        ui: {
          notify: (notification) => options.notify?.({ ...notification, pluginId }),
          confirm: async (confirmOptions) => options.confirm?.(confirmOptions) ?? false,
        },
        storage: {
          read: <T>(key: string) => bridge.invoke<T | null>("plugin_storage_read", { pluginId, key }),
          write: <T>(key: string, value: T) =>
            bridge.invoke<void>("plugin_storage_write", { pluginId, key, value }),
          remove: (key: string) =>
            bridge.invoke<void>("plugin_storage_remove", { pluginId, key }),
          list: () => bridge.invoke<readonly string[]>("plugin_storage_list", { pluginId }),
        },
        database: unavailableService("DatabaseService"),
        commands,
        scheduler: scheduler.createService(ownerId, ledger),
        events: eventBus.createService(ledger),
        clipboard: unavailableService("ClipboardService"),
        files: unavailableService("FileService"),
        dialogs: unavailableService("DialogService"),
        notifications: unavailableService("NotificationService"),
        hotkeys: unavailableService("HotkeyService"),
        audio: {
          listDevices: (kind?: AudioDeviceKind) =>
            bridge.invoke<readonly AudioDeviceSummary[]>("audio_devices_list", {
              pluginId,
              kind,
            }),
          getDefaultDevice: (kind: AudioDeviceKind, role?: AudioDefaultRole) =>
            bridge.invoke<AudioDeviceSummary | null>("audio_default_device_get", {
              pluginId,
              kind,
              role,
            }),
          subscribeDeviceChanges: async (
            listener: (change: AudioDeviceChange) => void,
          ) => {
            await bridge.invoke<void>("audio_device_changes_subscribe", { pluginId });
            const release = await bridge.listen<AudioDeviceChange>(
              "toolcenter://audio-device-change",
              listener,
            );
            return ledger.track(release);
          },
          setDefaultDevice: (
            deviceId: string,
            roles?: readonly AudioDefaultRole[],
          ) =>
            bridge.invoke<void>("audio_default_device_set", {
              pluginId,
              deviceId,
              roles: roles === undefined ? undefined : [...roles],
            }),
        },
        display: {
          listDisplays: () =>
            bridge.invoke<readonly DisplaySummary[]>("display_targets_list", { pluginId }),
          setHdrEnabled: (displayId: string, enabled: boolean) =>
            bridge.invoke<void>("display_hdr_set", {
              pluginId,
              displayId,
              enabled,
            }),
        },
        credentials: {
          set: (key, value) =>
            bridge.invoke<void>("plugin_credential_set", { pluginId, key, value }),
          has: (key) =>
            bridge.invoke<boolean>("plugin_credential_has", { pluginId, key }),
          remove: (key) =>
            bridge.invoke<void>("plugin_credential_remove", { pluginId, key }),
        },
        network: {
          getJson: <T>(request: {
            readonly url: string;
            readonly authorization?: {
              readonly credentialKey: string;
              readonly scheme: "apikey" | "Bearer";
            };
          }) =>
            bridge.invoke<T>("network_get_json", {
              pluginId,
              request,
            }),
        },
        system: {
          getSummary: () => bridge.invoke<SystemSummary>("diagnostics_get"),
        },
        tasks: unavailableService("TaskService"),
        permissions: {
          status: (permission) =>
            bridge.invoke<PermissionDecision>("permission_status", { pluginId, permission }),
          request: async (permission, reason) => {
            const current = await bridge.invoke<PermissionDecision>("permission_status", {
              pluginId,
              permission,
            });
            if (current !== "prompt") {
              return current;
            }

            const decision =
              (await options.permissionPrompt?.({ pluginId, permission, reason })) ?? "denied";
            await bridge.invoke<void>("permission_set", { pluginId, permission, decision });
            return decision;
          },
        },
        logger,
      };

      return {
        context,
        ledger,
        dispose: () => ledger.dispose(),
      };
    },
  };
}

async function writeLog(
  bridge: HostBridge,
  pluginId: string,
  level: string,
  message: string,
  details?: unknown,
): Promise<void> {
  await bridge.invoke<void>("log_write", { pluginId, level, message, details });
}

export function trackRelease(ledger: ResourceLedger, release: Release): Release {
  return ledger.track(release);
}
