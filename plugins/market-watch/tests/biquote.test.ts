import { describe, expect, it } from "vitest";

import {
  buildBiQuoteOhlcUrl,
  parseBiQuoteOhlcResponse,
} from "../src/biquote";
import { canFetchWithoutCredential } from "../src/market-data";
import { createDefaultSettings } from "../src/market-model";
import { MarketDataError } from "../src/twelve-data";

const instrument = createDefaultSettings().instruments.find(
  (item) => item.symbol === "MSFT",
)!;

describe("BiQuote stock request builder", () => {
  it("uses the documented public OHLC endpoint with bounded ranges", () => {
    expect(buildBiQuoteOhlcUrl("MSFT", "1d")).toBe(
      "https://biquote.io/api/MSFT/ohlc?interval=5m&limit=96",
    );
    expect(buildBiQuoteOhlcUrl("brk.b", "5d")).toContain(
      "/BRK.B/ohlc?interval=30m&limit=80",
    );
    expect(buildBiQuoteOhlcUrl("MSFT", "1m")).toContain(
      "interval=1d&limit=32",
    );
  });

  it("makes stock instruments available without a Twelve Data credential", () => {
    expect(canFetchWithoutCredential(instrument)).toBe(true);
  });
});

describe("BiQuote stock response parser", () => {
  it("sorts OHLC bars and calculates visible-range change", () => {
    const snapshot = parseBiQuoteOhlcResponse(
      {
        bars: [
          {
            openTime: "2026-08-06T13:05:00Z",
            open: 102,
            high: 106,
            low: 101,
            close: 105,
          },
          {
            openTime: "2026-08-06T13:00:00Z",
            open: 100,
            high: 103,
            low: 99,
            close: 102,
          },
        ],
      },
      instrument,
    );

    expect(snapshot.bars.map((bar) => bar.close)).toEqual([102, 105]);
    expect(snapshot.price).toBe(105);
    expect(snapshot.change).toBe(3);
    expect(snapshot.changePercent).toBeCloseTo((3 / 102) * 100);
    expect(snapshot.statusLabel).toContain("BiQuote 免 Key");
  });

  it("rejects provider errors and malformed rows", () => {
    expect(() =>
      parseBiQuoteOhlcResponse({ message: "Symbol not found" }, instrument),
    ).toThrowError(MarketDataError);
    expect(() =>
      parseBiQuoteOhlcResponse(
        {
          bars: [
            {
              openTime: "2026-08-06T13:05:00Z",
              open: 105,
              high: 101,
              low: 102,
              close: 104,
            },
          ],
        },
        instrument,
      ),
    ).toThrow("当前股票在所选时间范围内没有可显示的数据。");
  });
});
