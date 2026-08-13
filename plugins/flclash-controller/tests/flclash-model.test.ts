import type {
  ProxyClientService,
  ProxyClientStatus,
  ProxyGroupSummary,
} from "@tool-center/plugin-contract";
import { describe, expect, it, vi } from "vitest";

import {
  proxyGroupStorageKey,
  proxyNodeOptionLabel,
  proxyStateLabel,
  resolveProxyGroupSelection,
  selectProxyAndReload,
  setProxyAndReload,
} from "../src/flclash-model";

const groups: readonly ProxyGroupSummary[] = [
  {
    name: "节点选择",
    selected: "香港 A",
    all: ["香港 A", "日本 B"],
    nodes: [
      { name: "香港 A", delayMs: 88, latencyStatus: "available" },
      { name: "日本 B", delayMs: null, latencyStatus: "unavailable" },
    ],
  },
  {
    name: "流媒体",
    selected: "自动选择",
    all: ["自动选择", "日本 B"],
    nodes: [
      { name: "自动选择", delayMs: null, latencyStatus: "automatic" },
      { name: "日本 B", delayMs: null, latencyStatus: "untested" },
    ],
  },
];

const connected: ProxyClientStatus = {
  controllerAvailable: true,
  version: "1.19.0",
  mode: "rule",
  mixedPort: 7890,
  proxyEnabled: false,
};

function service(overrides: Partial<ProxyClientService> = {}): ProxyClientService {
  return {
    getStatus: vi.fn(async () => connected),
    listGroups: vi.fn(async () => groups),
    selectProxy: vi.fn(async () => undefined),
    setProxyEnabled: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("FlClash widget model", () => {
  it("uses a separate Rust-compatible group key for each widget", () => {
    expect(proxyGroupStorageKey("w123")).toBe("widget-w123-proxy-group-v2");
    expect(proxyGroupStorageKey("w123")).toMatch(/^[a-zA-Z0-9._-]+$/);
  });

  it("restores an available group and repairs a stale selection", () => {
    expect(resolveProxyGroupSelection(groups, "流媒体", "rule")).toEqual({
      selectedGroupName: "流媒体",
      stale: false,
    });
    expect(resolveProxyGroupSelection(groups, "已删除", "rule")).toEqual({
      selectedGroupName: "节点选择",
      stale: true,
    });
    expect(resolveProxyGroupSelection([], null, "rule")).toEqual({
      selectedGroupName: null,
      stale: false,
    });
  });

  it("prefers the effective selector for the current FlClash mode", () => {
    const modeGroups: readonly ProxyGroupSummary[] = [
      {
        name: "GLOBAL",
        selected: "DIRECT",
        all: ["DIRECT", "香港 A"],
        nodes: [
          { name: "DIRECT", delayMs: null, latencyStatus: "direct" },
          { name: "香港 A", delayMs: 88, latencyStatus: "available" },
        ],
      },
      ...groups,
    ];
    expect(resolveProxyGroupSelection(modeGroups, null, "rule")).toEqual({
      selectedGroupName: "节点选择",
      stale: false,
    });
    expect(resolveProxyGroupSelection(modeGroups, null, "global")).toEqual({
      selectedGroupName: "GLOBAL",
      stale: false,
    });
  });

  it("labels the verified FlClash main proxy state", () => {
    expect(proxyStateLabel(connected)).toBe("代理已停止");
    expect(proxyStateLabel({ ...connected, proxyEnabled: true })).toBe("代理正在运行");
  });

  it("appends the latest FlClash latency state to node options", () => {
    expect(
      proxyNodeOptionLabel({ name: "日本 B", delayMs: 126.4, latencyStatus: "available" }),
    ).toBe("日本 B · 126 ms");
    expect(
      proxyNodeOptionLabel({ name: "新加坡 A", delayMs: null, latencyStatus: "unavailable" }),
    ).toBe("新加坡 A · 不可用");
    expect(
      proxyNodeOptionLabel({ name: "自动选择", delayMs: null, latencyStatus: "automatic" }),
    ).toBe("自动选择 · 自动");
    expect(
      proxyNodeOptionLabel({ name: "DIRECT", delayMs: null, latencyStatus: "direct" }),
    ).toBe("DIRECT · 直连");
    expect(
      proxyNodeOptionLabel({ name: "香港 A", delayMs: null, latencyStatus: "untested" }),
    ).toBe("香港 A · 未测速");
  });

  it("selects one verified node and reloads the real group state", async () => {
    const selectedGroups: readonly ProxyGroupSummary[] = groups.map((group) =>
      group.name === "节点选择" ? { ...group, selected: "日本 B" } : group,
    );
    const proxy = service({ listGroups: vi.fn(async () => selectedGroups) });

    const result = await selectProxyAndReload(proxy, "节点选择", "日本 B");

    expect(proxy.selectProxy).toHaveBeenCalledWith("节点选择", "日本 B");
    expect(result.selectedGroup.selected).toBe("日本 B");
  });

  it("rejects missing or mismatched state after a node switch", async () => {
    await expect(
      selectProxyAndReload(
        service({ listGroups: vi.fn(async () => groups.slice(1)) }),
        "节点选择",
        "日本 B",
      ),
    ).rejects.toThrow("代理组在切换后不可用");
    await expect(
      selectProxyAndReload(service(), "节点选择", "日本 B"),
    ).rejects.toThrow("节点状态与请求不一致");
  });

  it("verifies the FlClash main proxy state after control", async () => {
    const enabled = {
      ...connected,
      proxyEnabled: true,
    };
    const proxy = service({ getStatus: vi.fn(async () => enabled) });

    await expect(setProxyAndReload(proxy, true)).resolves.toEqual(enabled);
    expect(proxy.setProxyEnabled).toHaveBeenCalledWith(true);
    await expect(setProxyAndReload(service(), true)).rejects.toThrow(
      "主开关状态与请求不一致",
    );
  });
});
