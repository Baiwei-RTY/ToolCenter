// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../test-setup";
import { pluginRegistry } from "../plugin-registry.generated";
import { pluginRuntime } from "../runtime/host";
import { useAppStore } from "../stores/app-store";
import { ToolsPage } from "./ToolsPage";

const { push, execute } = vi.hoisted(() => ({
  push: vi.fn(async () => undefined),
  execute: vi.fn(async () => undefined),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ history: { push } }),
}));

vi.mock("../features/search/use-execute-search-item", () => ({
  useExecuteSearchItem: () => execute,
}));

beforeEach(() => {
  const pluginIds = pluginRegistry.map((plugin) => plugin.id);
  useAppStore.setState({
    initialized: true,
    enabledPluginIds: pluginIds,
    pluginOrder: pluginIds,
    favoriteIds: [],
    recentItems: [],
  });
  push.mockClear();
  execute.mockClear();
});

afterEach(async () => {
  cleanup();
  await Promise.all(pluginRegistry.map((plugin) => pluginRuntime.setEnabled(plugin.id, true)));
});

describe("ToolsPage", () => {
  it("renders registry data and filters page contributions", async () => {
    render(<ToolsPage />);

    expect(screen.getByRole("heading", { name: "工具" })).toBeInTheDocument();
    expect(screen.getByText("市场行情", { selector: ".plugin-center-hero__copy h2" }))
      .toBeInTheDocument();
    expect(document.querySelectorAll(".tool-row")).toHaveLength(pluginRegistry.length);

    fireEvent.click(screen.getByText("页面", { selector: "mdui-chip" }));

    expect(document.querySelectorAll(".tool-row")).toHaveLength(2);
    expect(screen.getByText("音频设备切换", { selector: ".tool-row__copy strong" }))
      .toBeInTheDocument();
    expect(screen.queryByText("番茄钟", { selector: ".tool-row__copy strong" }))
      .not.toBeInTheDocument();
  });

  it("selects a plugin and connects its enabled state to the app store", async () => {
    render(<ToolsPage />);

    const hdrRow = screen.getByText("HDR 开关", { selector: ".tool-row__copy strong" })
      .closest(".tool-row");
    expect(hdrRow).not.toBeNull();
    fireEvent.click(within(hdrRow as HTMLElement).getByRole("button"));

    expect(screen.getByText("HDR 开关", { selector: ".plugin-center-hero__copy h2" }))
      .toBeInTheDocument();

    fireEvent.click(within(hdrRow as HTMLElement).getByLabelText("停用HDR 开关"));

    await waitFor(() =>
      expect(useAppStore.getState().enabledPluginIds).not.toContain("toolcenter.hdr-toggle"),
    );
    expect(screen.getByText("已停用", { selector: ".plugin-enabled-badge" }))
      .toBeInTheDocument();
  });
});
