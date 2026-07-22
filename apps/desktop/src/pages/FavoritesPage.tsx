import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { Icon } from "../components/Icon";
import { EmptyState, PageHeader, StatusBadge } from "../components/ui";
import { buildSearchIndex } from "../features/search/search-index";
import { useExecuteSearchItem } from "../features/search/use-execute-search-item";
import { pluginRegistry } from "../plugin-registry.generated";
import { useAppStore } from "../stores/app-store";

export function FavoritesPage() {
  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const execute = useExecuteSearchItem();
  const index = useMemo(() => buildSearchIndex(pluginRegistry), []);
  const favorites = favoriteIds.map((id) => index.find((item) => item.id === id)).filter((item) => item !== undefined);

  return (
    <section className="page collection-page">
      <PageHeader title="收藏" description="集中管理常用页面、操作和插件入口" />
      {favorites.length === 0 ? (
        <EmptyState title="还没有收藏内容" description="在全部工具或搜索结果中点击收藏，即可把常用功能固定到这里。" action={<Link className="button-link button-link--primary" to="/tools">浏览全部工具</Link>} />
      ) : (
        <div className="collection-grid">
          {favorites.map((item, index) => (
            <article className="surface-card collection-card" key={item.id}>
              <span className={`tool-icon tool-icon--${["green", "blue", "violet", "orange"][index % 4]}`}><Icon name={item.kind === "action" ? "play" : "app"} /></span>
              <div><h2>{item.title}</h2><p>{item.description}</p><StatusBadge tone="neutral">{item.kind}</StatusBadge></div>
              <button className="button--secondary" type="button" onClick={() => void execute(item)}>打开</button>
              <button className="button--icon" type="button" aria-label={`取消收藏 ${item.title}`} onClick={() => toggleFavorite(item.id)}><Icon name="favorite-filled" /></button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

