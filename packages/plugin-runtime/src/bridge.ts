import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Release } from "@tool-center/plugin-contract";

export interface HostBridge {
  invoke<TResult>(command: string, payload?: Record<string, unknown>): Promise<TResult>;
  listen<TPayload>(eventName: string, listener: (payload: TPayload) => void): Promise<Release>;
}

export function createTauriBridge(): HostBridge {
  return {
    invoke: <TResult>(command: string, payload?: Record<string, unknown>) =>
      invoke<TResult>(command, payload),
    listen: <TPayload>(eventName: string, listener: (payload: TPayload) => void) =>
      listen<TPayload>(eventName, (event) => listener(event.payload)),
  };
}

export function isTauriHost(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export class MemoryHostBridge implements HostBridge {
  readonly #storage = new Map<string, unknown>();
  readonly #permissions = new Map<string, string>();
  readonly #logs: unknown[] = [];
  readonly #eventListeners = new Map<string, Set<(payload: unknown) => void>>();

  emit<TPayload>(eventName: string, payload: TPayload): void {
    for (const listener of this.#eventListeners.get(eventName) ?? []) {
      listener(payload);
    }
  }

  async listen<TPayload>(
    eventName: string,
    listener: (payload: TPayload) => void,
  ): Promise<Release> {
    const listeners = this.#eventListeners.get(eventName) ?? new Set();
    const untypedListener = listener as (payload: unknown) => void;
    listeners.add(untypedListener);
    this.#eventListeners.set(eventName, listeners);
    return () => {
      listeners.delete(untypedListener);
      if (listeners.size === 0) {
        this.#eventListeners.delete(eventName);
      }
    };
  }

  async invoke<TResult>(command: string, payload: Record<string, unknown> = {}): Promise<TResult> {
    const pluginId = String(payload.pluginId ?? "");
    const key = String(payload.key ?? "");

    switch (command) {
      case "plugin_storage_read":
        return (this.#storage.get(`${pluginId}:${key}`) ?? null) as TResult;
      case "plugin_storage_write":
        this.#storage.set(`${pluginId}:${key}`, payload.value);
        return undefined as TResult;
      case "plugin_storage_remove":
        this.#storage.delete(`${pluginId}:${key}`);
        return undefined as TResult;
      case "plugin_storage_list":
        return [...this.#storage.keys()]
          .filter((entry) => entry.startsWith(`${pluginId}:`))
          .map((entry) => entry.slice(pluginId.length + 1)) as TResult;
      case "permission_status":
        return (this.#permissions.get(`${pluginId}:${String(payload.permission ?? "")}`) ??
          "prompt") as TResult;
      case "permission_set":
        this.#permissions.set(
          `${pluginId}:${String(payload.permission ?? "")}`,
          String(payload.decision ?? "denied"),
        );
        return undefined as TResult;
      case "permissions_list": {
        const grouped: Record<string, Record<string, string>> = {};
        for (const [entry, decision] of this.#permissions) {
          const separator = entry.indexOf(":");
          const currentPluginId = entry.slice(0, separator);
          const permission = entry.slice(separator + 1);
          grouped[currentPluginId] ??= {};
          grouped[currentPluginId][permission] = decision;
        }
        return grouped as TResult;
      }
      case "log_write":
        this.#logs.push(payload);
        return undefined as TResult;
      case "log_list":
        return this.#logs.slice(-Number(payload.limit ?? 200)).reverse() as TResult;
      case "diagnostics_get":
        return {
          platform: "browser",
          architecture: "unknown",
          appVersion: "0.1.0",
        } as TResult;
      case "audio_devices_list":
        return [] as TResult;
      case "audio_default_device_get":
        return null as TResult;
      case "audio_device_changes_subscribe":
      case "audio_default_device_set":
        return undefined as TResult;
      default:
        throw new Error(`Host command "${command}" is not available in browser mode.`);
    }
  }
}
