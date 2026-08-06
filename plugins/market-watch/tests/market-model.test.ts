import { describe, expect, it } from "vitest";

import {
  createDefaultSettings,
  createDemoSnapshot,
  normalizeSettings,
  normalizeWidgetPreferences,
  widgetStorageKey,
} from "../src/market-model";

describe("market watch settings", () => {
  it("normalizes products, removes duplicates, and repairs an invalid default", () => {
    const settings = normalizeSettings({
      instruments: [
        { symbol: " aapl ", name: " 苹果 ", currency: "usd", kind: "stock" },
        { symbol: "AAPL", name: "重复", currency: "USD", kind: "stock" },
        { symbol: "../bad", name: "无效", currency: "USD", kind: "futures" },
        { symbol: "EUR/USD", name: "欧元美元", currency: "usd", kind: "forex" },
      ],
      defaultSymbol: "MISSING",
    });

    expect(settings.instruments).toEqual([
      { symbol: "AAPL", name: "苹果", currency: "USD", kind: "stock" },
      { symbol: "EUR/USD", name: "欧元美元", currency: "USD", kind: "forex" },
    ]);
    expect(settings.defaultSymbol).toBe("AAPL");
  });

  it("keeps each widget instance preference in a separate storage key", () => {
    expect(widgetStorageKey("first")).toBe("widget.first.v1");
    expect(widgetStorageKey("second")).toBe("widget.second.v1");
    expect(widgetStorageKey("first")).not.toBe(widgetStorageKey("second"));
  });

  it("repairs invalid widget preferences against the current products", () => {
    const settings = createDefaultSettings();
    expect(
      normalizeWidgetPreferences(
        { symbol: "MISSING", chartType: "unknown", range: "10y" },
        settings,
      ),
    ).toEqual({
      schemaVersion: 1,
      symbol: "AAPL",
      chartType: "line",
      range: "1d",
    });
  });
});

describe("market watch demo data", () => {
  it("is deterministic and ends at the selected reference quote", () => {
    const instrument = createDefaultSettings().instruments[0]!;
    const first = createDemoSnapshot(instrument, "1d");
    const second = createDemoSnapshot(instrument, "1d");

    expect(second).toEqual(first);
    expect(first.price).toBeCloseTo(213.87, 6);
    expect(first.change).toBeCloseTo(2.41, 6);
    expect(first.bars.length).toBe(260);
    expect(first.bars.every((bar) => bar.high >= bar.low)).toBe(true);
  });

  it("uses a different deterministic shape for each product and range", () => {
    const settings = createDefaultSettings();
    const apple = createDemoSnapshot(settings.instruments[0]!, "1d");
    const microsoft = createDemoSnapshot(settings.instruments[1]!, "1d");
    const appleFiveDays = createDemoSnapshot(settings.instruments[0]!, "5d");

    expect(microsoft.price).not.toBe(apple.price);
    expect(microsoft.change).toBeLessThan(0);
    expect(microsoft.bars.map((bar) => bar.close)).not.toEqual(
      apple.bars.map((bar) => bar.close),
    );
    expect(appleFiveDays.bars).toHaveLength(65);
    expect(appleFiveDays.bars.map((bar) => bar.close)).not.toEqual(
      apple.bars.map((bar) => bar.close),
    );
  });
});
