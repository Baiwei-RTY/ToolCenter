// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { shouldBeginWidgetDrag } from "./widget-drag";

describe("widget drag start", () => {
  it("allows primary-button dragging from the top bar and drag handle", () => {
    const topBar = document.createElement("div");
    const dragHandle = document.createElement("button");
    topBar.append(dragHandle);

    expect(shouldBeginWidgetDrag(false, 0, topBar)).toBe(true);
    expect(shouldBeginWidgetDrag(false, 0, dragHandle)).toBe(true);
  });

  it("does not start dragging from action buttons or their icons", () => {
    const action = document.createElement("button");
    const icon = document.createElement("span");
    action.dataset.widgetHostAction = "";
    action.append(icon);

    expect(shouldBeginWidgetDrag(false, 0, action)).toBe(false);
    expect(shouldBeginWidgetDrag(false, 0, icon)).toBe(false);
  });

  it("does not start dragging when locked or with a non-primary button", () => {
    const topBar = document.createElement("div");

    expect(shouldBeginWidgetDrag(true, 0, topBar)).toBe(false);
    expect(shouldBeginWidgetDrag(false, 2, topBar)).toBe(false);
  });
});
