import { describe, expect, it } from "vitest";

import {
  moveWidgetInstanceByOffset,
  reorderWidgetInstances,
} from "./widget-instance-order";

const instances = [
  { instanceId: "market" },
  { instanceId: "notes" },
  { instanceId: "timer" },
] as const;

describe("widget instance ordering", () => {
  it("moves an instance before or after the hovered target", () => {
    expect(reorderWidgetInstances(instances, "market", "timer").map(id)).toEqual([
      "notes",
      "market",
      "timer",
    ]);
    expect(reorderWidgetInstances(instances, "market", "timer", true).map(id)).toEqual([
      "notes",
      "timer",
      "market",
    ]);
  });

  it("supports keyboard movement without changing boundary items", () => {
    expect(moveWidgetInstanceByOffset(instances, "notes", -1).map(id)).toEqual([
      "notes",
      "market",
      "timer",
    ]);
    expect(moveWidgetInstanceByOffset(instances, "timer", 1)).toBe(instances);
  });
});

function id(instance: { readonly instanceId: string }): string {
  return instance.instanceId;
}
