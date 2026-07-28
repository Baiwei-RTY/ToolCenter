import { describe, expect, it } from "vitest";

import {
  buildBinanceFuturesUrl,
  parseBinanceFuturesResponse,
} from "../src/binance-futures";
import { createDefaultSettings } from "../src/market-model";
import { MarketDataError } from "../src/twelve-data";

const instrument = createDefaultSettings().instruments.find(
  (item) => item.kind === "futures",
)!;

describe("Binance futures request builder", () => {
  it("uses a public HTTPS endpoint with bounded ranges", () => {
    expect(buildBinanceFuturesUrl("BTCUSDT", "1d")).toBe(
      "https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=5m&limit=288",
    );
    expect(buildBinanceFuturesUrl("BTC/USDT", "5d")).toContain(
      "symbol=BTCUSDT&interval=1h&limit=120",
    );
    expect(buildBinanceFuturesUrl("BTC-USDT", "1m")).toContain(
      "interval=8h&limit=90",
    );
  });
});

describe("Binance futures response parser", () => {
  it("normalizes OHLC rows and calculates the visible-range change", () => {
    const snapshot = parseBinanceFuturesResponse(
      [
        [1_785_124_800_000, "100", "103", "99", "102", "10"],
        [1_785_125_700_000, "102", "106", "101", "105", "12"],
      ],
      instrument,
    );

    expect(snapshot.bars).toHaveLength(2);
    expect(snapshot.price).toBe(105);
    expect(snapshot.change).toBe(3);
    expect(snapshot.changePercent).toBeCloseTo((3 / 102) * 100);
    expect(snapshot.statusLabel).toContain("Binance USDⓈ-M");
  });

  it("rejects provider errors and malformed rows", () => {
    expect(() =>
      parseBinanceFuturesResponse(
        { code: -1121, msg: "Invalid symbol." },
        instrument,
      ),
    ).toThrowError(MarketDataError);
    expect(() =>
      parseBinanceFuturesResponse([[1, "100", "99", "101", "102"]], instrument),
    ).toThrow("当前期货产品在所选时间范围内没有可显示的数据。");
  });
});
