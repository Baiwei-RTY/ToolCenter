import { describe, expect, it } from "vitest";

import {
  buildKrakenSpotUrl,
  normalizeKrakenPair,
  parseKrakenSpotResponse,
} from "../src/kraken-spot";
import { createDefaultSettings } from "../src/market-model";
import { MarketDataError } from "../src/twelve-data";

const instrument = createDefaultSettings().instruments.find(
  (item) => item.kind === "crypto",
)!;

describe("Kraken spot request builder", () => {
  it("uses the public OHLC endpoint and bounded intervals", () => {
    expect(buildKrakenSpotUrl("BTC/USD", "1d")).toBe(
      "https://api.kraken.com/0/public/OHLC?pair=BTC%2FUSD&assetVersion=1&interval=5",
    );
    expect(buildKrakenSpotUrl("ETH-USD", "5d")).toContain(
      "pair=ETH%2FUSD&assetVersion=1&interval=15",
    );
    expect(buildKrakenSpotUrl("SOLUSD", "1m")).toContain(
      "pair=SOL%2FUSD&assetVersion=1&interval=60",
    );
    expect(normalizeKrakenPair("XBT/USD")).toBe("BTC/USD");
  });
});

describe("Kraken spot response parser", () => {
  it("normalizes OHLC rows and calculates visible-range change", () => {
    const snapshot = parseKrakenSpotResponse(
      {
        error: [],
        result: {
          "BTC/USD": [
            [1_785_124_800, "100", "103", "99", "102", "101", "10", 20],
            [1_785_125_100, "102", "106", "101", "105", "104", "12", 24],
          ],
          last: 1_785_125_100,
        },
      },
      instrument,
      "1d",
    );

    expect(snapshot.bars).toHaveLength(2);
    expect(snapshot.price).toBe(105);
    expect(snapshot.change).toBe(3);
    expect(snapshot.changePercent).toBeCloseTo((3 / 102) * 100);
    expect(snapshot.instrument.currency).toBe("USD");
    expect(snapshot.statusLabel).toContain("Kraken 现货");
  });

  it("maps pair and rate-limit errors without leaking provider text", () => {
    expect(() =>
      parseKrakenSpotResponse(
        { error: ["EQuery:Unknown asset pair"], result: {} },
        instrument,
        "1d",
      ),
    ).toThrowError(MarketDataError);
    expect(() =>
      parseKrakenSpotResponse(
        { error: ["EAPI:Rate limit exceeded"], result: {} },
        instrument,
        "1d",
      ),
    ).toThrow("频率限制");
  });
});
