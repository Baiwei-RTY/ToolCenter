import { listen } from "@tauri-apps/api/event";
import type { WidgetDisplayMode, WidgetSize } from "@tool-center/plugin-contract";

import { hostBridge } from "../runtime/host";
import type { Release } from "@tool-center/plugin-contract";
import { isTauriHost } from "@tool-center/plugin-runtime";

export interface NormalizedPosition {
  readonly x: number;
  readonly y: number;
}

export interface WidgetDimensions {
  readonly width: number;
  readonly height: number;
}

export interface WidgetInstance {
  readonly instanceId: string;
  readonly pluginId: string;
  readonly widgetId: string;
  readonly size: WidgetSize;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly displayMode: WidgetDisplayMode;
  readonly monitorId: string;
  readonly position: NormalizedPosition;
  readonly lastValidPosition: NormalizedPosition;
  readonly dimensions: WidgetDimensions;
  readonly scaleFactor: number;
}

export interface WidgetMonitor {
  readonly id: string;
  readonly name: string;
  readonly primary: boolean;
  readonly scaleFactor: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CreateWidgetInstance {
  readonly pluginId: string;
  readonly widgetId: string;
  readonly size: WidgetSize;
  readonly visible: boolean;
  readonly dimensions: WidgetDimensions;
  readonly monitorId?: string;
}

export interface UpdateWidgetInstance {
  readonly instanceId: string;
  readonly size?: WidgetSize;
  readonly visible?: boolean;
  readonly locked?: boolean;
  readonly displayMode?: WidgetDisplayMode;
  readonly monitorId?: string;
  readonly position?: NormalizedPosition;
  readonly dimensions?: WidgetDimensions;
}

export interface WidgetRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const browserMonitor: WidgetMonitor = {
  id: "browser-primary",
  name: "浏览器预览",
  primary: true,
  scaleFactor: 1,
  x: 0,
  y: 0,
  width: typeof window === "undefined" ? 1280 : window.innerWidth,
  height: typeof window === "undefined" ? 720 : window.innerHeight,
};
let browserInstances: WidgetInstance[] = [];
const browserListeners = new Set<() => void>();

export const widgetService = {
  async list(): Promise<readonly WidgetInstance[]> {
    if (!isTauriHost()) {
      return browserInstances;
    }
    return hostBridge.invoke<readonly WidgetInstance[]>("widget_instances_list");
  },

  async listForHost(
    monitorId: string,
    displayMode: WidgetDisplayMode,
  ): Promise<readonly WidgetInstance[]> {
    if (!isTauriHost()) {
      return browserInstances.filter(
        (instance) =>
          instance.visible &&
          instance.monitorId === monitorId &&
          instance.displayMode === displayMode,
      );
    }
    return hostBridge.invoke<readonly WidgetInstance[]>("widget_host_instances", {
      query: { monitorId, displayMode },
    });
  },

  async monitors(): Promise<readonly WidgetMonitor[]> {
    if (!isTauriHost()) {
      return [{ ...browserMonitor, width: window.innerWidth, height: window.innerHeight }];
    }
    return hostBridge.invoke<readonly WidgetMonitor[]>("widget_monitors_list");
  },

  async create(input: CreateWidgetInstance): Promise<WidgetInstance> {
    if (!isTauriHost()) {
      const position = { x: 0.04 + browserInstances.length * 0.035, y: 0.04 };
      const instance: WidgetInstance = {
        instanceId: `browser-${Date.now()}-${browserInstances.length}`,
        pluginId: input.pluginId,
        widgetId: input.widgetId,
        size: input.size,
        visible: input.visible,
        locked: false,
        displayMode: "desktop",
        monitorId: input.monitorId ?? browserMonitor.id,
        position,
        lastValidPosition: position,
        dimensions: input.dimensions,
        scaleFactor: 1,
      };
      browserInstances = [...browserInstances, instance];
      emitBrowserChange();
      return instance;
    }
    return hostBridge.invoke<WidgetInstance>("widget_instance_create", { input });
  },

  async update(input: UpdateWidgetInstance): Promise<WidgetInstance> {
    if (!isTauriHost()) {
      const index = browserInstances.findIndex(
        (instance) => instance.instanceId === input.instanceId,
      );
      if (index < 0) {
        throw new Error("Widget instance was not found.");
      }
      const previous = browserInstances[index]!;
      const updated: WidgetInstance = {
        ...previous,
        ...input,
        lastValidPosition: input.position ?? previous.lastValidPosition,
      };
      browserInstances = browserInstances.map((instance, candidateIndex) =>
        candidateIndex === index ? updated : instance,
      );
      emitBrowserChange();
      return updated;
    }
    return hostBridge.invoke<WidgetInstance>("widget_instance_update", { input });
  },

  async reorder(instanceIds: readonly string[]): Promise<readonly WidgetInstance[]> {
    if (!isTauriHost()) {
      const byId = new Map(
        browserInstances.map((instance) => [instance.instanceId, instance] as const),
      );
      if (
        instanceIds.length !== browserInstances.length ||
        new Set(instanceIds).size !== browserInstances.length ||
        instanceIds.some((instanceId) => !byId.has(instanceId))
      ) {
        throw new Error("Widget instance order does not match the current instances.");
      }
      browserInstances = instanceIds.map((instanceId) => byId.get(instanceId)!);
      emitBrowserChange();
      return browserInstances;
    }
    return hostBridge.invoke<readonly WidgetInstance[]>("widget_instances_reorder", {
      instanceIds: [...instanceIds],
    });
  },

  async remove(instanceId: string): Promise<void> {
    if (!isTauriHost()) {
      browserInstances = browserInstances.filter(
        (instance) => instance.instanceId !== instanceId,
      );
      emitBrowserChange();
      return;
    }
    await hostBridge.invoke<void>("widget_instance_remove", { instanceId });
  },

  async resetPosition(instanceId: string): Promise<WidgetInstance> {
    if (!isTauriHost()) {
      return this.update({ instanceId, monitorId: browserMonitor.id, position: { x: 0.04, y: 0.04 } });
    }
    return hostBridge.invoke<WidgetInstance>("widget_instance_reset_position", { instanceId });
  },

  async syncHosts(enabledPluginIds: readonly string[]): Promise<void> {
    if (!isTauriHost()) {
      return;
    }
    await hostBridge.invoke<void>("widget_hosts_sync", {
      enabledPluginIds: [...enabledPluginIds],
    });
  },

  async setInteractiveRegions(regions: readonly WidgetRegion[] | null): Promise<void> {
    if (!isTauriHost()) {
      return;
    }
    await hostBridge.invoke<void>("widget_host_set_regions", {
      regions: regions === null ? null : [...regions],
    });
  },

  async subscribeChanges(listener: () => void): Promise<Release> {
    if (!isTauriHost()) {
      browserListeners.add(listener);
      return () => {
        browserListeners.delete(listener);
      };
    }
    return listen("toolcenter://widgets-changed", listener);
  },
};

function emitBrowserChange(): void {
  for (const listener of browserListeners) {
    listener();
  }
}
