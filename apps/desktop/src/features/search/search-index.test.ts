import type { PluginDefinition } from "@tool-center/plugin-contract";
import { describe, expect, it, vi } from "vitest";

import { buildSearchIndex, filterSearchIndex } from "./search-index";

describe("launcher search index", () => {
  it("indexes static manifest metadata without loading plugin code", () => {
    const loader = vi.fn();
    const plugin: PluginDefinition = {
      id: "toolcenter.audio",
      name: "Audio",
      description: "Audio controls",
      version: "1.0.0",
      minHostVersion: "0.1.0",
      category: "system",
      entrypoints: { page: loader },
      contributes: { pages: [{ id: "audio.main", title: "Audio page", route: "/audio" }] },
      permissions: [],
    };

    const index = buildSearchIndex([plugin]);

    expect(index.some((item) => item.id === "page:toolcenter.audio:audio.main")).toBe(true);
    expect(loader).not.toHaveBeenCalled();
  });

  it("prioritizes exact and prefix title matches", () => {
    const index = buildSearchIndex([]);
    expect(filterSearchIndex(index, "设置")[0]?.title).toBe("设置");
  });
});

