import type {
  PluginContext,
  WidgetDefinition,
  WidgetDisplayMode,
  WidgetEntrypointModule,
} from "@tool-center/plugin-contract";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { pluginRuntime } from "../runtime/host";
import { notify } from "../services/notifications";
import {
  type NormalizedPosition,
  type WidgetInstance,
  type WidgetRegion,
  widgetService,
} from "../services/widgets";
import { Icon } from "./Icon";
import { PluginErrorBoundary } from "./PluginErrorBoundary";

const widgetEntrypointMounts = new Map<string, number>();

interface WidgetHostSurfaceProps {
  readonly monitorId: string;
  readonly displayMode: WidgetDisplayMode;
}

export function WidgetHostSurface({ monitorId, displayMode }: WidgetHostSurfaceProps) {
  const [instances, setInstances] = useState<readonly WidgetInstance[]>([]);
  const [regionsSuspended, setRegionsSuspended] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setInstances(await widgetService.listForHost(monitorId, displayMode));
  }, [displayMode, monitorId]);

  useEffect(() => {
    let disposed = false;
    let release: (() => void | Promise<void>) | undefined;
    void widgetService
      .listForHost(monitorId, displayMode)
      .then(setInstances)
      .catch(reportHostError);
    void widgetService.subscribeChanges(() => void refresh().catch(reportHostError)).then((next) => {
      if (disposed) {
        void next();
      } else {
        release = next;
      }
    });
    return () => {
      disposed = true;
      void release?.();
    };
  }, [displayMode, monitorId, refresh]);

  const updateRegions = useCallback(() => {
    if (regionsSuspended) {
      return;
    }
    const regions = collectInteractiveRegions(rootRef.current);
    void widgetService.setInteractiveRegions(regions).catch(reportHostError);
  }, [regionsSuspended]);

  useLayoutEffect(() => {
    if (regionsSuspended) {
      return;
    }
    if (!rootRef.current) {
      return;
    }
    let frame = requestAnimationFrame(updateRegions);
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateRegions);
    };
    const resizeObserver = new ResizeObserver(schedule);
    const mutationObserver = new MutationObserver(() => {
      for (const element of document.querySelectorAll("[data-toolcenter-widget-region]")) {
        resizeObserver.observe(element);
      }
      schedule();
    });
    resizeObserver.observe(rootRef.current);
    for (const element of document.querySelectorAll("[data-toolcenter-widget-region]")) {
      resizeObserver.observe(element);
    }
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [instances, regionsSuspended, updateRegions]);

  const setFullInteraction = useCallback(async (active: boolean) => {
    setRegionsSuspended(active);
    if (active) {
      await widgetService.setInteractiveRegions(null);
    }
  }, []);

  return (
    <div className="widget-host" ref={rootRef} data-display-mode={displayMode}>
      {instances.map((instance) => (
        <WidgetMount
          instance={instance}
          key={instance.instanceId}
          onChanged={refresh}
          onFullInteraction={setFullInteraction}
        />
      ))}
    </div>
  );
}

function WidgetMount({
  instance,
  onChanged,
  onFullInteraction,
}: {
  readonly instance: WidgetInstance;
  readonly onChanged: () => Promise<void>;
  readonly onFullInteraction: (active: boolean) => Promise<void>;
}) {
  const [activeWidget, setActiveWidget] = useState<{
    readonly definition: WidgetDefinition;
    readonly context: PluginContext;
  }>();
  const [loadError, setLoadError] = useState<string>();
  const [dragPosition, setDragPosition] = useState<NormalizedPosition | undefined>(undefined);
  const dragPositionRef = useRef<NormalizedPosition | undefined>(undefined);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    position: NormalizedPosition;
  } | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const mountKey = `${instance.pluginId}:${instance.widgetId}:${instance.instanceId}`;
    retainWidgetEntrypoint(mountKey);
    void pluginRuntime
      .activate(instance.pluginId, "widget", instance.instanceId)
      .then(({ module, context }) => {
        const widgetModule = module as WidgetEntrypointModule;
        const nextDefinition = widgetModule.widgets.find(
          (candidate) => candidate.id === instance.widgetId,
        );
        if (!nextDefinition) {
          throw new Error(
            `插件 ${instance.pluginId} 未提供小组件 ${instance.widgetId}。`,
          );
        }
        if (!cancelled) {
          setActiveWidget({ definition: nextDefinition, context });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      cancelled = true;
      releaseWidgetEntrypoint(mountKey, () =>
        pluginRuntime.deactivate(instance.pluginId, "widget", instance.instanceId),
      );
    };
  }, [instance.instanceId, instance.pluginId, instance.widgetId]);

  const position = dragPosition ?? instance.position;

  const width = Math.min(instance.dimensions.width, window.innerWidth);
  const height = Math.min(instance.dimensions.height, window.innerHeight);
  const style = {
    left: `${position.x * Math.max(0, window.innerWidth - width)}px`,
    top: `${position.y * Math.max(0, window.innerHeight - height)}px`,
    width: `${width}px`,
    height: `${height}px`,
  } satisfies CSSProperties;

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (instance.locked || event.button !== 0) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      position,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    void onFullInteraction(true).catch(reportHostError);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const availableWidth = Math.max(1, window.innerWidth - width);
    const availableHeight = Math.max(1, window.innerHeight - height);
    const nextPosition = {
      x: clamp(drag.position.x + (event.clientX - drag.startX) / availableWidth),
      y: clamp(drag.position.y + (event.clientY - drag.startY) / availableHeight),
    };
    dragPositionRef.current = nextPosition;
    setDragPosition(nextPosition);
  };

  const finishDrag = async (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = undefined;
    event.currentTarget.releasePointerCapture(event.pointerId);
    try {
      await widgetService.update({
        instanceId: instance.instanceId,
        position: dragPositionRef.current ?? instance.position,
      });
      await onChanged();
    } catch (error) {
      reportHostError(error);
    } finally {
      dragPositionRef.current = undefined;
      setDragPosition(undefined);
      await onFullInteraction(false).catch(reportHostError);
    }
  };

  const update = async (patch: Parameters<typeof widgetService.update>[0]) => {
    try {
      await widgetService.update(patch);
      await onChanged();
    } catch (error) {
      reportHostError(error);
    }
  };

  return (
    <section
      className="widget-host__instance"
      data-toolcenter-widget-region
      data-instance-id={instance.instanceId}
      style={style}
    >
      <div className="widget-host__controls">
        <button
          className="widget-host__drag"
          type="button"
          aria-label={instance.locked ? "小组件已锁定" : "拖动小组件"}
          disabled={instance.locked}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={(event) => void finishDrag(event)}
          onPointerCancel={(event) => void finishDrag(event)}
        >
          <Icon name="more" />
        </button>
        <button
          type="button"
          aria-label={instance.locked ? "解锁小组件" : "锁定小组件"}
          onClick={() =>
            void update({ instanceId: instance.instanceId, locked: !instance.locked })
          }
        >
          <Icon name="shield" />
        </button>
        <button
          type="button"
          aria-label="隐藏小组件"
          onClick={() => void update({ instanceId: instance.instanceId, visible: false })}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="widget-host__content">
        {loadError ? (
          <div className="widget-host__error" role="alert">
            <strong>小组件加载失败</strong>
            <span>{loadError}</span>
          </div>
        ) : activeWidget ? (
          <PluginErrorBoundary pluginId={instance.pluginId}>
            <activeWidget.definition.component
              context={activeWidget.context}
              widget={{
                instanceId: instance.instanceId,
                locked: instance.locked,
                size: instance.size,
                visible: instance.visible,
              }}
            />
          </PluginErrorBoundary>
        ) : (
          <div className="widget-host__loading" role="status">正在加载小组件…</div>
        )}
      </div>
    </section>
  );
}

function retainWidgetEntrypoint(mountKey: string): void {
  widgetEntrypointMounts.set(mountKey, (widgetEntrypointMounts.get(mountKey) ?? 0) + 1);
}

function releaseWidgetEntrypoint(mountKey: string, deactivate: () => Promise<void>): void {
  queueMicrotask(() => {
    const remaining = (widgetEntrypointMounts.get(mountKey) ?? 1) - 1;
    if (remaining > 0) {
      widgetEntrypointMounts.set(mountKey, remaining);
      return;
    }
    widgetEntrypointMounts.delete(mountKey);
    void deactivate().catch(reportHostError);
  });
}

function collectInteractiveRegions(root: HTMLDivElement | null): WidgetRegion[] {
  if (!root) {
    return [];
  }
  return [...document.querySelectorAll<HTMLElement>("[data-toolcenter-widget-region]")]
    .map((element) => element.getBoundingClientRect())
    .filter((rectangle) => rectangle.width > 0 && rectangle.height > 0)
    .map((rectangle) => ({
      x: rectangle.left,
      y: rectangle.top,
      width: rectangle.width,
      height: rectangle.height,
    }));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function reportHostError(error: unknown): void {
  notify({
    title: "桌面小组件宿主发生错误",
    message: error instanceof Error ? error.message : String(error),
    level: "error",
  });
}
