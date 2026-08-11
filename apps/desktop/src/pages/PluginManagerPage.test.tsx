// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../test-setup";
import { pluginRegistry } from "../plugin-registry.generated";
import { pluginRuntime } from "../runtime/host";
import { useAppStore } from "../stores/app-store";
import { PluginManagerPage } from "./PluginManagerPage";

beforeEach(() => {
  const pluginIds = pluginRegistry.map((plugin) => plugin.id);
  useAppStore.setState({
    initialized: true,
    enabledPluginIds: pluginIds.filter((id) => id !== "toolcenter.pomodoro-timer"),
    pluginOrder: pluginIds,
    favoriteIds: [],
    recentItems: [],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PluginManagerPage", () => {
  it("renders registry data and filters the installed plugin list", () => {
    render(<PluginManagerPage />);

    expect(screen.getByRole("heading", { name: "插件管理" })).toBeInTheDocument();
    expect(document.querySelectorAll(".plugin-manager-row")).toHaveLength(pluginRegistry.length);
    expect(document.querySelectorAll(".plugin-manager-row__icon")).toHaveLength(pluginRegistry.length);

    fireEvent.click(screen.getByRole("button", { name: "筛选插件" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "仅看已停用" }));

    expect(document.querySelectorAll(".plugin-manager-row")).toHaveLength(1);
    expect(screen.getByText("番茄钟", { selector: ".plugin-manager-row__copy strong" }))
      .toBeInTheDocument();

    fireEvent.input(screen.getByRole("searchbox", { name: "搜索插件" }), {
      target: { value: "不存在" },
    });
    expect(screen.getByText("没有匹配的插件")).toBeInTheDocument();
  });

  it("selects, toggles, reloads and switches detail tabs", async () => {
    const setEnabled = vi.spyOn(pluginRuntime, "setEnabled").mockResolvedValue(undefined);
    render(<PluginManagerPage />);

    const marketRow = screen
      .getByText("市场行情", { selector: ".plugin-manager-row__copy strong" })
      .closest(".plugin-manager-row");
    expect(marketRow).not.toBeNull();
    fireEvent.click(within(marketRow as HTMLElement).getByRole("button", { name: /市场行情/ }));

    expect(screen.getByText("市场行情", { selector: ".plugin-manager-title-line h2" }))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "权限" }));
    expect(screen.getByRole("heading", { name: "权限信息" })).toBeInTheDocument();

    fireEvent.click(within(marketRow as HTMLElement).getByLabelText("停用市场行情"));
    await waitFor(() => {
      expect(useAppStore.getState().enabledPluginIds).not.toContain("toolcenter.market-watch");
    });
    expect(setEnabled).toHaveBeenCalledWith("toolcenter.market-watch", false);

    fireEvent.click(within(marketRow as HTMLElement).getByLabelText("启用市场行情"));
    await waitFor(() => {
      expect(useAppStore.getState().enabledPluginIds).toContain("toolcenter.market-watch");
    });
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    await waitFor(() => {
      expect(setEnabled).toHaveBeenCalledWith("toolcenter.market-watch", true);
    });
  });
});
