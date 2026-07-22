import type { Release, SchedulerRegistration, SchedulerService } from "@tool-center/plugin-contract";

import type { ResourceLedger } from "./resource-ledger";

export interface SchedulerDiagnostics {
  readonly activeRegistrations: number;
  readonly registrations: readonly {
    ownerId: string;
    id: string;
    intervalMs: number;
    running: boolean;
    failures: number;
  }[];
}

interface ScheduledEntry {
  readonly ownerId: string;
  readonly registration: SchedulerRegistration;
  timer?: ReturnType<typeof setTimeout>;
  running: boolean;
  released: boolean;
  failures: number;
}

const minimumIntervalMs = 250;
const failureLimit = 3;

export class SharedScheduler {
  readonly #entries = new Map<string, ScheduledEntry>();

  createService(ownerId: string, ledger: ResourceLedger): SchedulerService {
    return {
      register: (registration) => this.register(ownerId, registration, ledger),
    };
  }

  diagnostics(): SchedulerDiagnostics {
    return {
      activeRegistrations: this.#entries.size,
      registrations: [...this.#entries.values()].map((entry) => ({
        ownerId: entry.ownerId,
        id: entry.registration.id,
        intervalMs: entry.registration.intervalMs,
        running: entry.running,
        failures: entry.failures,
      })),
    };
  }

  private register(
    ownerId: string,
    registration: SchedulerRegistration,
    ledger: ResourceLedger,
  ): Release {
    if (registration.intervalMs < minimumIntervalMs) {
      throw new Error(`Scheduler interval must be at least ${minimumIntervalMs} ms.`);
    }

    const key = `${ownerId}:${registration.id}`;
    if (this.#entries.has(key)) {
      throw new Error(`Scheduler registration "${registration.id}" already exists for ${ownerId}.`);
    }

    const entry: ScheduledEntry = {
      ownerId,
      registration,
      running: false,
      released: false,
      failures: 0,
    };
    this.#entries.set(key, entry);

    const scheduleNext = () => {
      if (entry.released || entry.failures >= failureLimit) {
        return;
      }
      entry.timer = setTimeout(run, registration.intervalMs);
    };

    const run = async () => {
      if (entry.released) {
        return;
      }
      if (!registration.runWhenHidden && typeof document !== "undefined" && document.hidden) {
        scheduleNext();
        return;
      }

      entry.running = true;
      try {
        await registration.callback();
        entry.failures = 0;
      } catch {
        entry.failures += 1;
      } finally {
        entry.running = false;
        scheduleNext();
      }
    };

    const release = () => {
      entry.released = true;
      if (entry.timer !== undefined) {
        clearTimeout(entry.timer);
      }
      this.#entries.delete(key);
      ledger.forget(release);
    };

    scheduleNext();
    return ledger.track(release);
  }
}

