import { describe, expect, it, vi } from "vitest";

import { ResourceLedger } from "../src";

describe("ResourceLedger", () => {
  it("releases tracked resources once in reverse order", async () => {
    const calls: string[] = [];
    const ledger = new ResourceLedger();
    ledger.track(() => {
      calls.push("first");
    });
    ledger.track(() => {
      calls.push("second");
    });

    await ledger.dispose();
    await ledger.dispose();

    expect(calls).toEqual(["second", "first"]);
  });

  it("reports release failures after attempting all cleanup", async () => {
    const survivingRelease = vi.fn();
    const ledger = new ResourceLedger();
    ledger.track(() => {
      throw new Error("cleanup failed");
    });
    ledger.track(survivingRelease);

    await expect(ledger.dispose()).rejects.toBeInstanceOf(AggregateError);
    expect(survivingRelease).toHaveBeenCalledOnce();
  });
});
