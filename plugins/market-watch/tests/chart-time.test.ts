import { describe, expect, it } from "vitest";

import {
  formatAxisTimestamp,
  resolveAxisTimestampMode,
} from "../src/chart-time";

describe("market chart time axis", () => {
  it("keeps the full multi-day view on date labels", () => {
    expect(
      resolveAxisTimestampMode(
        ["2026-08-03 09:30:00", "2026-08-07 15:30:00"],
        "5d",
        true,
      ),
    ).toBe("date");
  });

  it("shows clock time after zooming into one trading day", () => {
    const mode = resolveAxisTimestampMode(
      ["2026-08-06 09:30:00", "2026-08-06 10:00:00", "2026-08-06 15:30:00"],
      "5d",
      false,
    );

    expect(mode).toBe("time");
    expect(formatAxisTimestamp("2026-08-06 09:30:00", mode)).toBe("09:30");
  });

  it("shows both date and time when a detailed zoom crosses days", () => {
    const mode = resolveAxisTimestampMode(
      ["2026-08-06 09:30:00", "2026-08-06 10:00:00", "2026-08-07 09:30:00"],
      "5d",
      false,
    );

    expect(mode).toBe("date-time");
    expect(formatAxisTimestamp("2026-08-06 09:30:00", mode)).toBe("8/6 09:30");
  });

  it("does not invent intraday precision for daily candles", () => {
    expect(
      resolveAxisTimestampMode(
        ["2026-07-20 00:00:00", "2026-07-21 00:00:00", "2026-07-22 00:00:00"],
        "1m",
        false,
      ),
    ).toBe("date");
  });
});
