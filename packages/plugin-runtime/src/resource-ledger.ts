import type { Release } from "@tool-center/plugin-contract";

export class ResourceLedger {
  readonly #resources = new Set<Release>();
  #disposed = false;

  track<T extends Release>(release: T): T {
    if (this.#disposed) {
      void Promise.resolve(release()).catch(() => undefined);
      throw new Error("Cannot register a resource after its owner has been disposed.");
    }

    this.#resources.add(release);
    return release;
  }

  forget(release: Release): void {
    this.#resources.delete(release);
  }

  get size(): number {
    return this.#resources.size;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    const resources = [...this.#resources].reverse();
    this.#resources.clear();

    const results = await Promise.allSettled(resources.map(async (release) => release()));
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        "One or more plugin resources failed to release.",
      );
    }
  }
}
