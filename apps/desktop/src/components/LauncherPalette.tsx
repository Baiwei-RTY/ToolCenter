import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";

import { pluginRegistry } from "../plugin-registry.generated";
import { buildSearchIndex, filterSearchIndex } from "../features/search/search-index";
import { useExecuteSearchItem } from "../features/search/use-execute-search-item";
import { useAppStore } from "../stores/app-store";
import { Icon } from "./Icon";

interface LauncherPaletteProps {
  readonly mode: "search" | "command";
}

export function LauncherPalette({ mode }: LauncherPaletteProps) {
  const open = useAppStore((state) =>
    mode === "search" ? state.searchOpen : state.commandPaletteOpen,
  );
  const setOpen = useAppStore((state) =>
    mode === "search" ? state.setSearchOpen : state.setCommandPaletteOpen,
  );
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const execute = useExecuteSearchItem();
  const index = useMemo(() => buildSearchIndex(pluginRegistry), []);
  const results = useMemo(() => filterSearchIndex(index, query), [index, query]);

  const runSelected = async (indexToRun: number) => {
    const item = results[indexToRun];
    if (item) {
      await execute(item);
      setOpen(false);
      setQuery("");
      setSelectedIndex(0);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="palette-overlay" />
        <Dialog.Content className="palette" aria-describedby={`${mode}-description`}>
          <Dialog.Title className="sr-only">{mode === "search" ? "全局搜索" : "命令面板"}</Dialog.Title>
          <Dialog.Description className="sr-only" id={`${mode}-description`}>
            搜索启动器页面、插件页面和操作。可以使用上下方向键选择，回车执行。
          </Dialog.Description>
          <label className="palette__input">
            <Icon name={mode === "search" ? "search" : "command"} />
            <input
              autoFocus
              aria-label={mode === "search" ? "搜索" : "搜索命令"}
              placeholder={mode === "search" ? "搜索工具、插件、页面或动作…" : "输入命令…"}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSelectedIndex((current) => Math.min(current + 1, results.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelectedIndex((current) => Math.max(current - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  void runSelected(selectedIndex);
                }
              }}
            />
            <kbd>{mode === "search" ? "Ctrl K" : "Ctrl Shift P"}</kbd>
          </label>
          <div className="palette__section-title">{query ? "搜索结果" : mode === "search" ? "最近搜索" : "最近命令"}</div>
          {results.length === 0 ? <div className="palette__empty"><Icon name="search" /><span>没有找到匹配内容</span></div> : null}
          <ul className="palette__results">
            {results.map((item, itemIndex) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={itemIndex === selectedIndex ? "true" : undefined}
                  onMouseEnter={() => setSelectedIndex(itemIndex)}
                  onClick={() => void runSelected(itemIndex)}
                >
                  <span className="palette__result-icon"><Icon name={item.kind === "action" ? "play" : item.kind === "setting" ? "settings" : item.kind === "route" ? "app" : "plugin"} /></span>
                  <span className="palette__result-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
                  <span className="palette__result-kind">{item.kind}</span>
                  <kbd>Enter</kbd>
                </button>
              </li>
            ))}
          </ul>
          <footer className="palette__footer"><span>↑↓ 选择</span><span>Enter 打开或执行</span><span>Esc 关闭</span></footer>
          <Dialog.Close asChild>
            <button className="palette__close button--icon" type="button" aria-label="关闭"><Icon name="close" /></button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
