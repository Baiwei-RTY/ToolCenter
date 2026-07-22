import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { buildSearchIndex } from "../features/search/search-index";
import { useExecuteSearchItem } from "../features/search/use-execute-search-item";
import { useRuntimeSnapshots } from "../hooks/use-runtime-snapshots";
import { pluginRegistry } from "../plugin-registry.generated";
import { useAppStore } from "../stores/app-store";
import { Icon } from "../components/Icon";
import { InlineBanner, SectionHeading, StatusBadge } from "../components/ui";

const quickActions = [
  { label: "全局搜索", icon: "search" as const, action: "search" as const, color: "blue" },
  { label: "命令面板", icon: "command" as const, action: "command" as const, color: "green" },
  { label: "收藏", icon: "favorite" as const, route: "/favorites", color: "purple" },
  { label: "正在运行", icon: "play" as const, route: "/running", color: "orange" },
  { label: "全部工具", icon: "grid" as const, route: "/tools", color: "violet" },
] as const;

export function OverviewPage() {
  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const recentItems = useAppStore((state) => state.recentItems);
  const setSearchOpen = useAppStore((state) => state.setSearchOpen);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const snapshots = useRuntimeSnapshots();
  const execute = useExecuteSearchItem();
  const searchIndex = useMemo(() => buildSearchIndex(pluginRegistry), []);
  const favorites = searchIndex.filter((item) => favoriteIds.includes(item.id));
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好";
  const dateLabel = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <section className="page overview-page">
      <header className="overview-page__title"><h1>概览</h1></header>

      <div className="overview-hero-grid">
        <article className="surface-card welcome-card">
          <span className="welcome-card__sun" aria-hidden="true"><Icon name="weather" /></span>
          <div>
            <h2>{greeting}，Tester!</h2>
            <p>今天是 {dateLabel}</p>
            <span>今天也保持专注，按自己的节奏工作。</span>
          </div>
        </article>
        <article className="surface-card quick-actions">
          <SectionHeading title="快速操作" description="高频动作一键执行" />
          <div className="quick-actions__grid">
            {quickActions.map((item) =>
              "route" in item ? (
                <Link className={`quick-action quick-action--${item.color}`} key={item.label} to={item.route}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <button
                  className={`quick-action quick-action--${item.color}`}
                  key={item.label}
                  type="button"
                  onClick={() => item.action === "search" ? setSearchOpen(true) : setCommandPaletteOpen(true)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              ),
            )}
          </div>
        </article>
      </div>

      <div className="overview-dashboard">
        <div className="overview-dashboard__main">
          <article className="surface-card overview-panel">
            <SectionHeading
              title="收藏的快捷操作"
              description="最多显示 6 项，可在“管理收藏”中调整"
              action={<Link className="text-link" to="/favorites">管理收藏</Link>}
            />
            {favorites.length > 0 ? (
              <div className="favorite-grid">
                {favorites.slice(0, 6).map((item, index) => (
                  <button className="favorite-tile" key={item.id} type="button" onClick={() => void execute(item)}>
                    <span className={`tool-icon tool-icon--${["green", "blue", "violet", "teal", "orange", "purple"][index % 6]}`}>
                      <Icon name={item.kind === "action" ? "play" : item.kind === "setting" ? "settings" : "app"} />
                    </span>
                    <span><strong>{item.title}</strong><small>{item.description}</small></span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="compact-empty">
                <Icon name="favorite" />
                <span><strong>还没有收藏</strong><small>在全部工具或搜索结果中收藏常用功能</small></span>
                <Link className="text-link" to="/tools">浏览工具</Link>
              </div>
            )}
          </article>

          <article className="surface-card overview-panel running-preview">
            <SectionHeading
              title="正在执行"
              description="后台任务和服务的实时状态"
              action={<Link className="text-link" to="/running">查看全部</Link>}
            />
            {snapshots.length > 0 ? (
              <div className="running-preview__list">
                {snapshots.slice(0, 3).map((snapshot, index) => (
                  <div className="running-preview__item" key={`${snapshot.pluginId}:${snapshot.entrypoint}`}>
                    <span className="running-preview__name"><Icon name="play" /> {snapshot.pluginId}</span>
                    <div className="progress"><span style={{ width: `${[68, 42, 71][index % 3]}%` }} /></div>
                    <StatusBadge tone={snapshot.state.endsWith("failed") ? "error" : "info"}>{snapshot.state}</StatusBadge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="compact-empty compact-empty--center">
                <Icon name="check" />
                <span><strong>当前没有运行任务</strong><small>启动工具或后台服务后会在这里显示</small></span>
              </div>
            )}
          </article>
        </div>

        <div className="overview-dashboard__side">
          <article className="surface-card overview-panel recent-preview">
            <SectionHeading
              title="最近使用"
              description="再次打开最近访问的内容"
              action={<Link className="text-link" to="/recent">查看全部</Link>}
            />
            {recentItems.length > 0 ? (
              <ul>
                {recentItems.slice(0, 5).map((item, index) => (
                  <li key={`${item.id}:${item.usedAt}`}>
                    <span className={`tool-icon tool-icon--${["blue", "charcoal", "green", "teal", "orange"][index % 5]}`}>
                      <Icon name="app" />
                    </span>
                    <span><strong>{item.title}</strong><small>{item.kind}</small></span>
                    <time>{new Date(item.usedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="compact-empty compact-empty--vertical">
                <Icon name="history" />
                <span><strong>暂无最近记录</strong><small>使用工具后会自动记录</small></span>
              </div>
            )}
          </article>
          <article className="surface-card overview-panel needs-attention">
            <SectionHeading title="需要处理" description="高优先级提醒" />
            {pluginRegistry.length === 0 ? (
              <InlineBanner
                tone="info"
                title="等待添加插件"
                description="启动器底座已就绪，可按开发规范接入首个插件。"
                action={<Link className="text-link" to="/plugins">查看</Link>}
              />
            ) : (
              <InlineBanner tone="success" title="状态正常" description="当前没有需要处理的事项。" />
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
