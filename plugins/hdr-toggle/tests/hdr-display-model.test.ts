import type { DisplayService, DisplaySummary } from "@tool-center/plugin-contract";
import { describe, expect, it, vi } from "vitest";

import {
  displaySelectionStorageKey,
  displaySourceLabel,
  hdrStatusLabel,
  resolveDisplaySelection,
  setHdrAndReload,
  sortDisplays,
} from "../src/hdr-display-model";

const primary: DisplaySummary = {
  id: "primary",
  name: "HDR 主屏",
  sourceName: "\\\\.\\DISPLAY1",
  primary: true,
  hdrSupported: true,
  hdrEnabled: false,
};

const secondary: DisplaySummary = {
  id: "secondary",
  name: "HDR 副屏",
  sourceName: "\\\\.\\DISPLAY2",
  primary: false,
  hdrSupported: true,
  hdrEnabled: false,
};

describe("HDR display model", () => {
  it("uses a Rust storage-compatible key for each widget instance", () => {
    const key = displaySelectionStorageKey("w123");

    expect(key).toBe("widget-w123-display-id");
    expect(key).toMatch(/^[a-zA-Z0-9._-]+$/);
  });

  it("keeps the primary display first", () => {
    expect(sortDisplays([secondary, primary]).map((display) => display.id)).toEqual([
      "primary",
      "secondary",
    ]);
  });

  it("uses the primary display only when no stored selection exists", () => {
    expect(resolveDisplaySelection([secondary, primary], null)).toEqual({
      selectedId: "primary",
      stale: false,
    });
    expect(resolveDisplaySelection([secondary, primary], "secondary")).toEqual({
      selectedId: "secondary",
      stale: false,
    });
  });

  it("does not silently replace a stale stored display", () => {
    expect(resolveDisplaySelection([primary, secondary], "disconnected")).toEqual({
      selectedId: null,
      stale: true,
    });
  });

  it("sets one opaque target and reloads the real state", async () => {
    const display: DisplayService = {
      listDisplays: vi.fn(async () => [{ ...secondary, hdrEnabled: true }, primary]),
      setHdrEnabled: vi.fn(async () => undefined),
    };

    const result = await setHdrAndReload(display, "secondary", true);

    expect(display.setHdrEnabled).toHaveBeenCalledWith("secondary", true);
    expect(display.listDisplays).toHaveBeenCalledOnce();
    expect(result.selected.hdrEnabled).toBe(true);
  });

  it("rejects missing or mismatched refreshed targets", async () => {
    const missing: DisplayService = {
      listDisplays: vi.fn(async () => [primary]),
      setHdrEnabled: vi.fn(async () => undefined),
    };
    const mismatched: DisplayService = {
      listDisplays: vi.fn(async () => [secondary]),
      setHdrEnabled: vi.fn(async () => undefined),
    };

    await expect(setHdrAndReload(missing, "secondary", true)).rejects.toThrow(
      "所选显示器已断开",
    );
    await expect(setHdrAndReload(mismatched, "secondary", true)).rejects.toThrow(
      "HDR 状态与请求不一致",
    );
  });

  it("uses text labels in addition to color", () => {
    expect(hdrStatusLabel(primary)).toBe("HDR 已关闭");
    expect(hdrStatusLabel({ ...primary, hdrEnabled: true })).toBe("HDR 已开启");
    expect(hdrStatusLabel({ ...primary, hdrSupported: false })).toBe("不支持 HDR");
    expect(displaySourceLabel(primary)).toBe("主显示器 · DISPLAY1");
  });
});
