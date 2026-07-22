import { invoke } from "@tauri-apps/api/core";
import { isTauriHost } from "@tool-center/plugin-runtime";

export interface RecentItem {
  readonly id: string;
  readonly title: string;
  readonly kind: "plugin" | "page" | "action" | "setting";
  readonly pluginId?: string;
  readonly usedAt: string;
}

export interface LauncherSettings {
  readonly enabledPluginIds: readonly string[];
  readonly pluginOrder: readonly string[];
  readonly favoriteIds: readonly string[];
  readonly recentItems: readonly RecentItem[];
  readonly defaultRoute: string;
  readonly closeBehavior: "close" | "tray";
  readonly showTray: boolean;
  readonly restoreWindow: boolean;
  readonly theme: "system" | "light" | "dark";
  readonly reducedMotion: boolean;
  readonly density: "standard" | "compact";
}

const browserStorageKey = "toolcenter.launcher.settings.v1";

export const defaultSettings: LauncherSettings = {
  enabledPluginIds: [],
  pluginOrder: [],
  favoriteIds: [],
  recentItems: [],
  defaultRoute: "/",
  closeBehavior: "close",
  showTray: false,
  restoreWindow: true,
  theme: "system",
  reducedMotion: false,
  density: "standard",
};

export const settingsRepository = {
  async load(): Promise<LauncherSettings> {
    const value = isTauriHost()
      ? await invoke<unknown>("settings_load")
      : readBrowserSettings();
    return normalizeSettings(value);
  },

  async save(settings: LauncherSettings): Promise<void> {
    if (isTauriHost()) {
      await invoke("settings_save", { settings });
      return;
    }
    localStorage.setItem(browserStorageKey, JSON.stringify(settings));
  },
};

export function normalizeSettings(value: unknown): LauncherSettings {
  if (value === null || typeof value !== "object") {
    return defaultSettings;
  }
  const candidate = value as Partial<LauncherSettings>;
  return {
    enabledPluginIds: stringArray(candidate.enabledPluginIds),
    pluginOrder: stringArray(candidate.pluginOrder),
    favoriteIds: stringArray(candidate.favoriteIds),
    recentItems: normalizeRecentItems(candidate.recentItems),
    defaultRoute: typeof candidate.defaultRoute === "string" ? candidate.defaultRoute : "/",
    closeBehavior: candidate.closeBehavior === "tray" ? "tray" : "close",
    showTray: candidate.showTray === true,
    restoreWindow: candidate.restoreWindow !== false,
    theme:
      candidate.theme === "light" || candidate.theme === "dark" ? candidate.theme : "system",
    reducedMotion: candidate.reducedMotion === true,
    density: candidate.density === "compact" ? "compact" : "standard",
  };
}

function readBrowserSettings(): unknown {
  try {
    const stored = localStorage.getItem(browserStorageKey);
    return stored === null ? null : JSON.parse(stored);
  } catch {
    return null;
  }
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeRecentItems(value: unknown): readonly RecentItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (item): item is RecentItem =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as RecentItem).id === "string" &&
        typeof (item as RecentItem).title === "string" &&
        typeof (item as RecentItem).usedAt === "string" &&
        ["plugin", "page", "action", "setting"].includes((item as RecentItem).kind),
    )
    .slice(0, 50);
}
