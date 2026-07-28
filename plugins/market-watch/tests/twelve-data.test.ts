import { describe, expect, it } from "vitest";

import { createDefaultSettings } from "../src/market-model";
import {
  buildTimeSeriesUrl,
  MarketDataError,
  parseTimeSeriesResponse,
  supportsPublicDemo,
} from "../src/twelve-data";

const instrument = createDefaultSettings().instruments[0]!;

describe("Twelve Data request builder", () => {
  it("uses bounded output sizes and an HTTPS endpoint for every range", () => {
    expect(buildTimeSeriesUrl("AAPL", "1d")).toContain(
      "https://api.twelvedata.com/time_series?",
    );
    expect(buildTimeSeriesUrl("AAPL", "1d")).toContain("interval=1min");
    expect(buildTimeSeriesUrl("AAPL", "1d")).toContain("outputsize=390");
    expect(buildTimeSeriesUrl("AAPL", "5d")).toContain("interval=15min");
    expect(buildTimeSeriesUrl("AAPL", "1m")).toContain("interval=1day");
    expect(buildTimeSeriesUrl("EUR/USD", "1d")).toContain("symbol=EUR%2FUSD");
    expect(buildTimeSeriesUrl("AAPL", "1d", true)).toContain("apikey=demo");
    expect(buildTimeSeriesUrl("AAPL", "1d")).not.toContain("apikey=");
  });

  it("limits the public demo fallback to provider-supported symbols", () => {
    expect(supportsPublicDemo("AAPL")).toBe(true);
    expect(supportsPublicDemo("EUR/USD")).toBe(true);
    expect(supportsPublicDemo("BTC/USD")).toBe(true);
    expect(supportsPublicDemo("MSFT")).toBe(false);
  });
});

describe("Twelve Data response parser", () => {
  it("sorts OHLC values, calculates change, and accepts provider currency", () => {
    const snapshot = parseTimeSeriesResponse(
      {
        meta: { currency: "usd" },
        values: [
          {
            datetime: "2026-07-24 10:00:00",
            open: "101",
            high: "103",
            low: "100",
            close: "102",
          },
          {
            datetime: "2026-07-24 09:30:00",
            open: "99",
            high: "101",
            low: "98",
            close: "100",
          },
        ],
      },
      instrument,
    );

    expect(snapshot.bars.map((bar) => bar.close)).toEqual([100, 102]);
    expect(snapshot.price).toBe(102);
    expect(snapshot.change).toBe(2);
    expect(snapshot.changePercent).toBe(2);
    expect(snapshot.instrument.currency).toBe("USD");
    expect(snapshot.statusLabel).toContain("Twelve Data");
  });

  it("rejects provider errors and malformed OHLC rows without echoing secrets", () => {
    expect(() =>
      parseTimeSeriesResponse(
        { status: "error", message: "API limit reached", values: [] },
        instrument,
      ),
    ).toThrowError(MarketDataError);
    expect(() =>
      parseTimeSeriesResponse(
        {
          values: [
            {
              datetime: "2026-07-24 10:00:00",
              open: "102",
              high: "99",
              low: "100",
              close: "101",
            },
          ],
        },
        instrument,
      ),
    ).toThrow("当前产品在所选时间范围内没有可显示的数据。");
  });

  it("maps authentication and rate-limit failures to actionable messages", () => {
    expect(() =>
      parseTimeSeriesResponse(
        { status: "error", code: 401, message: "apikey is invalid" },
        instrument,
      ),
    ).toThrow("API Key 无效");
    expect(() =>
      parseTimeSeriesResponse(
        { status: "error", code: 429, message: "rate limit reached" },
        instrument,
      ),
    ).toThrow("频率限制");
  });
});
