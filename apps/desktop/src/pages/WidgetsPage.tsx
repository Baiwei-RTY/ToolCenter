import { useNavigate } from "@tanstack/react-router";
import type {
  PermissionDecision,
  PluginDefinition,
  WidgetContribution,
  WidgetSize,
} from "@tool-center/plugin-contract";
import { useEffect, useMemo, useState } from "react";

import { Icon } from "../components/Icon";
import { EmptyState, PageHeader, StatusBadge, Switch } from "../components/ui";
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

interface WidgetCatalogItem {
  readonly plugin: PluginDefinition;
  readonly contribution: WidgetContribution;
}

export function WidgetsPage() {
  const navigate = useNavigate();
  const enabledPluginIds = useAppStore((state) => state.enabledPluginIds);
  const [instances, setInstances] = useState<readonly WidgetInstance[]>([]);
  const [monitors, setMonitors] = useState<readonly WidgetMonitor[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [busyInstanceId, setBusyInstanceId] = useState<string>();
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
  const effectiveSelectedCatalogId =
    selectedCatalogId || (enabledCatalog[0] ? catalogId(enabledCatalog[0]) : "");

  const refresh = async () => {
    const [nextInstances, nextMonitors] = await Promise.all([
      widgetService.list(),
      widgetService.monitors(),
    ]);
    setInstances(nextInstances);
    setMonitors(nextMonitors);
  };

  useEffect(() => {
    let disposed = false;
    let release: (() => void | Promise<void>) | undefined;
    void Promise.all([widgetService.list(), widgetService.monitors()])
      .then(([nextInstances, nextMonitors]) => {
        setInstances(nextInstances);
        setMonitors(nextMonitors);
      })
      .catch(reportError);
    void widgetService.subscribeChanges(() => void refresh().catch(reportError)).then((next) => {
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
  }, []);

  const addWidget = async (catalogItem?: WidgetCatalogItem) => {
    const selected =
      catalogItem ??
      enabledCatalog.find((item) => catalogId(item) === effectiveSelectedCatalogId);
    if (!selected) {
      return;
    }
    try {
      await requestDeclaredPermissions(selected.plugin);
      await widgetService.create({
        pluginId: selected.plugin.id,
        widgetId: selected.contribution.id,
        size: selected.contribution.defaultSize,
        visible: selected.contribution.defaultVisible,
        dimensions: dimensionsFor(
          selected.contribution.defaultSize,
          selected.contribution.minimumSize,
        ),
      });
      await refresh();
      notify({
        title: "桌面小组件已添加",
        message: selected.contribution.title,
        level: "success",
        pluginId: selected.plugin.id,
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
    const accepted = await requestConfirmation({
      title: "删除小组件实例",
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
      await refresh();
    } catch (error) {
      reportError(error);
    } finally {
      setBusyInstanceId(undefined);
    }
  };

  const openSettings = async (pluginId: string) => {
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

  return (
    <section className="page widgets-page">
      <PageHeader
        title="桌面小组件"
        description="添加、显示和管理插件提供的桌面小组件实例"
        actions={
          enabledCatalog.length > 0 ? (
            <div className="widget-add-controls">
              <select
                aria-label="选择小组件"
                value={effectiveSelectedCatalogId}
                onChange={(event) => setSelectedCatalogId(event.target.value)}
              >
                {enabledCatalog.map((item) => (
                  <option key={catalogId(item)} value={catalogId(item)}>
                    {item.plugin.name} · {item.contribution.title}
                  </option>
                ))}
              </select>
              <button className="button--primary" type="button" onClick={() => void addWidget()}>
                <Icon name="add" /> 新建实例
              </button>
            </div>
          ) : undefined
        }
      />

      {catalog.length > 0 ? (
        <div className="widget-catalog-list" aria-label="可用小组件">
          {catalog.map((item) => {
            const enabled = enabledPluginIds.includes(item.plugin.id);
            const instanceCount = instances.filter(
              (instance) =>
                instance.pluginId === item.plugin.id &&
                instance.widgetId === item.contribution.id,
            ).length;
            return (
              <article className="surface-card widget-catalog-card" key={catalogId(item)}>
                <span className="tool-icon tool-icon--blue"><Icon name="grid" /></span>
                <div>
                  <strong>{item.contribution.title}</strong>
                  <small>{item.plugin.name}</small>
                </div>
                <StatusBadge tone={enabled ? "success" : "warning"}>
                  {enabled ? "插件已启用" : "插件已禁用"}
                </StatusBadge>
                <span>实例 {instanceCount}</span>
                <span>
                  尺寸 {item.contribution.supportedSizes.map(sizeLabel).join(" / ")}
                </span>
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={() => void addWidget(item)}
                >
                  <Icon name="add" /> 新建实例
                </button>
              </article>
            );
          })}
        </div>
      ) : null}

      {catalog.length === 0 ? (
        <EmptyState
          title="还没有可用的小组件"
          description="安装或开发包含 Widget contribution 的插件后，可以在这里添加桌面实例。"
        />
      ) : instances.length === 0 ? (
        <EmptyState
          title="桌面上还没有小组件"
          description="从右上角选择一个已启用插件的小组件并新建实例。"
          action={
            enabledCatalog.length === 0 ? (
              <span>请先在插件管理中启用提供小组件的插件。</span>
            ) : undefined
          }
        />
      ) : (
        <div className="widget-instance-list">
          {instances.map((instance) => {
            const entry = catalog.find(
              ({ plugin, contribution }) =>
                plugin.id === instance.pluginId && contribution.id === instance.widgetId,
            );
            const disabled = !enabledPluginIds.includes(instance.pluginId);
            const busy = busyInstanceId === instance.instanceId;
            return (
              <article className="surface-card widget-instance-card" key={instance.instanceId}>
                <header>
                  <span className="tool-icon tool-icon--violet"><Icon name="grid" /></span>
                  <div>
                    <h2>{entry?.contribution.title ?? instance.widgetId}</h2>
                    <p>{entry?.plugin.name ?? instance.pluginId}</p>
                  </div>
                  <StatusBadge tone={disabled ? "warning" : instance.visible ? "success" : "neutral"}>
                    {disabled ? "插件已禁用" : instance.visible ? "桌面显示中" : "已隐藏"}
                  </StatusBadge>
                  <Switch
                    label={instance.visible ? "隐藏小组件" : "显示小组件"}
                    checked={instance.visible}
                    disabled={busy || disabled}
                    onChange={(event) =>
                      void updateInstance(instance.instanceId, { visible: event.target.checked })
                    }
                  />
                </header>
                <div className="widget-instance-card__controls">
                  <label>
                    尺寸
                    <select
                      value={instance.size}
                      disabled={busy || disabled || instance.locked}
                      onChange={(event) => {
                        const size = event.target.value as WidgetSize;
                        const contribution = entry?.contribution;
                        if (!contribution) return;
                        void updateInstance(instance.instanceId, {
                          size,
                          dimensions: dimensionsFor(size, contribution.minimumSize),
                        });
                      }}
                    >
                      {(entry?.contribution.supportedSizes ?? [instance.size]).map((size) => (
                        <option key={size} value={size}>{sizeLabel(size)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    所在显示器
                    <select
                      value={instance.monitorId}
                      disabled={busy || disabled || instance.locked}
                      onChange={(event) =>
                        void updateInstance(instance.instanceId, {
                          monitorId: event.target.value,
                        })
                      }
                    >
                      {monitors.map((monitor) => (
                        <option key={monitor.id} value={monitor.id}>
                          {monitor.name}{monitor.primary ? "（主显示器）" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    显示层级
                    <select
                      value={instance.displayMode}
                      disabled={busy || disabled}
                      onChange={(event) =>
                        void updateInstance(instance.instanceId, {
                          displayMode: event.target.value as WidgetInstance["displayMode"],
                        })
                      }
                    >
                      <option value="desktop">桌面层</option>
                      <option value="always-on-top">始终置顶</option>
                    </select>
                  </label>
                  <label className="widget-lock-control">
                    锁定位置
                    <Switch
                      label={instance.locked ? "解锁位置" : "锁定位置"}
                      checked={instance.locked}
                      disabled={busy || disabled}
                      onChange={(event) =>
                        void updateInstance(instance.instanceId, { locked: event.target.checked })
                      }
                    />
                  </label>
                </div>
                <footer>
                  <span className="widget-instance-id">实例 ID：{instance.instanceId}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void widgetService.resetPosition(instance.instanceId).then(refresh).catch(reportError)}
                  >
                    <Icon name="refresh" /> 重置位置
                  </button>
                  <button type="button" disabled={busy} onClick={() => void openSettings(instance.pluginId)}>
                    <Icon name="settings" /> 打开设置
                  </button>
                  <button className="button--danger" type="button" disabled={busy} onClick={() => void removeInstance(instance)}>
                    <Icon name="close" /> 删除实例
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function catalogId(item: WidgetCatalogItem): string {
  return `${item.plugin.id}:${item.contribution.id}`;
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
      detail: "权限决定会由 Rust 系统能力层再次校验，拒绝后仍可添加实例，但对应功能不可用。",
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
