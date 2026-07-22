import { useMemo, useState } from "react";

import { Icon } from "../components/Icon";
import { EmptyState, PageHeader, StatusBadge } from "../components/ui";
import { buildSearchIndex } from "../features/search/search-index";
import { useExecuteSearchItem } from "../features/search/use-execute-search-item";
import { pluginRegistry } from "../plugin-registry.generated";
import { requestConfirmation } from "../services/confirmations";
import { useAppStore } from "../stores/app-store";

export function RecentPage() {
  const [filter, setFilter] = useState("all");
  const recentItems = useAppStore((state) => state.recentItems);
  const removeRecent = useAppStore((state) => state.removeRecent);
  const clearRecent = useAppStore((state) => state.clearRecent);
  const index = useMemo(() => buildSearchIndex(pluginRegistry), []);
  const execute = useExecuteSearchItem();
  const filtered = recentItems.filter((item) => filter === "all" || item.kind === filter);

  return (
    <section className="page recent-page">
      <PageHeader
        title="最近使用"
        description="查看最近打开的页面和执行的操作"
        actions={<button className="button--danger" type="button" disabled={recentItems.length === 0} onClick={() => void requestConfirmation({ title: "清空最近使用记录", message: "将移除全部最近使用记录，收藏内容不会受到影响。", confirmLabel: "清空记录", cancelLabel: "取消", tone: "danger" }).then((accepted) => { if (accepted) clearRecent(); })}>清空记录</button>}
      />
      <div className="chip-row recent-filters">
        {[{ id: "all", label: "全部" }, { id: "page", label: "页面" }, { id: "action", label: "动作" }, { id: "plugin", label: "插件" }].map((item) => <button className="chip" key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="还没有最近使用记录" description="打开工具或执行动作后，会按时间显示在这里。" />
      ) : (
        <div className="surface-card recent-list">
          {filtered.map((recent, itemIndex) => {
            const item = index.find((candidate) => candidate.id === recent.id);
            return (
              <div className="recent-row" key={`${recent.id}:${recent.usedAt}`}>
                <span className={`tool-icon tool-icon--${["blue", "green", "violet", "orange"][itemIndex % 4]}`}><Icon name={recent.kind === "action" ? "play" : "app"} /></span>
                <span className="recent-row__copy"><strong>{recent.title}</strong><small>{new Date(recent.usedAt).toLocaleString("zh-CN")}</small></span>
                <StatusBadge tone="neutral">{recent.kind}</StatusBadge>
                {item ? <button className="button--secondary" type="button" onClick={() => void execute(item)}>再次使用</button> : <StatusBadge tone="warning">当前不可用</StatusBadge>}
                <button className="button--icon" type="button" aria-label={`移除 ${recent.title}`} onClick={() => removeRecent(recent.id)}><Icon name="close" /></button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
