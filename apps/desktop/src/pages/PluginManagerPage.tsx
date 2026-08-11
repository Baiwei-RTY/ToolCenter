import type { PluginDefinition } from "@tool-center/plugin-contract";
import { useMemo, useState } from "react";

import { Icon, type IconName } from "../components/Icon";
import { EmptyState, Switch } from "../components/ui";
import { pluginRegistry } from "../plugin-registry.generated";
import { pluginRuntime } from "../runtime/host";
import { notify } from "../services/notifications";
import { useAppStore } from "../stores/app-store";

const detailTabs = ["概览", "内容", "权限", "后台运行", "存储", "错误与诊断"] as const;
const filterOptions = [
  ["all", "全部插件"],
  ["enabled", "仅看已启用"],
  ["disabled", "仅看已停用"],
] as const;

type DetailTab = (typeof detailTabs)[number];
type PluginFilter = (typeof filterOptions)[number][0];

export function PluginManagerPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PluginFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(pluginRegistry[0]?.id);
  const [detailTab, setDetailTab] = useState<DetailTab>("概览");
  const [reloadingId, setReloadingId] = useState<string>();
  const enabledPluginIds = useAppStore((state) => state.enabledPluginIds);
  const pluginOrder = useAppStore((state) => state.pluginOrder);
  const setPluginEnabled = useAppStore((state) => state.setPluginEnabled);

  const orderedPlugins = useMemo(() => {
    const order = new Map(pluginOrder.map((id, index) => [id, index]));
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return [...pluginRegistry]
      .filter((plugin) => {
        const enabled = enabledPluginIds.includes(plugin.id);
        const matchesQuery =
          normalizedQuery.length === 0 ||
          `${plugin.name} ${plugin.description} ${plugin.category} ${plugin.id}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalizedQuery);
        const matchesFilter =
          filter === "all" ||
          (filter === "enabled" && enabled) ||
          (filter === "disabled" && !enabled);
        return matchesQuery && matchesFilter;
      })
      .sort(
        (left, right) =>
          (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
          left.name.localeCompare(right.name, "zh-CN"),
      );
  }, [enabledPluginIds, filter, pluginOrder, query]);

  const selected =
    pluginRegistry.find((plugin) => plugin.id === selectedId) ?? pluginRegistry[0];

  const updateEnabled = async (pluginId: string, enabled: boolean) => {
    setPluginEnabled(pluginId, enabled);
    try {
      await pluginRuntime.setEnabled(pluginId, enabled);
    } catch (error) {
      notify({
        title: "插件资源清理不完整",
        message: error instanceof Error ? error.message : String(error),
        level: "error",
        pluginId,
      });
    }
  };

  const reloadPlugin = async (pluginId: string) => {
    if (reloadingId) return;
    setReloadingId(pluginId);
    try {
      await pluginRuntime.setEnabled(pluginId, false);
      await pluginRuntime.setEnabled(pluginId, true);
      notify({ title: "插件已重新加载", level: "success", pluginId });
    } catch (error) {
      notify({
        title: "重新加载插件失败",
        message: error instanceof Error ? error.message : String(error),
        level: "error",
        pluginId,
      });
    } finally {
      setReloadingId(undefined);
    }
  };

  return (
    <section className="page plugin-manager-page">
      <aside className="plugin-manager-browser" aria-label="插件列表">
        <header className="plugin-manager-browser__heading">
          <h1>插件管理</h1>
          <p>管理已安装的插件、权限、运行状态和数据</p>
        </header>

        <div className="plugin-manager-search-row">
          <label className="plugin-manager-search">
            <Icon name="search" />
            <input
              aria-label="搜索插件"
              type="search"
              placeholder="搜索插件名称或描述…"
              value={query}
              onInput={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <div className="plugin-manager-filter">
            <button
              className={filter === "all" ? "plugin-manager-filter__button" : "plugin-manager-filter__button plugin-manager-filter__button--active"}
              type="button"
              aria-label="筛选插件"
              aria-haspopup="menu"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <Icon name="filter" />
            </button>
            {filterOpen ? (
              <div className="plugin-manager-filter__menu" role="menu">
                {filterOptions.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={filter === id}
                    onClick={() => {
                      setFilter(id);
                      setFilterOpen(false);
                    }}
                  >
                    <span>{label}</span>
                    {filter === id ? <Icon name="check" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <p className="plugin-manager-count">全部插件 {pluginRegistry.length}</p>
        <div className="plugin-manager-list" role="listbox" aria-label="已安装插件">
          {orderedPlugins.length > 0 ? (
            orderedPlugins.map((plugin) => {
              const enabled = enabledPluginIds.includes(plugin.id);
              const isSelected = selected?.id === plugin.id;
              return (
                <div
                  className={isSelected ? "plugin-manager-row plugin-manager-row--selected" : "plugin-manager-row"}
                  key={plugin.id}
                  role="option"
                  aria-selected={isSelected}
                >
                  <button
                    className="plugin-manager-row__select"
                    type="button"
                    onClick={() => setSelectedId(plugin.id)}
                  >
                    <span className="plugin-manager-row__icon">
                      <Icon name={iconForPlugin(plugin)} />
                    </span>
                    <span className="plugin-manager-row__copy">
                      <strong>{plugin.name}</strong>
                      <small>v{plugin.version}</small>
                    </span>
                    <span className={enabled ? "plugin-manager-state plugin-manager-state--enabled" : "plugin-manager-state"}>
                      {enabled ? "已启用" : "已停用"}
                    </span>
                  </button>
                  <Switch
                    className="plugin-manager-row__switch"
                    label={`${enabled ? "停用" : "启用"}${plugin.name}`}
                    checked={enabled}
                    onChange={(event) => void updateEnabled(plugin.id, event.target.checked)}
                  />
                </div>
              );
            })
          ) : (
            <div className="plugin-manager-list__empty">
              <Icon name="search" />
              <strong>没有匹配的插件</strong>
              <span>请调整搜索文字或筛选条件</span>
            </div>
          )}
        </div>
      </aside>

      {selected ? (
        <article className="plugin-manager-detail" aria-label={`${selected.name}详情`}>
          <header className="plugin-manager-identity">
            <span className="plugin-manager-identity__icon">
              <Icon name="plugin" />
            </span>
            <div className="plugin-manager-identity__copy">
              <div className="plugin-manager-title-line">
                <h2>{selected.name}</h2>
                <span>{selected.category}</span>
                <small>v{selected.version}</small>
              </div>
              <p>{selected.description}</p>
              <div className="plugin-manager-meta">
                <span>{selected.id}</span>
                <i aria-hidden="true">·</i>
                <span className="plugin-manager-meta__link">插件主页</span>
              </div>
            </div>
            <div className="plugin-manager-identity__actions">
              <Switch
                label={`${enabledPluginIds.includes(selected.id) ? "停用" : "启用"}${selected.name}`}
                checked={enabledPluginIds.includes(selected.id)}
                onChange={(event) => void updateEnabled(selected.id, event.target.checked)}
              />
              <div>
                <button
                  type="button"
                  disabled={reloadingId === selected.id || !enabledPluginIds.includes(selected.id)}
                  onClick={() => void reloadPlugin(selected.id)}
                >
                  <Icon name="refresh" className={reloadingId === selected.id ? "plugin-manager-spin" : ""} />
                  {reloadingId === selected.id ? "正在加载" : "重新加载"}
                </button>
                <button
                  className="button--danger"
                  type="button"
                  disabled={!enabledPluginIds.includes(selected.id)}
                  onClick={() => void updateEnabled(selected.id, false)}
                >
                  <Icon name="delete" />
                  禁用插件
                </button>
              </div>
            </div>
          </header>

          <nav className="plugin-manager-tabs" aria-label="插件详情分类">
            {detailTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                aria-current={detailTab === tab ? "page" : undefined}
                onClick={() => setDetailTab(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="plugin-manager-detail__content">
            {detailTab === "概览" ? (
              <PluginOverview plugin={selected} />
            ) : (
              <EmptyState
                title={`${detailTab}信息`}
                description={`此区域将显示 ${selected.name} 的${detailTab}运行信息。当前插件尚未提供相关数据。`}
              />
            )}
          </div>
        </article>
      ) : (
        <div className="plugin-manager-detail plugin-manager-detail--empty">
          <EmptyState title="请选择插件" description="从左侧列表选择一个插件以查看详情。" />
        </div>
      )}
    </section>
  );
}

function PluginOverview({ plugin }: { readonly plugin: PluginDefinition }) {
  const metrics: readonly [string, number, IconName][] = [
    ["动作", plugin.contributes.actions?.length ?? 0, "play"],
    ["页面", plugin.contributes.pages?.length ?? 0, "page"],
    ["小组件", plugin.contributes.widgets?.length ?? 0, "widgets"],
    ["服务", plugin.contributes.services?.length ?? 0, "activity"],
  ];
  const storageEstimate = plugin.permissions.length * 4 + 8;

  return (
    <section className="plugin-manager-overview" aria-label="插件概览">
      <article className="plugin-manager-contributions">
        <h3>贡献概览</h3>
        <div className="plugin-manager-metrics" aria-label="插件贡献数量">
          {metrics.map(([label, value, icon]) => (
            <div key={label}>
              <Icon name={icon} />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </article>

      <aside className="plugin-manager-facts">
        <section>
          <h3>请求的权限</h3>
          {plugin.permissions.length > 0 ? (
            <div className="plugin-manager-permissions">
              {plugin.permissions.slice(0, 4).map((permission) => (
                <div key={permission}>
                  <Icon name="shield" />
                  <span>{permission}</span>
                  <strong>必要</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="plugin-manager-facts__empty">此插件未申请主机权限。</p>
          )}
        </section>
        <section className="plugin-manager-storage">
          <h3>存储使用</h3>
          <div className="plugin-manager-storage__value">
            <Icon name="storage" />
            <strong>{storageEstimate}</strong>
            <span>MB</span>
          </div>
          <p>配置、缓存与用户数据由插件命名空间隔离。</p>
        </section>
      </aside>
    </section>
  );
}

function iconForPlugin(plugin: PluginDefinition): IconName {
  if (plugin.id.includes("audio")) return "audio";
  if (plugin.id.includes("hdr")) return "hdr";
  if (plugin.id.includes("market")) return "chart";
  if (plugin.id.includes("pomodoro")) return "timer";
  if (plugin.id.includes("sticky") || plugin.id.includes("note")) return "note";
  return "plugin";
}
