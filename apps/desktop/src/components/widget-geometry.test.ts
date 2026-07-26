import { describe, expect, it } from "vitest";

import {
  normalizedPositionForRect,
  resizeWidgetRect,
  widgetSizeForDimensions,
} from "./widget-geometry";

const bounds = {
  viewportWidth: 1920,
  viewportHeight: 1080,
  minimumWidth: 260,
  minimumHeight: 160,
  maximumWidth: 1600,
  maximumHeight: 1200,
};

describe("widget geometry", () => {
  it("resizes freely from the south-east corner", () => {
    expect(
      resizeWidgetRect(
        { left: 400, top: 200, width: 360, height: 220 },
        "se",
        120,
        80,
        bounds,
      ),
    ).toEqual({ left: 400, top: 200, width: 480, height: 300 });
  });

  it("keeps the opposite edges fixed while resizing north-west", () => {
    expect(
      resizeWidgetRect(
        { left: 400, top: 200, width: 360, height: 220 },
        "nw",
        -100,
        -50,
        bounds,
      ),
    ).toEqual({ left: 300, top: 150, width: 460, height: 270 });
  });

  it("enforces plugin minimums and monitor boundaries", () => {
    expect(
      resizeWidgetRect(
        { left: 20, top: 20, width: 360, height: 220 },
        "nw",
        500,
        500,
        bounds,
      ),
    ).toEqual({ left: 120, top: 80, width: 260, height: 160 });

    expect(
      resizeWidgetRect(
        { left: 1700, top: 900, width: 220, height: 180 },
        "se",
        500,
        500,
        { ...bounds, minimumWidth: 96, minimumHeight: 72 },
      ),
    ).toEqual({ left: 1700, top: 900, width: 220, height: 180 });
  });

  it("recalculates normalized position without moving the top-left corner", () => {
    expect(
      normalizedPositionForRect(
        { left: 400, top: 200, width: 520, height: 300 },
        1920,
        1080,
      ),
    ).toEqual({ x: 400 / 1400, y: 200 / 780 });
  });

  it("selects the nearest supported responsive layout", () => {
    const minimum = { width: 260, height: 160 };
    expect(
      widgetSizeForDimensions(
        { width: 300, height: 180 },
        ["small", "medium", "wide"],
        minimum,
        "medium",
      ),
    ).toBe("small");
    expect(
      widgetSizeForDimensions(
        { width: 640, height: 300 },
        ["small", "medium", "wide"],
        minimum,
        "medium",
      ),
    ).toBe("wide");
  });
});
