import type {
  AudioDeviceChange,
  DisplaySummary,
  ProxyClientStatus,
  ProxyGroupSummary,
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

describe("PluginContext credential and network services", () => {
  it("keeps browser credentials namespaced without exposing a read method", async () => {
    const bridge = new MemoryHostBridge();
    const first = createPluginContextFactory({ bridge }).create(
      "toolcenter.market-one",
      "toolcenter.market-one:page",
    ).context;
    const second = createPluginContextFactory({ bridge }).create(
      "toolcenter.market-two",
      "toolcenter.market-two:page",
    ).context;

    await first.credentials.set("provider-key", "secret-one");

    await expect(first.credentials.has("provider-key")).resolves.toBe(true);
    await expect(second.credentials.has("provider-key")).resolves.toBe(false);
    expect("read" in first.credentials).toBe(false);

    await first.credentials.remove("provider-key");
    await expect(first.credentials.has("provider-key")).resolves.toBe(false);
  });

  it("passes the plugin id and credential reference to the native network command", async () => {
    const invoke = vi.fn();
    const bridge: HostBridge = {
      invoke: async <TResult>(
        command: string,
        payload?: Record<string, unknown>,
      ): Promise<TResult> => {
        invoke(command, payload);
        return { values: [] } as TResult;
      },
      listen: async (): Promise<Release> => () => undefined,
    };
    const context = createPluginContextFactory({ bridge }).create(
      "toolcenter.market-watch",
      "toolcenter.market-watch:widget:one",
    ).context;
    const request = {
      url: "https://api.example.com/time_series?symbol=AAPL",
      authorization: {
        credentialKey: "provider-key",
        scheme: "apikey" as const,
      },
    };

    await context.network.getJson(request);

    expect(invoke).toHaveBeenCalledWith("network_get_json", {
      pluginId: "toolcenter.market-watch",
      request,
    });
  });

  it("does not perform real network requests in browser mode", async () => {
    const context = createPluginContextFactory({
      bridge: new MemoryHostBridge(),
    }).create("toolcenter.market-watch", "toolcenter.market-watch:widget:one").context;

    await expect(
      context.network.getJson({ url: "https://api.example.com/data" }),
    ).rejects.toThrow("NetworkService is not available in browser mode.");
  });
});

describe("PluginContext proxy client service", () => {
  it("passes the plugin id and proxy selection to the native host", async () => {
    const status: ProxyClientStatus = {
      controllerAvailable: true,
      version: "1.19.0",
      mode: "rule",
      mixedPort: 7890,
      proxyEnabled: false,
    };
    const groups: readonly ProxyGroupSummary[] = [
      {
        name: "节点选择",
        selected: "节点 A",
        all: ["节点 A", "节点 B"],
        nodes: [
          { name: "节点 A", delayMs: 86, latencyStatus: "available" },
          { name: "节点 B", delayMs: null, latencyStatus: "untested" },
        ],
      },
    ];
    const invoke = vi.fn();
    const bridge: HostBridge = {
      invoke: async <TResult>(
        command: string,
        payload?: Record<string, unknown>,
      ): Promise<TResult> => {
        invoke(command, payload);
        if (command === "proxy_client_status") return status as TResult;
        if (command === "proxy_groups_list") return groups as TResult;
        return undefined as TResult;
      },
      listen: async (): Promise<Release> => () => undefined,
    };
    const context = createPluginContextFactory({ bridge }).create(
      "toolcenter.flclash-controller",
      "toolcenter.flclash-controller:widget:one",
    ).context;

    await expect(context.proxyClient.getStatus()).resolves.toEqual(status);
    await expect(context.proxyClient.listGroups()).resolves.toEqual(groups);
    await context.proxyClient.selectProxy("节点选择", "节点 B");
    await context.proxyClient.setProxyEnabled(true);

    expect(invoke).toHaveBeenNthCalledWith(1, "proxy_client_status", {
      pluginId: "toolcenter.flclash-controller",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "proxy_groups_list", {
      pluginId: "toolcenter.flclash-controller",
    });
    expect(invoke).toHaveBeenNthCalledWith(3, "proxy_group_select", {
      pluginId: "toolcenter.flclash-controller",
      groupName: "节点选择",
      proxyName: "节点 B",
    });
    expect(invoke).toHaveBeenNthCalledWith(4, "proxy_client_set_enabled", {
      pluginId: "toolcenter.flclash-controller",
      enabled: true,
    });
  });

  it("exposes only an unavailable read state in browser mode", async () => {
    const context = createPluginContextFactory({
      bridge: new MemoryHostBridge(),
    }).create(
      "toolcenter.flclash-controller",
      "toolcenter.flclash-controller:widget:one",
    ).context;

    await expect(context.proxyClient.getStatus()).resolves.toEqual({
      controllerAvailable: false,
      version: null,
      mode: null,
      mixedPort: null,
      proxyEnabled: false,
    });
    await expect(context.proxyClient.listGroups()).resolves.toEqual([]);
    await expect(context.proxyClient.selectProxy("节点选择", "节点 A")).rejects.toThrow(
      "ProxyClientService control is not available in browser mode.",
    );
    await expect(context.proxyClient.setProxyEnabled(true)).rejects.toThrow(
      "ProxyClientService control is not available in browser mode.",
    );
  });
});
