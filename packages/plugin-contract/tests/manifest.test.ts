import { describe, expect, it } from "vitest";

import { definePlugin, PluginContractError } from "../src";

describe("definePlugin", () => {
  it("accepts a side-effect-free plugin manifest", () => {
    const plugin = definePlugin({
      id: "toolcenter.example",
      name: "Example",
      description: "Test manifest",
      version: "1.0.0",
      category: "development",
      minHostVersion: "0.1.0",
      entrypoints: {},
      contributes: {},
      permissions: [],
    });

    expect(plugin.id).toBe("toolcenter.example");
    expect(Object.isFrozen(plugin)).toBe(true);
  });

  it("rejects unstable plugin ids", () => {
    expect(() =>
      definePlugin({
        id: "Bad Id",
        name: "Bad",
        description: "Invalid manifest",
        version: "1.0.0",
        category: "development",
        minHostVersion: "0.1.0",
        entrypoints: {},
        contributes: {},
        permissions: [],
      }),
    ).toThrow(PluginContractError);
  });

  it("rejects widget contributions whose default size is unsupported", () => {
    expect(() =>
      definePlugin({
        id: "toolcenter.bad-widget",
        name: "Bad widget",
        description: "Invalid widget manifest",
        version: "1.0.0",
        category: "development",
        minHostVersion: "0.1.0",
        entrypoints: {},
        contributes: {
          widgets: [
            {
              id: "example",
              title: "Example",
              supportedSizes: ["small"],
              defaultSize: "wide",
              defaultVisible: true,
              minimumSize: { width: 200, height: 120 },
            },
          ],
        },
        permissions: [],
      }),
    ).toThrow(PluginContractError);
  });
});
