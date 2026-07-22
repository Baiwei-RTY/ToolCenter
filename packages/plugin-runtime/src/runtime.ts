import type {
  ActionsEntrypointModule,
  PluginContext,
  PluginDefinition,
  PluginEntrypointKind,
  PluginEntrypointModule,
  PluginRuntimeSnapshot,
  ServiceEntrypointModule,
} from "@tool-center/plugin-contract";

import type { PluginContextFactory, PluginContextHandle } from "./context";

interface RuntimeInstance {
  readonly pluginId: string;
  readonly entrypoint: PluginEntrypointKind;
  readonly instanceId?: string;
  readonly contextHandle: PluginContextHandle;
  module?: PluginEntrypointModule;
  activation?: Promise<{
    readonly module: PluginEntrypointModule;
    readonly context: PluginContext;
  }>;
  snapshot: PluginRuntimeSnapshot;
}

type RuntimeListener = () => void;

export class PluginRuntime {
  readonly #registry: readonly PluginDefinition[];
  readonly #definitions: ReadonlyMap<string, PluginDefinition>;
  readonly #contextFactory: PluginContextFactory;
  readonly #instances = new Map<string, RuntimeInstance>();
  readonly #disabled = new Set<string>();
  readonly #listeners = new Set<RuntimeListener>();

  constructor(registry: readonly PluginDefinition[], contextFactory: PluginContextFactory) {
    this.#registry = registry;
    this.#definitions = new Map(registry.map((plugin) => [plugin.id, plugin]));
    this.#contextFactory = contextFactory;
  }

  get registry(): readonly PluginDefinition[] {
    return this.#registry;
  }

  subscribe(listener: RuntimeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  snapshots(): readonly PluginRuntimeSnapshot[] {
    return [...this.#instances.values()].map((instance) => instance.snapshot);
  }

  definition(pluginId: string): PluginDefinition {
    const definition = this.#definitions.get(pluginId);
    if (definition === undefined) {
      throw new Error(`Unknown plugin "${pluginId}".`);
    }
    return definition;
  }

  isEnabled(pluginId: string): boolean {
    this.definition(pluginId);
    return !this.#disabled.has(pluginId);
  }

  async setEnabled(pluginId: string, enabled: boolean): Promise<void> {
    this.definition(pluginId);
    if (enabled) {
      this.#disabled.delete(pluginId);
    } else {
      this.#disabled.add(pluginId);
      await this.disposePlugin(pluginId);
    }
    this.#emit();
  }

  async activate(
    pluginId: string,
    entrypoint: PluginEntrypointKind,
    instanceId?: string,
  ): Promise<{ readonly module: PluginEntrypointModule; readonly context: PluginContext }> {
    if (!this.isEnabled(pluginId)) {
      throw new Error(`Plugin "${pluginId}" is disabled.`);
    }

    const key = instanceKey(pluginId, entrypoint, instanceId);
    const existing = this.#instances.get(key);
    if (existing !== undefined) {
      if (existing.activation !== undefined) {
        return existing.activation;
      }
      if (existing.module !== undefined && existing.snapshot.state !== "loading-failed") {
        return { module: existing.module, context: existing.contextHandle.context };
      }
      this.#instances.delete(key);
    }

    const definition = this.definition(pluginId);
    const loader = getLoader(definition, entrypoint);
    if (loader === undefined) {
      throw new Error(`Plugin "${pluginId}" does not provide the ${entrypoint} entrypoint.`);
    }

    const contextHandle = this.#contextFactory.create(pluginId, key);
    const loadingSnapshot: PluginRuntimeSnapshot = {
      pluginId,
      entrypoint,
      instanceId,
      state: "loading",
    };
    const instance: RuntimeInstance = {
      pluginId,
      entrypoint,
      instanceId,
      contextHandle,
      snapshot: loadingSnapshot,
    };
    this.#instances.set(key, instance);
    this.#emit();

    const activation = (async () => {
      try {
        const module = await loader();
        await module.lifecycle?.activate?.(contextHandle.context);
        const activeInstance = this.#instances.get(key);
        if (activeInstance === undefined || activeInstance !== instance) {
          await Promise.resolve(module.lifecycle?.deactivate?.()).catch(() => undefined);
          await Promise.resolve(module.lifecycle?.dispose?.()).catch(() => undefined);
          throw new Error(`Plugin "${pluginId}" was disposed while loading.`);
        }
        activeInstance.module = module;
        activeInstance.activation = undefined;
        activeInstance.snapshot = { pluginId, entrypoint, instanceId, state: "active" };
        this.#emit();
        return { module, context: contextHandle.context };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failedInstance = this.#instances.get(key);
        if (failedInstance === instance) {
          failedInstance.activation = undefined;
          failedInstance.snapshot = {
            pluginId,
            entrypoint,
            instanceId,
            state: "loading-failed",
            error: message,
          };
        }
        await contextHandle.dispose().catch(() => undefined);
        this.#emit();
        throw error;
      }
    })();
    instance.activation = activation;
    return activation;
  }

  async suspend(
    pluginId: string,
    entrypoint: PluginEntrypointKind,
    instanceId?: string,
  ): Promise<void> {
    const instance = this.#instances.get(instanceKey(pluginId, entrypoint, instanceId));
    if (instance === undefined || instance.snapshot.state !== "active") {
      return;
    }
    await instance.module?.lifecycle?.suspend?.();
    instance.snapshot = { pluginId, entrypoint, instanceId, state: "suspended" };
    this.#emit();
  }

  async resume(
    pluginId: string,
    entrypoint: PluginEntrypointKind,
    instanceId?: string,
  ): Promise<void> {
    const instance = this.#instances.get(instanceKey(pluginId, entrypoint, instanceId));
    if (instance === undefined || instance.snapshot.state !== "suspended") {
      return;
    }
    await instance.module?.lifecycle?.resume?.();
    instance.snapshot = { pluginId, entrypoint, instanceId, state: "active" };
    this.#emit();
  }

  async deactivate(
    pluginId: string,
    entrypoint: PluginEntrypointKind,
    instanceId?: string,
  ): Promise<void> {
    const key = instanceKey(pluginId, entrypoint, instanceId);
    const instance = this.#instances.get(key);
    if (instance === undefined) {
      return;
    }

    instance.snapshot = { pluginId, entrypoint, instanceId, state: "disposing" };
    this.#emit();
    const failures: unknown[] = [];

    try {
      await instance.module?.lifecycle?.deactivate?.();
    } catch (error) {
      failures.push(error);
    }
    try {
      await instance.module?.lifecycle?.dispose?.();
    } catch (error) {
      failures.push(error);
    }
    try {
      await instance.contextHandle.dispose();
    } catch (error) {
      failures.push(error);
    }

    this.#instances.delete(key);
    this.#emit();
    if (failures.length > 0) {
      throw new AggregateError(failures, `Plugin "${pluginId}" failed to dispose cleanly.`);
    }
  }

  async runAction(pluginId: string, actionId: string, input?: unknown) {
    const active = await this.activate(pluginId, "actions");
    const module = active.module as ActionsEntrypointModule;
    const action = module.actions.find((candidate) => candidate.id === actionId);
    if (action === undefined) {
      await this.deactivate(pluginId, "actions");
      throw new Error(`Action "${actionId}" was not found in plugin "${pluginId}".`);
    }

    try {
      return await action.run(active.context, input);
    } finally {
      await this.deactivate(pluginId, "actions");
    }
  }

  async startService(pluginId: string, serviceId: string): Promise<void> {
    const active = await this.activate(pluginId, "service");
    const module = active.module as ServiceEntrypointModule;
    const service = module.services.find((candidate) => candidate.id === serviceId);
    if (service === undefined) {
      await this.deactivate(pluginId, "service");
      throw new Error(`Service "${serviceId}" was not found in plugin "${pluginId}".`);
    }
    try {
      await service.start(active.context);
    } catch (error) {
      await this.deactivate(pluginId, "service").catch(() => undefined);
      throw error;
    }
  }

  async stopService(pluginId: string, serviceId: string): Promise<void> {
    const instance = this.#instances.get(instanceKey(pluginId, "service"));
    if (instance === undefined) {
      return;
    }
    const module = instance.module as ServiceEntrypointModule | undefined;
    if (module === undefined) {
      await this.deactivate(pluginId, "service");
      return;
    }
    await module.services.find((candidate) => candidate.id === serviceId)?.stop();
    await this.deactivate(pluginId, "service");
  }

  async disposePlugin(pluginId: string): Promise<void> {
    const instances = [...this.#instances.values()]
      .filter((instance) => instance.pluginId === pluginId)
      .map((instance) => ({
        entrypoint: instance.entrypoint,
        instanceId: instance.instanceId,
      }));
    const results = await Promise.allSettled(
      instances.map(({ entrypoint, instanceId }) =>
        this.deactivate(pluginId, entrypoint, instanceId),
      ),
    );
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        `Plugin "${pluginId}" did not dispose cleanly.`,
      );
    }
  }

  #emit(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

function instanceKey(
  pluginId: string,
  entrypoint: PluginEntrypointKind,
  instanceId?: string,
): string {
  return instanceId === undefined
    ? `${pluginId}:${entrypoint}`
    : `${pluginId}:${entrypoint}:${instanceId}`;
}

function getLoader(
  definition: PluginDefinition,
  entrypoint: PluginEntrypointKind,
): (() => Promise<PluginEntrypointModule>) | undefined {
  const loader = definition.entrypoints[entrypoint];
  return loader as (() => Promise<PluginEntrypointModule>) | undefined;
}
