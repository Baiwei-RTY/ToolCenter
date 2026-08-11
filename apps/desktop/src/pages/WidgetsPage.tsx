import { useNavigate } from "@tanstack/react-router";
import type {
  PermissionDecision,
  PluginDefinition,
  WidgetContribution,
  WidgetSize,
} from "@tool-center/plugin-contract";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Icon, type IconName } from "../components/Icon";
import { Switch } from "../components/ui";
import { pluginRegistry } from "../plugin-registry.generated";
import { hostBridge } from "../runtime/host";
import { requestConfirmation } from "../services/confirmations";
import { notify } from "../services/notifications";
import {
  type WidgetInstance,
  type WidgetMonitor,
  widgetService,
} from "../services/widgets";
import { useAppStore } from "../stores/app-store";
import {
  moveWidgetInstanceByOffset,
  reorderWidgetInstances,
} from "./widget-instance-order";

interface WidgetCatalogItem {
  readonly plugin: PluginDefinition;
  readonly contribution: WidgetContribution;
}

interface DragTarget {
  readonly instanceId: string;
  readonly after: boolean;
}

export function WidgetsPage() {
  const navigate = useNavigate();
  const enabledPluginIds = useAppStore((state) => state.enabledPluginIds);
  const [instances, setInstances] = useState<readonly WidgetInstance[]>([]);
  const [monitors, setMonitors] = useState<readonly WidgetMonitor[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string>();
  const [busyInstanceId, setBusyInstanceId] = useState<string>();
  const [reordering, setReordering] = useState(false);
  const [draggingId, setDraggingId] = useState<string>();
  const [dragTarget, setDragTarget] = useState<DragTarget>();
  const pointerCleanupRef = useRef<(() => void) | undefined>(undefined);

  const catalog = useMemo(
    () =>
      pluginRegistry.flatMap((plugin) =>
        (plugin.contributes.widgets ?? []).map((contribution) => ({
          plugin,
          contribution,
        })),
      ),
    [],
  );
  const enabledCatalog = catalog.filter(({ plugin }) => enabledPluginIds.includes(plugin.id));
  const selectedCatalog =
    catalog.find((item) => catalogId(item) === selectedCatalogId) ??
    enabledCatalog[0] ??
    catalog[0];
  const filteredCatalog = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      return catalog;
    }
    return catalog.filter(({ plugin, contribution }) =>
      [
        plugin.name,
        plugin.description,
        plugin.category,
        contribution.title,
        widgetDescription(plugin.id, plugin.description),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [catalog, query]);
  const selectedInstance =
    instances.find((instance) => instance.instanceId === selectedInstanceId) ?? instances[0];

  const refresh = useCallback(async (): Promise<readonly WidgetInstance[]> => {
    const [nextInstances, nextMonitors] = await Promise.all([
      widgetService.list(),
      widgetService.monitors(),
    ]);
    setInstances(nextInstances);
    setMonitors(nextMonitors);
    return nextInstances;
  }, []);

  useEffect(() => {
    let disposed = false;
    let release: (() => void | Promise<void>) | undefined;
    queueMicrotask(() => {
      if (!disposed) {
        void refresh().catch(reportError);
      }
    });
    void widgetService.subscribeChanges(() => void refresh().catch(reportError)).then((next) => {
      if (disposed) {
        void next();
      } else {
        release = next;
      }
    });
    return () => {
      disposed = true;
      pointerCleanupRef.current?.();
      void release?.();
    };
  }, [refresh]);

  useEffect(() => {
    const closeMenu = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-widget-menu]")) {
        return;
      }
      setOpenMenuId(undefined);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(undefined);
      }
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  const addWidget = async (catalogItem = selectedCatalog) => {
    if (!catalogItem || !enabledPluginIds.includes(catalogItem.plugin.id)) {
      return;
    }
    try {
      await requestDeclaredPermissions(catalogItem.plugin);
      const created = await widgetService.create({
        pluginId: catalogItem.plugin.id,
        widgetId: catalogItem.contribution.id,
        size: catalogItem.contribution.defaultSize,
        visible: catalogItem.contribution.defaultVisible,
        dimensions: dimensionsFor(
          catalogItem.contribution.defaultSize,
          catalogItem.contribution.minimumSize,
        ),
      });
      await refresh();
      setSelectedInstanceId(created.instanceId);
      setSettingsExpanded(true);
      notify({
        title: "桌面小组件已添加",
        message: catalogItem.contribution.title,
        level: "success",
        pluginId: catalogItem.plugin.id,
      });
    } catch (error) {
      reportError(error);
    }
  };

  const updateInstance = async (
    instanceId: string,
    patch: Omit<Parameters<typeof widgetService.update>[0], "instanceId">,
  ) => {
    setBusyInstanceId(instanceId);
    try {
      await widgetService.update({ instanceId, ...patch });
      await refresh();
    } catch (error) {
      reportError(error);
    } finally {
      setBusyInstanceId(undefined);
    }
  };

  const removeInstance = async (instance: WidgetInstance) => {
    setOpenMenuId(undefined);
    const accepted = await requestConfirmation({
      title: "删除小组件实例？",
      message: "将从桌面移除此实例，插件本身及插件数据不会被删除。",
      confirmLabel: "删除实例",
      cancelLabel: "取消",
      tone: "danger",
    });
    if (!accepted) {
      return;
    }
    setBusyInstanceId(instance.instanceId);
    try {
      await widgetService.remove(instance.instanceId);
      const nextInstances = await refresh();
      if (selectedInstanceId === instance.instanceId) {
        setSelectedInstanceId(nextInstances[0]?.instanceId ?? "");
      }
    } catch (error) {
      reportError(error);
    } finally {
      setBusyInstanceId(undefined);
    }
  };

  const resetPosition = async (instance: WidgetInstance) => {
    setOpenMenuId(undefined);
    setBusyInstanceId(instance.instanceId);
    try {
      await widgetService.resetPosition(instance.instanceId);
      await refresh();
      notify({
        title: "小组件位置已重置",
        message: "实例已移回主显示器的默认位置。",
        level: "success",
        pluginId: instance.pluginId,
      });
    } catch (error) {
      reportError(error);
    } finally {
      setBusyInstanceId(undefined);
    }
  };

  const openSettings = async (pluginId: string) => {
    setOpenMenuId(undefined);
    const plugin = pluginRegistry.find((candidate) => candidate.id === pluginId);
    const page = plugin?.contributes.pages?.[0];
    if (!page) {
      notify({
        title: "该插件没有设置页面",
        message: "插件仍可通过小组件本身提供的控件完成操作。",
        level: "info",
        pluginId,
      });
      return;
    }
    await navigate({
      to: "/plugin/$pluginId/$pageId",
      params: { pluginId, pageId: page.id },
    });
  };

  const persistOrder = async (nextInstances: readonly WidgetInstance[]) => {
    if (nextInstances === instances || reordering) {
      return;
    }
    const previous = instances;
    setInstances(nextInstances);
    setReordering(true);
    try {
      const persisted = await widgetService.reorder(
        nextInstances.map((instance) => instance.instanceId),
      );
      setInstances(persisted);
      notify({
        title: "小组件顺序已更新",
        message: "新的管理顺序已经保存。",
        level: "success",
      });
    } catch (error) {
      setInstances(previous);
      reportError(error);
    } finally {
      setReordering(false);
    }
  };

  const beginPointerDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    instance: WidgetInstance,
  ) => {
    if (reordering || instances.length < 2) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    let currentTarget: DragTarget | undefined;
    setDraggingId(instance.instanceId);

    const cleanup = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
      pointerCleanupRef.current = undefined;
      setDraggingId(undefined);
      setDragTarget(undefined);
    };

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const row = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest<HTMLElement>("[data-widget-instance-id]");
      const targetId = row?.dataset.widgetInstanceId;
      if (!row || !targetId || targetId === instance.instanceId) {
        currentTarget = undefined;
        setDragTarget(undefined);
        return;
      }
      const bounds = row.getBoundingClientRect();
      currentTarget = {
        instanceId: targetId,
        after: moveEvent.clientY > bounds.top + bounds.height / 2,
      };
      setDragTarget(currentTarget);
    };

    const onPointerUp = () => {
      const finalTarget = currentTarget;
      cleanup();
      if (!finalTarget) {
        return;
      }
      void persistOrder(
        reorderWidgetInstances(
          instances,
          instance.instanceId,
          finalTarget.instanceId,
          finalTarget.after,
        ),
      );
    };

    const onPointerCancel = () => cleanup();

    handle.setPointerCapture(pointerId);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    pointerCleanupRef.current = cleanup;
  };

  const moveByKeyboard = (instanceId: string, offset: -1 | 1) => {
    void persistOrder(moveWidgetInstanceByOffset(instances, instanceId, offset));
  };

  return (
    <section className="page widgets-page" aria-label="桌面小组件管理">
      <aside className="widget-catalog-pane">
        <header className="widget-catalog-pane__header">
          <h1>可用小组件</h1>
        </header>

        <label className="widget-search-field">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            aria-label="搜索小组件"
            placeholder="搜索小组件"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="widget-catalog-cards" aria-label="小组件目录">
          {filteredCatalog.map((item) => {
            const id = catalogId(item);
            const enabled = enabledPluginIds.includes(item.plugin.id);
            const selected = id === catalogId(selectedCatalog ?? item);
            const instanceCount = instances.filter(
              (instance) =>
                instance.pluginId === item.plugin.id &&
                instance.widgetId === item.contribution.id,
            ).length;
            return (
              <button
                className={`widget-catalog-entry${selected ? " widget-catalog-entry--selected" : ""}`}
                type="button"
                key={id}
                aria-pressed={selected}
                onClick={() => {
                  setSelectedCatalogId(id);
                  const existingInstance = instances.find(
                    (instance) =>
                      instance.pluginId === item.plugin.id &&
                      instance.widgetId === item.contribution.id,
                  );
                  if (existingInstance) {
                    setSelectedInstanceId(existingInstance.instanceId);
                    setSettingsExpanded(true);
                  }
                }}
              >
                <span className="widget-entry-icon">
                  <Icon name={widgetIcon(item.plugin.id)} />
                </span>
                <span className="widget-entry-copy">
                  <strong>{item.contribution.title}</strong>
                  <small>{widgetDescription(item.plugin.id, item.plugin.description)}</small>
                </span>
                <span className="widget-entry-meta">
                  <span className={`widget-availability${enabled ? " widget-availability--enabled" : ""}`}>
                    {enabled ? "已启用" : "已禁用"}
                  </span>
                  {instanceCount > 0 ? <small>{instanceCount} 个实例</small> : null}
                </span>
              </button>
            );
          })}
          {filteredCatalog.length === 0 ? (
            <div className="widget-catalog-empty">
              <Icon name="search" />
              <span>没有匹配的小组件</span>
            </div>
          ) : null}
        </div>

        <footer className="widget-catalog-pane__footer">
          <p>
            {selectedCatalog
              ? enabledPluginIds.includes(selectedCatalog.plugin.id)
                ? `将添加“${selectedCatalog.contribution.title}”的新实例`
                : `请先启用“${selectedCatalog.plugin.name}”插件`
              : "当前没有可添加的小组件"}
          </p>
          <button
            className="button--primary widget-add-button"
            type="button"
            disabled={!selectedCatalog || !enabledPluginIds.includes(selectedCatalog.plugin.id)}
            onClick={() => void addWidget()}
          >
            <Icon name="add" /> 添加小组件
          </button>
        </footer>
      </aside>

      <div className="widget-desktop-pane">
        <header className="widget-desktop-pane__header">
          <div>
            <h1>我的桌面</h1>
            <p id="widget-reorder-help">拖动左侧手柄调整小组件顺序</p>
          </div>
          <span className="widget-instance-summary">
            已添加 {instances.length} 个小组件
            <Icon name="info" />
          </span>
        </header>

        {instances.length > 0 ? (
          <div className="widget-instance-rows" aria-busy={reordering}>
            {instances.map((instance) => {
              const entry = findCatalogItem(catalog, instance);
              const title = entry?.contribution.title ?? instance.widgetId;
              const description = entry
                ? widgetDescription(entry.plugin.id, entry.plugin.description)
                : instance.pluginId;
              const selected = instance.instanceId === selectedInstance?.instanceId;
              const disabled = !enabledPluginIds.includes(instance.pluginId);
              const busy = busyInstanceId === instance.instanceId || reordering;
              const isTarget = dragTarget?.instanceId === instance.instanceId;
              return (
                <article
                  className={[
                    "widget-instance-row",
                    selected ? "widget-instance-row--selected" : "",
                    draggingId === instance.instanceId ? "widget-instance-row--dragging" : "",
                    isTarget ? "widget-instance-row--target" : "",
                    isTarget && dragTarget.after ? "widget-instance-row--target-after" : "",
                  ].filter(Boolean).join(" ")}
                  key={instance.instanceId}
                  tabIndex={0}
                  aria-current={selected ? "true" : undefined}
                  aria-label={`${title}实例`}
                  aria-describedby="widget-reorder-help"
                  data-widget-instance-id={instance.instanceId}
                  onClick={() => {
                    setSelectedInstanceId(instance.instanceId);
                    setSettingsExpanded(true);
                  }}
                  onKeyDown={(event) => {
                    const directRowAction = event.target === event.currentTarget;
                    const dragHandleAction =
                      event.target instanceof Element &&
                      event.target.closest(".widget-instance-drag") !== null;
                    if (
                      (directRowAction || dragHandleAction) &&
                      event.altKey &&
                      event.key === "ArrowUp"
                    ) {
                      event.preventDefault();
                      moveByKeyboard(instance.instanceId, -1);
                    }
                    if (
                      (directRowAction || dragHandleAction) &&
                      event.altKey &&
                      event.key === "ArrowDown"
                    ) {
                      event.preventDefault();
                      moveByKeyboard(instance.instanceId, 1);
                    }
                    if (directRowAction && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      setSelectedInstanceId(instance.instanceId);
                    }
                  }}
                >
                  <button
                    className="widget-instance-drag"
                    type="button"
                    disabled={busy || instances.length < 2}
                    aria-label={`${title}拖动排序手柄`}
                    title="按住拖动调整顺序；也可使用 Alt + 方向键"
                    onPointerDown={(event) => beginPointerDrag(event, instance)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Icon name="drag" />
                  </button>
                  <span className="widget-entry-icon">
                    <Icon name={widgetIcon(instance.pluginId)} />
                  </span>
                  <span className="widget-entry-copy">
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  <span
                    className="widget-instance-visibility"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Switch
                      label={instance.visible ? `隐藏${title}` : `显示${title}`}
                      checked={instance.visible}
                      disabled={busy || disabled}
                      onChange={(event) =>
                        void updateInstance(instance.instanceId, { visible: event.target.checked })
                      }
                    />
                    <span>{disabled ? "插件已禁用" : instance.visible ? "显示中" : "已隐藏"}</span>
                  </span>
                  <div
                    className="widget-instance-menu"
                    data-widget-menu
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      className="widget-icon-button"
                      type="button"
                      disabled={busy}
                      aria-label={`${title}更多操作`}
                      aria-expanded={openMenuId === instance.instanceId}
                      onClick={() =>
                        setOpenMenuId((current) =>
                          current === instance.instanceId ? undefined : instance.instanceId,
                        )
                      }
                    >
                      <Icon name="more" />
                    </button>
                    {openMenuId === instance.instanceId ? (
                      <div className="widget-overflow-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void openSettings(instance.pluginId)}
                        >
                          <Icon name="settings" /> 打开插件设置
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void resetPosition(instance)}
                        >
                          <Icon name="refresh" /> 重置位置
                        </button>
                        <button
                          className="widget-overflow-menu__danger"
                          type="button"
                          role="menuitem"
                          onClick={() => void removeInstance(instance)}
                        >
                          <Icon name="delete" /> 删除实例
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="widget-desktop-empty">
            <Icon name="visibility" />
            <h2>桌面上还没有小组件</h2>
            <p>从左侧选择已启用的小组件并添加实例。</p>
          </div>
        )}

        {selectedInstance ? (
          <WidgetSettingsPanel
            instance={selectedInstance}
            entry={findCatalogItem(catalog, selectedInstance)}
            monitors={monitors}
            disabled={
              busyInstanceId === selectedInstance.instanceId ||
              !enabledPluginIds.includes(selectedInstance.pluginId)
            }
            expanded={settingsExpanded}
            onExpandedChange={setSettingsExpanded}
            onUpdate={updateInstance}
          />
        ) : null}
      </div>
    </section>
  );
}

function WidgetSettingsPanel({
  instance,
  entry,
  monitors,
  disabled,
  expanded,
  onExpandedChange,
  onUpdate,
}: {
  readonly instance: WidgetInstance;
  readonly entry?: WidgetCatalogItem;
  readonly monitors: readonly WidgetMonitor[];
  readonly disabled: boolean;
  readonly expanded: boolean;
  readonly onExpandedChange: (expanded: boolean) => void;
  readonly onUpdate: (
    instanceId: string,
    patch: Omit<Parameters<typeof widgetService.update>[0], "instanceId">,
  ) => Promise<void>;
}) {
  const supportedSizes = entry?.contribution.supportedSizes ?? [instance.size];
  const title = entry?.contribution.title ?? instance.widgetId;
  return (
    <section className={`widget-settings-panel${expanded ? "" : " widget-settings-panel--collapsed"}`}>
      <header className="widget-settings-panel__header">
        <div>
          <h2>{title}</h2>
          <p>实例设置</p>
        </div>
        <button
          className="widget-collapse-button"
          type="button"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
        >
          {expanded ? "收起设置" : "展开设置"}
          <Icon name={expanded ? "chevron-up" : "chevron-down"} />
        </button>
      </header>

      {expanded ? (
        <div className="widget-settings-list">
          <label className="widget-settings-row">
            <span className="widget-settings-row__icon"><Icon name="size" /></span>
            <span className="widget-settings-row__copy">
              <strong>尺寸</strong>
              <small>设置小组件的显示尺寸</small>
            </span>
            <select
              value={instance.size}
              aria-label="尺寸"
              disabled={disabled || instance.locked}
              onChange={(event) => {
                const size = event.target.value as WidgetSize;
                const contribution = entry?.contribution;
                if (!contribution) {
                  return;
                }
                void onUpdate(instance.instanceId, {
                  size,
                  dimensions: dimensionsFor(size, contribution.minimumSize),
                });
              }}
            >
              {supportedSizes.map((size) => (
                <option key={size} value={size}>{sizeLabel(size)}</option>
              ))}
            </select>
          </label>

          <label className="widget-settings-row">
            <span className="widget-settings-row__icon"><Icon name="monitor" /></span>
            <span className="widget-settings-row__copy">
              <strong>所在显示器</strong>
              <small>选择小组件显示的屏幕</small>
            </span>
            <select
              value={instance.monitorId}
              aria-label="所在显示器"
              disabled={disabled || instance.locked}
              onChange={(event) =>
                void onUpdate(instance.instanceId, { monitorId: event.target.value })
              }
            >
              {monitors.map((monitor) => (
                <option key={monitor.id} value={monitor.id}>
                  {monitor.name}{monitor.primary ? "（主显示器）" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="widget-settings-row">
            <span className="widget-settings-row__icon"><Icon name="layers" /></span>
            <span className="widget-settings-row__copy">
              <strong>显示层级</strong>
              <small>设置小组件与窗口的层级关系</small>
            </span>
            <select
              value={instance.displayMode}
              aria-label="显示层级"
              disabled={disabled}
              onChange={(event) =>
                void onUpdate(instance.instanceId, {
                  displayMode: event.target.value as WidgetInstance["displayMode"],
                })
              }
            >
              <option value="desktop">桌面层</option>
              <option value="always-on-top">置顶层</option>
            </select>
          </label>

          <div className="widget-settings-row">
            <span className="widget-settings-row__icon"><Icon name="visibility" /></span>
            <span className="widget-settings-row__copy">
              <strong>可见状态</strong>
              <small>控制小组件是否显示在桌面</small>
            </span>
            <span className="widget-settings-row__switch">
              <Switch
                label="切换可见状态"
                checked={instance.visible}
                disabled={disabled}
                onChange={(event) =>
                  void onUpdate(instance.instanceId, { visible: event.target.checked })
                }
              />
              <span>{instance.visible ? "显示中" : "已隐藏"}</span>
            </span>
          </div>

          <div className="widget-settings-row">
            <span className="widget-settings-row__icon">
              <Icon name={instance.locked ? "lock" : "lock-open"} />
            </span>
            <span className="widget-settings-row__copy">
              <strong>锁定位置</strong>
              <small>锁定后将无法拖动和调整大小</small>
            </span>
            <span className="widget-settings-row__switch">
              <Switch
                label={instance.locked ? "解锁位置" : "锁定位置"}
                checked={instance.locked}
                disabled={disabled}
                onChange={(event) =>
                  void onUpdate(instance.instanceId, { locked: event.target.checked })
                }
              />
              <span>{instance.locked ? "已锁定" : "未锁定"}</span>
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function catalogId(item: WidgetCatalogItem): string {
  return `${item.plugin.id}:${item.contribution.id}`;
}

function findCatalogItem(
  catalog: readonly WidgetCatalogItem[],
  instance: WidgetInstance,
): WidgetCatalogItem | undefined {
  return catalog.find(
    ({ plugin, contribution }) =>
      plugin.id === instance.pluginId && contribution.id === instance.widgetId,
  );
}

function widgetIcon(pluginId: string): IconName {
  if (pluginId.includes("audio")) return "audio";
  if (pluginId.includes("hdr")) return "hdr";
  if (pluginId.includes("market")) return "widget-chart";
  if (pluginId.includes("pomodoro")) return "timer";
  if (pluginId.includes("sticky")) return "note";
  return "widgets";
}

function widgetDescription(pluginId: string, fallback: string): string {
  if (pluginId.includes("audio")) return "在桌面快捷切换音频输出设备";
  if (pluginId.includes("hdr")) return "一键开启或关闭显示器 HDR";
  if (pluginId.includes("market")) return "实时查看市场数据与走势";
  if (pluginId.includes("pomodoro")) return "专注计时，提升工作效率";
  if (pluginId.includes("sticky")) return "随手记录，高效整理";
  return fallback;
}

function dimensionsFor(
  size: WidgetSize,
  minimum: { readonly width: number; readonly height: number },
) {
  const defaults = {
    small: { width: 260, height: 160 },
    medium: { width: 360, height: 220 },
    wide: { width: 520, height: 220 },
  } as const;
  return {
    width: Math.max(minimum.width, defaults[size].width),
    height: Math.max(minimum.height, defaults[size].height),
  };
}

function sizeLabel(size: WidgetSize): string {
  return { small: "小", medium: "中", wide: "宽" }[size];
}

async function requestDeclaredPermissions(plugin: PluginDefinition): Promise<void> {
  for (const permission of plugin.permissions) {
    const current = await hostBridge.invoke<PermissionDecision>("permission_status", {
      pluginId: plugin.id,
      permission,
    });
    if (current !== "prompt") {
      continue;
    }
    const accepted = await requestConfirmation({
      title: "小组件权限请求",
      message: `${plugin.name} 声明需要“${permission}”权限。`,
      detail: "权限决定会由 Rust 系统能力层再次校验；拒绝后仍可添加实例，但对应功能不可用。",
      confirmLabel: "允许",
      cancelLabel: "拒绝",
      tone: "permission",
    });
    await hostBridge.invoke<void>("permission_set", {
      pluginId: plugin.id,
      permission,
      decision: accepted ? "granted" : "denied",
    });
  }
}

function reportError(error: unknown): void {
  notify({
    title: "桌面小组件操作失败",
    message: error instanceof Error ? error.message : String(error),
    level: "error",
  });
}
