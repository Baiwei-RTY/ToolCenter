import { useMemo, useState } from "react";

import { Icon } from "../components/Icon";
import { EmptyState, PageHeader, StatusBadge, Switch } from "../components/ui";
import type { SearchItem } from "../features/search/search-index";
import { useExecuteSearchItem } from "../features/search/use-execute-search-item";
import { pluginRegistry } from "../plugin-registry.generated";
import { pluginRuntime } from "../runtime/host";
import { notify } from "../services/notifications";
import { useAppStore } from "../stores/app-store";

export function ToolsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const enabledPluginIds = useAppStore((state) => state.enabledPluginIds);
  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const pluginOrder = useAppStore((state) => state.pluginOrder);
  const setPluginEnabled = useAppStore((state) => state.setPluginEnabled);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const execute = useExecuteSearchItem();

  const plugins = useMemo(() => {
    const order = new Map(pluginOrder.map((id, index) => [id, index]));
    return [...pluginRegistry]
      .filter((plugin) => category === "all" || plugin.category === category)
      .filter((plugin) => status === "all" || (status === "enabled") === enabledPluginIds.includes(plugin.id))
      .filter((plugin) =>
        `${plugin.name} ${plugin.description} ${plugin.category}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
      )
      .sort((left, right) => (order.get(left.id) ?? 9999) - (order.get(right.id) ?? 9999));
  }, [category, enabledPluginIds, pluginOrder, query, status]);
  const categories = [...new Set(pluginRegistry.map((plugin) => plugin.category))];

  const updateEnabled = (pluginId: string, enabled: boolean) => {
    setPluginEnabled(pluginId, enabled);
    void pluginRuntime.setEnabled(pluginId, enabled).catch((error: unknown) =>
      notify({
        title: "插件状态更新失败",
        message: error instanceof Error ? error.message : String(error),
        level: "error",
        pluginId,
      }),
    );
  };

  return (
    <section className="page tools-page">
      <PageHeader title="全部工具" description="浏览、管理和使用所有可用工具" />
      <div className="surface-card tool-toolbar">
        <label className="search-field tool-toolbar__search">
          <Icon name="search" />
          <input
            aria-label="搜索工具"
            placeholder="搜索工具名称或描述…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select aria-label="启用状态" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
        </select>
        <select aria-label="排序方式" defaultValue="name">
          <option value="name">名称 A-Z</option>
          <option value="order">插件顺序</option>
        </select>
        <div className="tool-toolbar__views" aria-label="视图切换">
          <button className="button--icon" type="button" aria-label="网格视图" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Icon name="grid" /></button>
          <button className="button--icon" type="button" aria-label="列表视图" aria-pressed={view === "list"} onClick={() => setView("list")}><Icon name="list" /></button>
        </div>
        <div className="chip-row tool-toolbar__chips">
          <button className="chip" type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>全部</button>
          {categories.map((item) => (
            <button className="chip" key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
      </div>

      {plugins.length === 0 ? (
        <EmptyState
          title={pluginRegistry.length === 0 ? "还没有可用工具" : "没有找到匹配结果"}
          description={pluginRegistry.length === 0 ? "安装或注册插件后，插件提供的页面和动作会显示在这里。" : "请尝试清除筛选条件或更换搜索关键词。"}
          action={query || category !== "all" || status !== "all" ? <button className="button--secondary" type="button" onClick={() => { setQuery(""); setCategory("all"); setStatus("all"); }}>清除筛选</button> : undefined}
        />
      ) : (
        <div className={view === "grid" ? "tool-grid" : "tool-list"}>
          {plugins.map((plugin, index) => {
            const item: SearchItem = {
              id: `plugin:${plugin.id}`,
              title: plugin.name,
              description: plugin.description,
              kind: "plugin",
              pluginId: plugin.id,
              keywords: [plugin.category],
            };
            const enabled = enabledPluginIds.includes(plugin.id);
            const favorite = favoriteIds.includes(item.id);
            const type = (plugin.contributes.pages?.length ?? 0) > 0 ? "页面" : "动作";
            return (
              <article className="tool-card" key={plugin.id}>
                <div className="tool-card__top">
                  <span className={`tool-icon tool-icon--${["green", "blue", "violet", "orange"][index % 4]}`}><Icon name={type === "页面" ? "app" : "play"} /></span>
                  <button className="favorite-button" type="button" aria-label={favorite ? "取消收藏" : "收藏"} onClick={() => toggleFavorite(item.id)}>
                    <Icon name={favorite ? "favorite-filled" : "favorite"} />
                  </button>
                </div>
                <div className="tool-card__copy">
                  <h2>{plugin.name}</h2>
                  <p>{plugin.description}</p>
                </div>
                <div className="tool-card__meta">
                  <StatusBadge tone="neutral">{plugin.category}</StatusBadge>
                  <StatusBadge tone="neutral">{type}</StatusBadge>
                </div>
                <div className="tool-card__footer">
                  <StatusBadge tone={enabled ? "success" : "neutral"}>{enabled ? "✓ 已启用" : "○ 已禁用"}</StatusBadge>
                  <Switch label={`${enabled ? "禁用" : "启用"}${plugin.name}`} checked={enabled} onChange={(event) => updateEnabled(plugin.id, event.target.checked)} />
                  <button className="button--secondary" type="button" disabled={!enabled} onClick={() => void execute(item)}>打开</button>
                  <button className="button--icon" type="button" aria-label={`${plugin.name}更多操作`}><Icon name="more" /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

