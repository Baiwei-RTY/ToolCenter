import type { PluginDefinition } from "@tool-center/plugin-contract";
import { describe, expect, it, vi } from "vitest";

import {
  createPluginContextFactory,
  MemoryHostBridge,
  PluginRuntime,
  SharedScheduler,
} from "../src";

function createRuntime(definition: PluginDefinition): PluginRuntime {
  return new PluginRuntime(
    [definition],
    createPluginContextFactory({
      bridge: new MemoryHostBridge(),
      scheduler: new SharedScheduler(),
    }),
  );
}

describe("PluginRuntime", () => {
  it("does not load an action entrypoint before the action is invoked", async () => {
    const loader = vi.fn(async () => ({
      actions: [
        {
          id: "example.run",
          title: "Run",
          run: async () => ({ success: true }),
        },
      ],
    }));
    const runtime = createRuntime({
      id: "toolcenter.example",
      name: "Example",
      description: "Runtime fixture",
      version: "1.0.0",
      category: "development",
      minHostVersion: "0.1.0",
      entrypoints: { actions: loader },
      contributes: { actions: [{ id: "example.run", title: "Run" }] },
      permissions: [],
    });

    expect(loader).not.toHaveBeenCalled();
    await expect(runtime.runAction("toolcenter.example", "example.run")).resolves.toEqual({
      success: true,
    });
    expect(loader).toHaveBeenCalledOnce();
    expect(runtime.snapshots()).toEqual([]);
  });

  it("disposes active entrypoints when a plugin is disabled", async () => {
    const dispose = vi.fn();
    const runtime = createRuntime({
      id: "toolcenter.page-example",
      name: "Page example",
      description: "Runtime fixture",
      version: "1.0.0",
      category: "development",
      minHostVersion: "0.1.0",
      entrypoints: {
        page: async () => ({ pages: [], lifecycle: { dispose } }),
      },
      contributes: {},
      permissions: [],
    });

    await runtime.activate("toolcenter.page-example", "page");
    await runtime.setEnabled("toolcenter.page-example", false);

    expect(dispose).toHaveBeenCalledOnce();
    expect(runtime.isEnabled("toolcenter.page-example")).toBe(false);
  });

  it("shares an in-flight lazy load instead of loading the same entrypoint twice", async () => {
    let resolveLoader: ((value: { pages: [] }) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<{ pages: [] }>((resolve) => {
          resolveLoader = resolve;
        }),
    );
    const runtime = createRuntime({
      id: "toolcenter.lazy-page",
      name: "Lazy page",
      description: "Runtime fixture",
      version: "1.0.0",
      category: "development",
      minHostVersion: "0.1.0",
      entrypoints: { page: loader },
      contributes: {},
      permissions: [],
    });

    const first = runtime.activate("toolcenter.lazy-page", "page");
    const second = runtime.activate("toolcenter.lazy-page", "page");
    resolveLoader?.({ pages: [] });

    await expect(first).resolves.toBeDefined();
    await expect(second).resolves.toBeDefined();
    expect(loader).toHaveBeenCalledOnce();
  });

  it("isolates multiple widget instances and disposes each instance", async () => {
    const dispose = vi.fn();
    const runtime = createRuntime({
      id: "toolcenter.widgets",
      name: "Widget example",
      description: "Runtime fixture",
      version: "1.0.0",
      category: "development",
      minHostVersion: "0.1.0",
      entrypoints: {
        widget: async () => ({ widgets: [], lifecycle: { dispose } }),
      },
      contributes: {},
      permissions: [],
    });

    await runtime.activate("toolcenter.widgets", "widget", "instance-one");
    await runtime.activate("toolcenter.widgets", "widget", "instance-two");

    expect(runtime.snapshots()).toEqual([
      expect.objectContaining({ instanceId: "instance-one", state: "active" }),
      expect.objectContaining({ instanceId: "instance-two", state: "active" }),
    ]);

    await runtime.deactivate("toolcenter.widgets", "widget", "instance-one");
    expect(runtime.snapshots()).toEqual([
      expect.objectContaining({ instanceId: "instance-two", state: "active" }),
    ]);
    await runtime.setEnabled("toolcenter.widgets", false);
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(runtime.snapshots()).toEqual([]);
  });
});
