import type {
  AudioDeviceChange,
  DisplaySummary,
  Release,
} from "@tool-center/plugin-contract";
import { describe, expect, it, vi } from "vitest";

import {
  createPluginContextFactory,
  MemoryHostBridge,
  type HostBridge,
} from "../src";

describe("PluginContext audio service", () => {
  it("releases native event listeners with the instance resource ledger", async () => {
    const bridge = new MemoryHostBridge();
    const handle = createPluginContextFactory({ bridge }).create(
      "toolcenter.audio-test",
      "toolcenter.audio-test:widget:one",
    );
    const listener = vi.fn();

    await handle.context.audio.subscribeDeviceChanges(listener);
    const change: AudioDeviceChange = {
      kind: "default-changed",
      deviceId: "opaque-device-id",
      deviceKind: "output",
      role: "multimedia",
    };
    bridge.emit("toolcenter://audio-device-change", change);
    expect(listener).toHaveBeenCalledOnce();

    await handle.dispose();
    bridge.emit("toolcenter://audio-device-change", change);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("PluginContext display service", () => {
  it("passes the current plugin id and opaque display id to the host", async () => {
    const display: DisplaySummary = {
      id: "opaque-display-id",
      name: "HDR display",
      sourceName: "\\\\.\\DISPLAY1",
      primary: true,
      hdrSupported: true,
      hdrEnabled: false,
    };
    const invoke = vi.fn();
    const bridge: HostBridge = {
      invoke: async <TResult>(
        command: string,
        payload?: Record<string, unknown>,
      ): Promise<TResult> => {
        invoke(command, payload);
        return (command === "display_targets_list" ? [display] : undefined) as TResult;
      },
      listen: async (): Promise<Release> => () => undefined,
    };
    const context = createPluginContextFactory({ bridge }).create(
      "toolcenter.display-test",
      "toolcenter.display-test:page",
    ).context;

    await expect(context.display.listDisplays()).resolves.toEqual([display]);
    await context.display.setHdrEnabled("opaque-display-id", true);

    expect(invoke).toHaveBeenNthCalledWith(1, "display_targets_list", {
      pluginId: "toolcenter.display-test",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "display_hdr_set", {
      pluginId: "toolcenter.display-test",
      displayId: "opaque-display-id",
      enabled: true,
    });
  });

  it("does not pretend HDR operations succeed in browser mode", async () => {
    const context = createPluginContextFactory({
      bridge: new MemoryHostBridge(),
    }).create("toolcenter.display-test", "toolcenter.display-test:widget:one").context;

    await expect(context.display.listDisplays()).rejects.toThrow(
      'Host command "display_targets_list" is not available in browser mode.',
    );
    await expect(
      context.display.setHdrEnabled("opaque-display-id", true),
    ).rejects.toThrow(
      'Host command "display_hdr_set" is not available in browser mode.',
    );
  });
});
