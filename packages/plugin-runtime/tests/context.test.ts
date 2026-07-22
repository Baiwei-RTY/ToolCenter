import type { AudioDeviceChange } from "@tool-center/plugin-contract";
import { describe, expect, it, vi } from "vitest";

import { createPluginContextFactory, MemoryHostBridge } from "../src";

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
