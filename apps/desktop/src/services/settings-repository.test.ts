import { describe, expect, it } from "vitest";

import {
  MATERIAL3_UI_REVISION,
  defaultSettings,
  migrateMaterial3Ui,
  normalizeSettings,
} from "./settings-repository";

describe("launcher settings Material 3 migration", () => {
  it("uses the Material 3 plugin center for a new installation", () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings);
    expect(defaultSettings).toMatchObject({
      uiRevision: MATERIAL3_UI_REVISION,
      defaultRoute: "/tools",
      theme: "light",
    });
  });

  it("migrates legacy presentation state without changing functional state", () => {
    const legacy = normalizeSettings({
      enabledPluginIds: ["toolcenter.audio-device-switcher"],
      pluginOrder: ["toolcenter.audio-device-switcher", "toolcenter.hdr-toggle"],
      favoriteIds: ["toolcenter.audio-device-switcher"],
      recentItems: [
        {
          id: "toolcenter.audio-device-switcher:page",
          title: "音频设备切换",
          kind: "page",
          usedAt: "2026-07-30T00:00:00.000Z",
        },
      ],
      defaultRoute: "/",
      closeBehavior: "tray",
      showTray: true,
      restoreWindow: false,
      theme: "system",
      reducedMotion: true,
      density: "compact",
    });
    const pluginIds = [
      "toolcenter.audio-device-switcher",
      "toolcenter.hdr-toggle",
      "toolcenter.market-watch",
    ];

    const migrated = migrateMaterial3Ui(legacy, pluginIds);

    expect(migrated).toMatchObject({
      uiRevision: MATERIAL3_UI_REVISION,
      enabledPluginIds: ["toolcenter.audio-device-switcher"],
      pluginOrder: pluginIds,
      favoriteIds: ["toolcenter.audio-device-switcher"],
      defaultRoute: "/tools",
      closeBehavior: "tray",
      showTray: true,
      restoreWindow: false,
      theme: "light",
      reducedMotion: true,
      density: "compact",
    });
    expect(migrated.recentItems).toEqual(legacy.recentItems);
  });

  it("preserves explicit route and theme choices and is idempotent", () => {
    const legacy = normalizeSettings({
      enabledPluginIds: ["toolcenter.hdr-toggle"],
      pluginOrder: ["toolcenter.hdr-toggle"],
      defaultRoute: "/favorites",
      theme: "dark",
    });
    const pluginIds = ["toolcenter.audio-device-switcher", "toolcenter.hdr-toggle"];

    const migrated = migrateMaterial3Ui(legacy, pluginIds);

    expect(migrated.defaultRoute).toBe("/favorites");
    expect(migrated.theme).toBe("dark");
    expect(migrateMaterial3Ui(migrated, pluginIds)).toBe(migrated);
  });
});
