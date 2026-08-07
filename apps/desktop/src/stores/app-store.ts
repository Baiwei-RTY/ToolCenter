import { create } from "zustand";

import type { LauncherSettings, RecentItem } from "../services/settings-repository";
import {
  defaultSettings,
  migrateMaterial3Ui,
  settingsRepository,
} from "../services/settings-repository";

interface AppStoreState extends LauncherSettings {
  initialized: boolean;
  searchOpen: boolean;
  commandPaletteOpen: boolean;
  initialize(pluginIds: readonly string[]): Promise<void>;
  setSearchOpen(open: boolean): void;
  setCommandPaletteOpen(open: boolean): void;
  setPluginEnabled(pluginId: string, enabled: boolean): void;
  movePlugin(pluginId: string, direction: "up" | "down"): void;
  toggleFavorite(id: string): void;
  addRecent(item: Omit<RecentItem, "usedAt">): void;
  removeRecent(id: string): void;
  clearRecent(): void;
  updateSettings(settings: Partial<LauncherSettings>): void;
}

let persistenceTimer: ReturnType<typeof setTimeout> | undefined;
let persistenceStarted = false;

export const useAppStore = create<AppStoreState>((set) => ({
  ...defaultSettings,
  initialized: false,
  searchOpen: false,
  commandPaletteOpen: false,

  async initialize(pluginIds) {
    const loaded = await settingsRepository.load();
    const isFirstRun = loaded.pluginOrder.length === 0 && loaded.enabledPluginIds.length === 0;
    const migrated = migrateMaterial3Ui(loaded, pluginIds);
    const enabledPluginIds =
      isFirstRun
        ? [...pluginIds]
        : migrated.enabledPluginIds.filter((id) => pluginIds.includes(id));
    const missingOrderIds = pluginIds.filter((id) => !migrated.pluginOrder.includes(id));
    const settings: LauncherSettings = {
      ...migrated,
      enabledPluginIds,
      pluginOrder: [
        ...migrated.pluginOrder.filter((id) => pluginIds.includes(id)),
        ...missingOrderIds,
      ],
    };
    set({
      ...settings,
      initialized: true,
    });
    await settingsRepository.save(settings);
    startPersistence();
  },

  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setPluginEnabled: (pluginId, enabled) =>
    set((state) => ({
      enabledPluginIds: enabled
        ? [...new Set([...state.enabledPluginIds, pluginId])]
        : state.enabledPluginIds.filter((id) => id !== pluginId),
    })),
  movePlugin: (pluginId, direction) =>
    set((state) => {
      const order = [...state.pluginOrder];
      const index = order.indexOf(pluginId);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= order.length) {
        return state;
      }
      [order[index], order[target]] = [order[target]!, order[index]!];
      return { pluginOrder: order };
    }),
  toggleFavorite: (id) =>
    set((state) => ({
      favoriteIds: state.favoriteIds.includes(id)
        ? state.favoriteIds.filter((candidate) => candidate !== id)
        : [...state.favoriteIds, id],
    })),
  addRecent: (item) =>
    set((state) => ({
      recentItems: [
        { ...item, usedAt: new Date().toISOString() },
        ...state.recentItems.filter((candidate) => candidate.id !== item.id),
      ].slice(0, 50),
    })),
  removeRecent: (id) =>
    set((state) => ({ recentItems: state.recentItems.filter((item) => item.id !== id) })),
  clearRecent: () => set({ recentItems: [] }),
  updateSettings: (settings) => set(settings),
}));

function startPersistence(): void {
  if (persistenceStarted) {
    return;
  }
  persistenceStarted = true;
  useAppStore.subscribe((state) => {
    if (!state.initialized) {
      return;
    }
    if (persistenceTimer !== undefined) {
      clearTimeout(persistenceTimer);
    }
    persistenceTimer = setTimeout(() => {
      void settingsRepository.save(selectPersistedSettings(useAppStore.getState()));
    }, 200);
  });
}

function selectPersistedSettings(state: AppStoreState): LauncherSettings {
  return {
    uiRevision: state.uiRevision,
    enabledPluginIds: state.enabledPluginIds,
    pluginOrder: state.pluginOrder,
    favoriteIds: state.favoriteIds,
    recentItems: state.recentItems,
    defaultRoute: state.defaultRoute,
    closeBehavior: state.closeBehavior,
    showTray: state.showTray,
    restoreWindow: state.restoreWindow,
    theme: state.theme,
    reducedMotion: state.reducedMotion,
    density: state.density,
  };
}
