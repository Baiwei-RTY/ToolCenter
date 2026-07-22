import type { EventService, Release } from "@tool-center/plugin-contract";

import type { ResourceLedger } from "./resource-ledger";

type Listener = (payload: unknown) => void;

export class SharedEventBus {
  readonly #listeners = new Map<string, Set<Listener>>();

  createService(ledger: ResourceLedger): EventService {
    return {
      emit: <T>(eventName: string, payload: T) => {
        for (const listener of this.#listeners.get(eventName) ?? []) {
          listener(payload);
        }
      },
      subscribe: <T>(eventName: string, listener: (payload: T) => void): Release => {
        const listeners = this.#listeners.get(eventName) ?? new Set<Listener>();
        const wrapped: Listener = (payload) => listener(payload as T);
        listeners.add(wrapped);
        this.#listeners.set(eventName, listeners);

        const release = () => {
          listeners.delete(wrapped);
          if (listeners.size === 0) {
            this.#listeners.delete(eventName);
          }
          ledger.forget(release);
        };

        return ledger.track(release);
      },
    };
  }
}

