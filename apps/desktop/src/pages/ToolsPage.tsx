import { useRouter } from "@tanstack/react-router";
import type {
  PermissionDecision,
  PluginDefinition,
  PluginEntrypointKind,
} from "@tool-center/plugin-contract";
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Icon, type IconName } from "../components/Icon";
import { EmptyState, Switch } from "../components/ui";
import type { SearchItem } from "../features/search/search-index";
import { useExecuteSearchItem } from "../features/search/use-execute-search-item";
import { useRuntimeSnapshots } from "../hooks/use-runtime-snapshots";
import { pluginRegistry } from "../plugin-registry.generated";
import { hostBridge, pluginRuntime, sharedScheduler } from "../runtime/host";
import { requestConfirmation } from "../services/confirmations";
import { notify } from "../services/notifications";
import { widgetService, type WidgetInstance } from "../services/widgets";
import { useAppStore } from "../stores/app-store";

type ToolFilter = "all" | "page" | "widget" | "enabled";
type DetailTab = "overview" | "content" | "permissions" | "storage" | "diagnostics";

interface PluginLogRecord {
  readonly timestamp?: string;
  readonly level?: string;
  readonly pluginId?: string;
  readonly message?: string;
}

interface PluginDetailData {
  readonly permissions: Readonly<Record<string, PermissionDecision>>;
  readonly storageKeys: readonly string[];
  readonly widgetInstances: readonly WidgetInstance[];
  readonly logs: readonly PluginLogRecord[];
}

const filters: readonly { readonly id: ToolFilter; readonly label: string }[] = [
  { id: "all", label: "全部" },
  { id: "page", label: "页面" },
  { id: "widget", label: "小组件" },
  { id: "enabled", label: "已启用" },
];

const detailTabs: readonly { readonly id: DetailTab; readonly label: string }[] = [
  { id: "overview", label: "概览" },
  { id: "content", label: "内容" },
  { id: "permissions", label: "权限" },
  { id: "storage", label: "存储" },
  { id: "diagnostics", label: "诊断" },
];

const emptyDetail: PluginDetailData = {
  permissions: {},
  storageKeys: [],
  widgetInstances: [],
  logs: [],
};

export function ToolsPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ToolFilter>("all");
  const [selectedId, setSelectedId] = useState<string | undefined>(
    pluginRegistry.find((plugin) => plugin.id === "toolcenter.market-watch")?.id ??
      pluginRegistry[0]?.id,
  );
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [detailData, setDetailData] = useState<PluginDetailData>(emptyDetail);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const enabledPluginIds = useAppStore((state) => state.enabledPluginIds);
  const pluginOrder = useAppStore((state) => state.pluginOrder);
  const setPluginEnabled = useAppStore((state) => state.setPluginEnabled);
  const addRecent = useAppStore((state) => state.addRecent);
  const snapshots = useRuntimeSnapshots();
  const execute = useExecuteSearchItem();
  const router = useRouter();

  const orderedPlugins = useMemo(() => {
    const order = new Map(pluginOrder.map((id, index) => [id, index]));
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return [...pluginRegistry]
      .filter((plugin) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          `${plugin.name} ${plugin.description} ${plugin.category} ${plugin.id}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalizedQuery);
        const matchesFilter =
          activeFilter === "all" ||
          (activeFilter === "enabled" && enabledPluginIds.includes(plugin.id)) ||
          (activeFilter === "page" && (plugin.contributes.pages?.length ?? 0) > 0) ||
          (activeFilter === "widget" && (plugin.contributes.widgets?.length ?? 0) > 0);
        return matchesQuery && matchesFilter;
      })
      .sort(
        (left, right) =>
          (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
          left.name.localeCompare(right.name, "zh-CN"),
      );
  }, [activeFilter, enabledPluginIds, pluginOrder, query]);

  const selected =
    pluginRegistry.find((plugin) => plugin.id === selectedId) ?? pluginRegistry[0];
  const selectedEnabled = selected ? enabledPluginIds.includes(selected.id) : false;
  const selectedSnapshots = selected
    ? snapshots.filter((snapshot) => snapshot.pluginId === selected.id)
    : [];

  useEffect(() => {
    if (!selected) {
      return;
    }
    let cancelled = false;
    void readPluginDetails(selected)
      .then((data) => {
        if (!cancelled) {
          setDetailData(data);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          notify({
            title: "插件详情读取失败",
            message: error instanceof Error ? error.message : String(error),
            level: "error",
            pluginId: selected.id,
          });
        }
      })
    return () => {
      cancelled = true;
    };
  }, [detailRefresh, selected]);

  const updateEnabled = useCallback(
    async (plugin: PluginDefinition, enabled: boolean) => {
      const previous = enabledPluginIds.includes(plugin.id);
      setPluginEnabled(plugin.id, enabled);
      try {
        await pluginRuntime.setEnabled(plugin.id, enabled);
        notify({
          title: `${plugin.name}已${enabled ? "启用" : "停用"}`,
          level: "success",
          pluginId: plugin.id,
        });
      } catch (error) {
        setPluginEnabled(plugin.id, previous);
        notify({
          title: "插件状态更新失败",
          message: error instanceof Error ? error.message : String(error),
          level: "error",
          pluginId: plugin.id,
        });
      }
    },
    [enabledPluginIds, setPluginEnabled],
  );

  const openPlugin = async (plugin: PluginDefinition) => {
    const item = searchItemForPlugin(plugin);
    if (
      (plugin.contributes.pages?.length ?? 0) > 0 ||
      (plugin.contributes.actions?.length ?? 0) > 0
    ) {
      await execute(item);
      return;
    }
    if ((plugin.contributes.widgets?.length ?? 0) > 0) {
      addRecent({ id: item.id, title: item.title, kind: "plugin", pluginId: plugin.id });
      await router.history.push("/widgets");
      return;
    }
    if ((plugin.contributes.services?.length ?? 0) > 0) {
      await router.history.push("/running");
      return;
    }
    notify({
      title: "插件没有可打开的入口",
      message: "该插件尚未声明页面、动作、小组件或服务。",
      level: "info",
      pluginId: plugin.id,
    });
  };

  const setPermission = async (
    plugin: PluginDefinition,
    permission: string,
    decision: PermissionDecision,
  ) => {
    const accepted = await requestConfirmation({
      title: decision === "granted" ? "允许插件权限" : "撤销插件权限",
      message:
        decision === "granted"
          ? `允许 ${plugin.name} 使用“${permission}”？`
          : `将 ${plugin.name} 的“${permission}”恢复为未决定状态？`,
      detail: "权限决定仍会由 Rust 系统能力层在每次高风险调用时验证。",
      confirmLabel: decision === "granted" ? "允许" : "撤销",
      cancelLabel: "取消",
      tone: decision === "granted" ? "permission" : "normal",
    });
    if (!accepted) {
      return;
    }
    try {
      await hostBridge.invoke<void>("permission_set", {
        pluginId: plugin.id,
        permission,
        decision,
      });
      setDetailData((current) => ({
        ...current,
        permissions: { ...current.permissions, [permission]: decision },
      }));
      notify({
        title: decision === "granted" ? "权限已允许" : "权限决定已撤销",
        level: "success",
        pluginId: plugin.id,
      });
    } catch (error) {
      notify({
        title: "权限更新失败",
        message: error instanceof Error ? error.message : String(error),
        level: "error",
        pluginId: plugin.id,
      });
    }
  };

  if (pluginRegistry.length === 0) {
    return (
      <section className="tool-center-page tool-center-page--empty">
        <EmptyState
          title="当前没有已注册插件"
          description="插件通过正式注册表接入后，会在这里显示页面、小组件、动作和服务。"
        />
      </section>
    );
  }

  return (
    <section className="tool-center-page">
      <aside className="tool-master-pane" aria-label="插件工具列表">
        <div className="tool-master-pane__header">
          <h1>工具</h1>
          <label className="tool-search">
            <Icon name="search" />
            <input
              id="tool-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索功能..."
              aria-label="搜索插件功能"
            />
          </label>
          <div className="filter-chips" aria-label="筛选工具">
            {filters.map((filter) => (
              <MaterialChip
                key={filter.id}
                selected={activeFilter === filter.id}
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
              </MaterialChip>
            ))}
          </div>
        </div>

        <div className="tool-list">
          <p className="tool-list__label">全部工具</p>
          {orderedPlugins.length > 0 ? (
            orderedPlugins.map((plugin) => {
              const enabled = enabledPluginIds.includes(plugin.id);
              const selectedRow = selected?.id === plugin.id;
              return (
                <article
                  className={`tool-row${selectedRow ? " tool-row--selected" : ""}`}
                  key={plugin.id}
                >
                  <button
                    className="tool-row__select"
                    type="button"
                    aria-current={selectedRow ? "true" : undefined}
                    onClick={() => {
                      setSelectedId(plugin.id);
                      setActiveTab("overview");
                    }}
                  >
                    <span className={`tool-row__icon${selectedRow ? " tool-row__icon--selected" : ""}`}>
                      <Icon name={iconForPlugin(plugin)} />
                    </span>
                    <span className="tool-row__copy">
                      <strong>{plugin.name}</strong>
                      <span>
                        {primaryContributionLabel(plugin)}
                        <i aria-hidden="true">·</i>
                        {enabled ? "已启用" : "已停用"}
                      </span>
                    </span>
                    <span
                      className={`tool-row__status${enabled ? " tool-row__status--enabled" : ""}`}
                      aria-label={enabled ? "插件已启用" : "插件已停用"}
                    />
                  </button>
                  <Switch
                    label={`${enabled ? "停用" : "启用"}${plugin.name}`}
                    checked={enabled}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => void updateEnabled(plugin, event.target.checked)}
                  />
                </article>
              );
            })
          ) : (
            <div className="tool-list__empty">
              <Icon name="search" />
              <strong>没有匹配的工具</strong>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveFilter("all");
                }}
              >
                清除筛选
              </button>
            </div>
          )}
        </div>
      </aside>

      {selected ? (
        <main className="plugin-detail-pane">
          <header className="plugin-center-hero">
            <span className="plugin-center-hero__icon">
              <Icon name={iconForPlugin(selected)} />
            </span>
            <div className="plugin-center-hero__copy">
              <h2>{selected.name}</h2>
              <p>{selected.category}</p>
              <div>
                <span
                  className={`plugin-enabled-badge${
                    selectedEnabled ? "" : " plugin-enabled-badge--off"
                  }`}
                >
                  {selectedEnabled ? "已启用" : "已停用"}
                </span>
                <span>v{selected.version}</span>
              </div>
            </div>
            {createElement(
              "mdui-button",
              {
                class: "plugin-center-open",
                variant: "filled",
                disabled: !selectedEnabled,
                onClick: () => void openPlugin(selected),
              },
              <Icon name="external" />,
              openLabel(selected),
            )}
          </header>

          <nav className="plugin-center-tabs" aria-label="插件详情分类">
            {detailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? "page" : undefined}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="plugin-center-content">
            {activeTab === "overview" ? (
              <OverviewTab
                plugin={selected}
                enabled={selectedEnabled}
                detail={detailData}
                snapshots={selectedSnapshots}
                onManagePermissions={() => setActiveTab("permissions")}
                onOpenWidgets={() => void router.history.push("/widgets")}
              />
            ) : null}
            {activeTab === "content" ? (
              <ContentTab
                plugin={selected}
                enabled={selectedEnabled}
                snapshots={selectedSnapshots}
                onExecute={execute}
                onOpenWidgets={() => void router.history.push("/widgets")}
                onRefresh={() => setDetailRefresh((value) => value + 1)}
              />
            ) : null}
            {activeTab === "permissions" ? (
              <PermissionsTab
                plugin={selected}
                permissions={detailData.permissions}
                onSetPermission={(permission, decision) =>
                  void setPermission(selected, permission, decision)
                }
              />
            ) : null}
            {activeTab === "storage" ? (
              <StorageTab plugin={selected} keys={detailData.storageKeys} />
            ) : null}
            {activeTab === "diagnostics" ? (
              <DiagnosticsTab
                plugin={selected}
                snapshots={selectedSnapshots}
                logs={detailData.logs}
                onReload={() => void reloadPlugin(selected, selectedEnabled)}
              />
            ) : null}
          </div>

          <RuntimeStatus
            enabled={selectedEnabled}
            pluginName={selected.name}
            snapshots={selectedSnapshots}
            onOpen={() => void router.history.push("/running")}
          />
        </main>
      ) : null}
    </section>
  );
}

function OverviewTab({
  plugin,
  enabled,
  detail,
  snapshots,
  onManagePermissions,
  onOpenWidgets,
}: {
  readonly plugin: PluginDefinition;
  readonly enabled: boolean;
  readonly detail: PluginDetailData;
  readonly snapshots: readonly {
    readonly entrypoint: PluginEntrypointKind;
    readonly state: string;
  }[];
  readonly onManagePermissions: () => void;
  readonly onOpenWidgets: () => void;
}) {
  const contributions = contributionCounts(plugin);
  const instances = detail.widgetInstances.filter((instance) => instance.pluginId === plugin.id);
  return (
    <section className="plugin-overview-layout" aria-label={`${plugin.name}概览`}>
      <article className="plugin-overview-card">
        <header>
          <div>
            <p>插件概览</p>
            <h3>{plugin.name}</h3>
            <span>{plugin.description}</span>
          </div>
          <span className={`overview-health${enabled ? "" : " overview-health--off"}`}>
            <Icon name={enabled ? "check" : "pause"} />
            {enabled ? "运行环境就绪" : "插件已停用"}
          </span>
        </header>
        <div className="plugin-metric-grid">
          {[
            { icon: "page" as const, label: "页面", value: contributions.pages },
            { icon: "widgets" as const, label: "小组件", value: contributions.widgets },
            { icon: "play" as const, label: "动作", value: contributions.actions },
            { icon: "activity" as const, label: "服务", value: contributions.services },
          ].map((metric) => (
            <div key={metric.label}>
              <Icon name={metric.icon} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
        <div className="plugin-overview-rows">
          <div>
            <Icon name="activity" />
            <span>
              <strong>运行时入口</strong>
              {snapshots.length > 0
                ? `${snapshots.length} 个入口已加载`
                : "尚未加载插件业务代码，保持按需启动"}
            </span>
            <em>{snapshots.length > 0 ? "活动中" : "懒加载"}</em>
          </div>
          <div>
            <Icon name="shield" />
            <span>
              <strong>权限隔离</strong>
              {plugin.permissions.length > 0
                ? `${plugin.permissions.length} 项声明由 Rust 层验证`
                : "未声明高风险主机权限"}
            </span>
            <em>已保护</em>
          </div>
          <div>
            <Icon name="storage" />
            <span>
              <strong>隔离存储</strong>
              {detail.storageKeys.length > 0
                ? `${detail.storageKeys.length} 个键位于插件命名空间`
                : "当前命名空间没有已保存键"}
            </span>
            <em>{detail.storageKeys.length}</em>
          </div>
        </div>
      </article>

      <aside className="plugin-summary-panel">
        <section>
          <h3>提供的内容</h3>
          {contributions.pages > 0 ? (
            <SummaryRow icon="page" label="页面" value={contributions.pages} />
          ) : null}
          {contributions.widgets > 0 ? (
            <SummaryRow icon="widgets" label="小组件" value={contributions.widgets} />
          ) : null}
          {contributions.actions > 0 ? (
            <SummaryRow icon="play" label="动作" value={contributions.actions} />
          ) : null}
          {contributions.services > 0 ? (
            <SummaryRow icon="activity" label="服务" value={contributions.services} />
          ) : null}
        </section>
        <section>
          <h3>权限</h3>
          {plugin.permissions.length > 0 ? (
            plugin.permissions.slice(0, 3).map((permission) => (
              <div className="plugin-permission-summary" key={permission}>
                <Icon name={permission.startsWith("network") ? "language" : "shield"} />
                <span title={permission}>{permission}</span>
                <strong data-decision={detail.permissions[permission] ?? "prompt"}>
                  {permissionLabel(detail.permissions[permission] ?? "prompt")}
                </strong>
              </div>
            ))
          ) : (
            <p className="plugin-summary-panel__empty">无需主机权限</p>
          )}
          <button className="plugin-text-action" type="button" onClick={onManagePermissions}>
            管理权限
            <Icon name="chevron-right" />
          </button>
        </section>
        <section>
          <h3>桌面实例</h3>
          {instances.length > 0 ? (
            instances.slice(0, 2).map((instance) => (
              <button
                className="plugin-instance-row"
                type="button"
                key={instance.instanceId}
                onClick={onOpenWidgets}
              >
                <Icon name="pin" />
                <span>
                  <strong>{widgetTitle(plugin, instance.widgetId)}</strong>
                  <small>
                    {instance.visible ? "正在显示" : "已隐藏"} ·{" "}
                    {instance.displayMode === "always-on-top" ? "始终置顶" : "桌面层"}
                  </small>
                </span>
                <Icon name="chevron-right" />
              </button>
            ))
          ) : (
            <button className="plugin-instance-empty" type="button" onClick={onOpenWidgets}>
              <Icon name="widgets" />
              <span>尚未创建桌面实例</span>
              <Icon name="chevron-right" />
            </button>
          )}
        </section>
      </aside>
    </section>
  );
}

function ContentTab({
  plugin,
  enabled,
  snapshots,
  onExecute,
  onOpenWidgets,
  onRefresh,
}: {
  readonly plugin: PluginDefinition;
  readonly enabled: boolean;
  readonly snapshots: readonly { readonly entrypoint: PluginEntrypointKind }[];
  readonly onExecute: (item: SearchItem) => Promise<void>;
  readonly onOpenWidgets: () => void;
  readonly onRefresh: () => void;
}) {
  const serviceActive = snapshots.some((snapshot) => snapshot.entrypoint === "service");
  const entries = [
    ...(plugin.contributes.pages ?? []).map((page) => ({
      key: `page:${page.id}`,
      icon: "page" as const,
      title: page.title,
      detail: `${page.route} · 按需加载`,
      type: "页面",
      action: () =>
        onExecute({
          id: `page:${plugin.id}:${page.id}`,
          title: page.title,
          description: plugin.name,
          kind: "page",
          pluginId: plugin.id,
          pageId: page.id,
          route: `/plugin/${encodeURIComponent(plugin.id)}/${encodeURIComponent(page.id)}`,
          keywords: [plugin.name, plugin.category],
        }),
    })),
    ...(plugin.contributes.widgets ?? []).map((widget) => ({
      key: `widget:${widget.id}`,
      icon: "widgets" as const,
      title: widget.title,
      detail: `${widget.supportedSizes.join(" / ")} · 独立桌面实例`,
      type: "小组件",
      action: async () => onOpenWidgets(),
    })),
    ...(plugin.contributes.actions ?? []).map((action) => ({
      key: `action:${action.id}`,
      icon: "play" as const,
      title: action.title,
      detail: action.description ?? "按需执行插件动作",
      type: "动作",
      action: () =>
        onExecute({
          id: `action:${plugin.id}:${action.id}`,
          title: action.title,
          description: action.description ?? plugin.name,
          kind: "action",
          pluginId: plugin.id,
          actionId: action.id,
          keywords: [plugin.name, plugin.category],
        }),
    })),
  ];

  return (
    <section className="plugin-tab-surface">
      <header>
        <div>
          <p>内容入口</p>
          <h3>此插件提供的正式能力</h3>
        </div>
        <span>{entries.length + (plugin.contributes.services?.length ?? 0)} 个入口</span>
      </header>
      <div className="plugin-settings-list">
        {entries.map((entry) => (
          <button
            key={entry.key}
            type="button"
            disabled={!enabled}
            onClick={() => void entry.action()}
          >
            <Icon name={entry.icon} />
            <span>
              <strong>{entry.title}</strong>
              <small>{entry.detail}</small>
            </span>
            <em>{entry.type}</em>
            <Icon name="chevron-right" />
          </button>
        ))}
        {(plugin.contributes.services ?? []).map((service) => (
          <button
            key={`service:${service.id}`}
            type="button"
            disabled={!enabled}
            onClick={() =>
              void (serviceActive
                ? pluginRuntime.stopService(plugin.id, service.id)
                : pluginRuntime.startService(plugin.id, service.id))
                .then(onRefresh)
                .catch((error: unknown) =>
                  notify({
                    title: `${serviceActive ? "停止" : "启动"}服务失败`,
                    message: error instanceof Error ? error.message : String(error),
                    level: "error",
                    pluginId: plugin.id,
                  }),
                )
            }
          >
            <Icon name="activity" />
            <span>
              <strong>{service.title}</strong>
              <small>后台服务 · 默认不自启动</small>
            </span>
            <em>{serviceActive ? "停止" : "启动"}</em>
            <Icon name="chevron-right" />
          </button>
        ))}
        {entries.length === 0 && (plugin.contributes.services?.length ?? 0) === 0 ? (
          <div className="plugin-tab-empty">
            <Icon name="info" />
            <span>此插件尚未声明可用入口。</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PermissionsTab({
  plugin,
  permissions,
  onSetPermission,
}: {
  readonly plugin: PluginDefinition;
  readonly permissions: Readonly<Record<string, PermissionDecision>>;
  readonly onSetPermission: (permission: string, decision: PermissionDecision) => void;
}) {
  return (
    <section className="plugin-tab-surface">
      <header>
        <div>
          <p>权限声明</p>
          <h3>由 Rust 权限层验证的系统能力</h3>
        </div>
        <span>{plugin.permissions.length} 项</span>
      </header>
      <div className="plugin-settings-list">
        {plugin.permissions.length > 0 ? (
          plugin.permissions.map((permission) => {
            const decision = permissions[permission] ?? "prompt";
            return (
              <div className="plugin-setting-row" key={permission}>
                <Icon name={permission.startsWith("network") ? "language" : "shield"} />
                <span>
                  <strong>{permission}</strong>
                  <small>{permissionDescription(permission)}</small>
                </span>
                <em data-decision={decision}>{permissionLabel(decision)}</em>
                <button
                  type="button"
                  onClick={() =>
                    onSetPermission(permission, decision === "granted" ? "prompt" : "granted")
                  }
                >
                  {decision === "granted" ? "撤销" : "允许"}
                </button>
              </div>
            );
          })
        ) : (
          <div className="plugin-tab-empty">
            <Icon name="check" />
            <span>此插件未申请主机权限。</span>
          </div>
        )}
      </div>
    </section>
  );
}

function StorageTab({
  plugin,
  keys,
}: {
  readonly plugin: PluginDefinition;
  readonly keys: readonly string[];
}) {
  return (
    <section className="plugin-tab-surface">
      <header>
        <div>
          <p>隔离存储</p>
          <h3>{plugin.name} 的插件命名空间</h3>
        </div>
        <span>{keys.length} 个键</span>
      </header>
      {keys.length > 0 ? (
        <div className="plugin-storage-list">
          {keys.map((key) => (
            <div key={key}>
              <Icon name="storage" />
              <span>
                <strong>{key}</strong>
                <small>仅可由 {plugin.id} 通过 Plugin Context 访问</small>
              </span>
              <em>已隔离</em>
            </div>
          ))}
        </div>
      ) : (
        <div className="plugin-tab-empty">
          <Icon name="storage" />
          <span>当前没有已保存的插件数据。</span>
        </div>
      )}
    </section>
  );
}

function DiagnosticsTab({
  plugin,
  snapshots,
  logs,
  onReload,
}: {
  readonly plugin: PluginDefinition;
  readonly snapshots: readonly {
    readonly entrypoint: PluginEntrypointKind;
    readonly state: string;
    readonly error?: string;
  }[];
  readonly logs: readonly PluginLogRecord[];
  readonly onReload: () => void;
}) {
  const scheduler = sharedScheduler
    .diagnostics()
    .registrations.filter((registration) => registration.ownerId.startsWith(plugin.id));
  return (
    <section className="plugin-tab-surface">
      <header>
        <div>
          <p>运行诊断</p>
          <h3>资源状态与最近日志</h3>
        </div>
        <button type="button" onClick={onReload}>
          <Icon name="refresh" />
          重新加载
        </button>
      </header>
      <div className="plugin-diagnostic-grid">
        <div>
          <Icon name="activity" />
          <span>
            <strong>活动入口</strong>
            <small>{snapshots.map((snapshot) => snapshot.entrypoint).join("、") || "未加载"}</small>
          </span>
          <em>{snapshots.length}</em>
        </div>
        <div>
          <Icon name="timer" />
          <span>
            <strong>调度任务</strong>
            <small>由共享 Scheduler 集中管理</small>
          </span>
          <em>{scheduler.length}</em>
        </div>
        <div>
          <Icon name="diagnostics" />
          <span>
            <strong>最近日志</strong>
            <small>仅显示此插件的主机日志</small>
          </span>
          <em>{logs.length}</em>
        </div>
      </div>
      {snapshots.some((snapshot) => snapshot.error) ? (
        <div className="plugin-diagnostic-error" role="alert">
          <Icon name="warning" />
          <span>
            {snapshots.find((snapshot) => snapshot.error)?.error}
          </span>
        </div>
      ) : null}
      <div className="plugin-log-list">
        {logs.slice(0, 12).map((log, index) => (
          <div key={`${log.timestamp ?? "log"}:${index}`}>
            <time>{log.timestamp ? new Date(log.timestamp).toLocaleString("zh-CN") : "—"}</time>
            <strong data-level={log.level ?? "info"}>{log.level ?? "info"}</strong>
            <code>{log.message ?? "无日志正文"}</code>
          </div>
        ))}
        {logs.length === 0 ? (
          <div className="plugin-tab-empty">
            <Icon name="check" />
            <span>当前没有此插件的主机日志。</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RuntimeStatus({
  pluginName,
  enabled,
  snapshots,
  onOpen,
}: {
  readonly pluginName: string;
  readonly enabled: boolean;
  readonly snapshots: readonly { readonly state: string }[];
  readonly onOpen: () => void;
}) {
  const loading = snapshots.some((snapshot) => snapshot.state === "loading");
  const disposing = snapshots.some((snapshot) => snapshot.state === "disposing");
  const failed = snapshots.some((snapshot) => snapshot.state.endsWith("failed"));
  const progress = !enabled ? 0 : loading ? 0.35 : disposing ? 0.7 : 1;
  const label = !enabled
    ? `${pluginName}已停用`
    : failed
      ? `${pluginName}存在运行错误`
      : loading
        ? `正在加载${pluginName}…`
        : disposing
          ? `正在清理${pluginName}资源…`
          : snapshots.length > 0
            ? `${snapshots.length} 个入口正在运行`
            : "正式运行时已就绪";
  return (
    <footer className="plugin-runtime-status" aria-live="polite">
      <span>
        <Icon name={failed ? "warning" : loading || disposing ? "refresh" : "check"} />
        {label}
      </span>
      {createElement("mdui-linear-progress", {
        value: progress,
        class: "plugin-runtime-progress",
      })}
      <strong>{Math.round(progress * 100)}%</strong>
      <button type="button" onClick={onOpen}>
        查看正在运行
        <Icon name="chevron-right" />
      </button>
    </footer>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="plugin-summary-row">
      <Icon name={icon} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MaterialChip({
  selected,
  onClick,
  children,
}: {
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly children: string;
}) {
  return createElement(
    "mdui-chip",
    {
      class: `plugin-filter-chip${selected ? " plugin-filter-chip--selected" : ""}`,
      variant: "filter",
      selectable: true,
      selected,
      selectedIcon: "",
      onClick,
    },
    children,
  );
}

async function readPluginDetails(plugin: PluginDefinition): Promise<PluginDetailData> {
  const [permissionEntries, storageKeys, widgetInstances, logs] = await Promise.all([
    Promise.all(
      plugin.permissions.map(async (permission) => [
        permission,
        await hostBridge.invoke<PermissionDecision>("permission_status", {
          pluginId: plugin.id,
          permission,
        }),
      ] as const),
    ),
    hostBridge.invoke<readonly string[]>("plugin_storage_list", { pluginId: plugin.id }),
    widgetService.list(),
    hostBridge.invoke<readonly PluginLogRecord[]>("log_list", { limit: 200 }),
  ]);
  return {
    permissions: Object.fromEntries(permissionEntries),
    storageKeys,
    widgetInstances,
    logs: logs.filter((log) => log.pluginId === plugin.id),
  };
}

async function reloadPlugin(plugin: PluginDefinition, enabled: boolean): Promise<void> {
  if (!enabled) {
    notify({
      title: "插件当前已停用",
      message: "请先启用插件，再重新加载运行时入口。",
      level: "info",
      pluginId: plugin.id,
    });
    return;
  }
  try {
    await pluginRuntime.disposePlugin(plugin.id);
    notify({ title: `${plugin.name}运行资源已重新加载`, level: "success", pluginId: plugin.id });
  } catch (error) {
    notify({
      title: "插件重新加载失败",
      message: error instanceof Error ? error.message : String(error),
      level: "error",
      pluginId: plugin.id,
    });
  }
}

function searchItemForPlugin(plugin: PluginDefinition): SearchItem {
  return {
    id: `plugin:${plugin.id}`,
    title: plugin.name,
    description: plugin.description,
    kind: "plugin",
    pluginId: plugin.id,
    keywords: [plugin.category, plugin.id],
  };
}

function contributionCounts(plugin: PluginDefinition) {
  return {
    pages: plugin.contributes.pages?.length ?? 0,
    widgets: plugin.contributes.widgets?.length ?? 0,
    actions: plugin.contributes.actions?.length ?? 0,
    services: plugin.contributes.services?.length ?? 0,
  };
}

function primaryContributionLabel(plugin: PluginDefinition): string {
  const counts = contributionCounts(plugin);
  if (counts.pages > 0) return "页面";
  if (counts.widgets > 0) return "小组件";
  if (counts.actions > 0) return "动作";
  if (counts.services > 0) return "服务";
  return "插件";
}

function openLabel(plugin: PluginDefinition): string {
  if ((plugin.contributes.pages?.length ?? 0) > 0) return "打开页面";
  if ((plugin.contributes.actions?.length ?? 0) > 0) return "执行动作";
  if ((plugin.contributes.widgets?.length ?? 0) > 0) return "管理小组件";
  if ((plugin.contributes.services?.length ?? 0) > 0) return "查看运行";
  return "暂无入口";
}

function iconForPlugin(plugin: PluginDefinition): IconName {
  if (plugin.id.includes("audio")) return "audio";
  if (plugin.id.includes("hdr")) return "hdr";
  if (plugin.id.includes("market")) return "chart";
  if (plugin.id.includes("pomodoro")) return "timer";
  if (plugin.id.includes("sticky") || plugin.id.includes("note")) return "note";
  if ((plugin.contributes.widgets?.length ?? 0) > 0) return "widgets";
  if ((plugin.contributes.pages?.length ?? 0) > 0) return "page";
  return "plugin";
}

function permissionLabel(decision: PermissionDecision): string {
  if (decision === "granted") return "已允许";
  if (decision === "denied") return "已拒绝";
  return "待决定";
}

function permissionDescription(permission: string): string {
  if (permission.startsWith("network.")) return "访问清单允许的只读 HTTPS 数据源";
  if (permission.startsWith("audio.")) return "读取或控制 Windows 音频设备";
  if (permission.startsWith("display.")) return "读取或控制 Windows 显示器状态";
  if (permission.startsWith("background.")) return "在共享运行时中执行后台服务";
  return "由插件清单声明，并由主机能力层进行二次校验";
}

function widgetTitle(plugin: PluginDefinition, widgetId: string): string {
  return (
    plugin.contributes.widgets?.find((widget) => widget.id === widgetId)?.title ?? widgetId
  );
}
