import type { PluginDefinition } from "@tool-center/plugin-contract";

export type SearchItemKind = "plugin" | "page" | "action" | "setting" | "route";

export interface SearchItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kind: SearchItemKind;
  readonly pluginId?: string;
  readonly actionId?: string;
  readonly pageId?: string;
  readonly route?: string;
  readonly keywords: readonly string[];
}

const launcherItems: readonly SearchItem[] = [
  launcherRoute("launcher.overview", "概览", "查看收藏、最近使用和运行状态", "/"),
  launcherRoute("launcher.tools", "全部工具", "浏览所有已注册插件", "/tools"),
  launcherRoute("launcher.favorites", "收藏", "查看收藏的操作和页面", "/favorites"),
  launcherRoute("launcher.recent", "最近使用", "查看最近打开和执行的功能", "/recent"),
  launcherRoute("launcher.running", "正在运行", "查看任务、服务和插件运行状态", "/running"),
  launcherRoute("launcher.widgets", "桌面小组件", "添加和管理桌面小组件实例", "/widgets"),
  launcherRoute("launcher.plugins", "插件管理", "启用、禁用和排序插件", "/plugins"),
  launcherRoute("launcher.settings", "设置", "修改启动器设置", "/settings"),
  launcherRoute("launcher.diagnostics", "性能与诊断", "查看调度器、插件状态和日志", "/diagnostics"),
];

export function buildSearchIndex(registry: readonly PluginDefinition[]): readonly SearchItem[] {
  const items = [...launcherItems];
  for (const plugin of registry) {
    items.push({
      id: `plugin:${plugin.id}`,
      title: plugin.name,
      description: plugin.description,
      kind: "plugin",
      pluginId: plugin.id,
      keywords: [plugin.category, plugin.id],
    });
    for (const page of plugin.contributes.pages ?? []) {
      items.push({
        id: `page:${plugin.id}:${page.id}`,
        title: page.title,
        description: plugin.name,
        kind: "page",
        pluginId: plugin.id,
        pageId: page.id,
        route: `/plugin/${encodeURIComponent(plugin.id)}/${encodeURIComponent(page.id)}`,
        keywords: [plugin.name, plugin.category, page.route],
      });
    }
    for (const action of plugin.contributes.actions ?? []) {
      items.push({
        id: `action:${plugin.id}:${action.id}`,
        title: action.title,
        description: action.description ?? plugin.name,
        kind: "action",
        pluginId: plugin.id,
        actionId: action.id,
        keywords: [plugin.name, plugin.category],
      });
    }
  }
  return items;
}

export function filterSearchIndex(
  index: readonly SearchItem[],
  query: string,
): readonly SearchItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.length === 0) {
    return index.slice(0, 20);
  }
  return index
    .map((item) => ({ item, score: scoreItem(item, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title))
    .slice(0, 50)
    .map((entry) => entry.item);
}

function launcherRoute(id: string, title: string, description: string, route: string): SearchItem {
  return { id, title, description, route, kind: "route", keywords: [] };
}

function scoreItem(item: SearchItem, query: string): number {
  const title = item.title.toLocaleLowerCase();
  const searchable = [item.title, item.description, ...item.keywords].join(" ").toLocaleLowerCase();
  if (title === query) return 100;
  if (title.startsWith(query)) return 75;
  if (title.includes(query)) return 50;
  return searchable.includes(query) ? 20 : 0;
}
