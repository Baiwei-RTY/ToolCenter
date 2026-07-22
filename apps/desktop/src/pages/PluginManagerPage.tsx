import { useMemo, useState } from "react";

import { Icon } from "../components/Icon";
import { EmptyState, PageHeader, StatusBadge, Switch } from "../components/ui";
import { pluginRegistry } from "../plugin-registry.generated";
import { pluginRuntime } from "../runtime/host";
import { notify } from "../services/notifications";
import { useAppStore } from "../stores/app-store";

const detailTabs = ["概览", "内容", "权限", "后台运行", "存储", "错误与诊断"] as const;

export function PluginManagerPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(pluginRegistry[0]?.id);
  const [detailTab, setDetailTab] = useState<(typeof detailTabs)[number]>("概览");
  const enabledPluginIds = useAppStore((state) => state.enabledPluginIds);
  const pluginOrder = useAppStore((state) => state.pluginOrder);
  const setPluginEnabled = useAppStore((state) => state.setPluginEnabled);
  const orderedPlugins = useMemo(() => [...pluginRegistry]
    .filter((plugin) => `${plugin.name} ${plugin.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((left, right) => pluginOrder.indexOf(left.id) - pluginOrder.indexOf(right.id)), [pluginOrder, query]);
  const selected = orderedPlugins.find((plugin) => plugin.id === selectedId) ?? orderedPlugins[0];

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
    try {
      await pluginRuntime.setEnabled(pluginId, false);
      await pluginRuntime.setEnabled(pluginId, true);
      notify({ title: "插件已重新加载", level: "success", pluginId });
    } catch (error) {
      notify({ title: "重新加载插件失败", message: error instanceof Error ? error.message : String(error), level: "error", pluginId });
    }
  };

  return (
    <section className="page plugin-manager-page">
      <PageHeader title="插件管理" description="管理已安装的插件、权限、运行状态和数据" />
      {pluginRegistry.length === 0 ? (
        <>
          <div className="plugin-manager-toolbar">
            <label className="search-field"><Icon name="search" /><input aria-label="搜索插件" placeholder="搜索插件名称或描述…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <button type="button"><Icon name="filter" /> 筛选</button>
          </div>
          <EmptyState title="当前没有已注册插件" description="第一版只管理随应用发布或本地注册的插件，不包含插件市场。" />
        </>
      ) : (
        <div className="plugin-manager-layout">
          <aside className="plugin-list-pane">
            <div className="plugin-manager-toolbar">
              <label className="search-field"><Icon name="search" /><input aria-label="搜索插件" placeholder="搜索插件名称或描述…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <button className="button--icon" type="button" aria-label="筛选"><Icon name="filter" /></button>
            </div>
            <p className="plugin-list-pane__count">全部插件 {orderedPlugins.length}</p>
            <div className="plugin-list">
              {orderedPlugins.map((plugin, index) => {
                const enabled = enabledPluginIds.includes(plugin.id);
                return (
                  <button
                    className="plugin-list-item"
                    key={plugin.id}
                    type="button"
                    aria-pressed={selected?.id === plugin.id}
                    onClick={() => setSelectedId(plugin.id)}
                  >
                    <span className={`tool-icon tool-icon--${["blue", "violet", "green", "orange", "pink"][index % 5]}`}><Icon name="plugin" /></span>
                    <span className="plugin-list-item__copy"><strong>{plugin.name}</strong><small>v{plugin.version}</small></span>
                    <StatusBadge tone={enabled ? "success" : "neutral"}>{enabled ? "运行中" : "已禁用"}</StatusBadge>
                    <Switch label={`${enabled ? "禁用" : "启用"}${plugin.name}`} checked={enabled} onClick={(event) => event.stopPropagation()} onChange={(event) => void updateEnabled(plugin.id, event.target.checked)} />
                    <Icon name="chevron-right" />
                  </button>
                );
              })}
            </div>
          </aside>
          {selected ? (
            <article className="surface-card plugin-detail">
              <header className="plugin-detail__header">
                <span className="tool-icon tool-icon--blue"><Icon name="plugin" /></span>
                <div className="plugin-detail__identity">
                  <div><h2>{selected.name}</h2><StatusBadge tone="info">工具</StatusBadge><span>v{selected.version}</span></div>
                  <p>{selected.description}</p>
                  <small>{selected.id} · 插件主页</small>
                </div>
                <Switch label={`${enabledPluginIds.includes(selected.id) ? "禁用" : "启用"}${selected.name}`} checked={enabledPluginIds.includes(selected.id)} onChange={(event) => void updateEnabled(selected.id, event.target.checked)} />
                <div className="plugin-detail__actions">
                  <button type="button" onClick={() => void reloadPlugin(selected.id)}><Icon name="refresh" /> 重新加载</button>
                  <button className="button--danger" type="button" onClick={() => void updateEnabled(selected.id, false)}><Icon name="close" /> 禁用插件</button>
                </div>
              </header>
              <nav className="detail-tabs" aria-label="插件详情分类">
                {detailTabs.map((tab) => <button key={tab} type="button" aria-current={detailTab === tab ? "page" : undefined} onClick={() => setDetailTab(tab)}>{tab}</button>)}
              </nav>
              {detailTab === "概览" ? (
                <div className="plugin-detail__content">
                  <section className="surface-card plugin-overview-card">
                    <h3>插件概览</h3>
                    <div className="metric-grid">
                      <div><small>动作</small><strong>{selected.contributes.actions?.length ?? 0}</strong><Icon name="play" /></div>
                      <div><small>页面</small><strong>{selected.contributes.pages?.length ?? 0}</strong><Icon name="app" /></div>
                      <div><small>小组件</small><strong>{selected.contributes.widgets?.length ?? 0}</strong><Icon name="grid" /></div>
                      <div><small>服务</small><strong>{selected.contributes.services?.length ?? 0}</strong><Icon name="activity" /></div>
                    </div>
                  </section>
                  <section className="surface-card permission-summary">
                    <h3>请求的权限</h3>
                    {selected.permissions.length > 0 ? selected.permissions.slice(0, 4).map((permission) => <div key={permission}><Icon name="shield" /><span>{permission}</span><small>必要</small></div>) : <p>此插件未申请主机权限。</p>}
                  </section>
                  <section className="surface-card storage-summary">
                    <h3>存储使用</h3>
                    <div className="storage-summary__graphic"><Icon name="diagnostics" /><span>{selected.permissions.length * 4 + 8}<small>MB</small></span></div>
                    <p>配置、缓存与用户数据由插件命名空间隔离。</p>
                  </section>
                </div>
              ) : (
                <EmptyState title={`${detailTab}信息`} description={`此区域将显示 ${selected.name} 的${detailTab}运行信息。当前插件尚未提供相关数据。`} />
              )}
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}
