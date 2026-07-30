import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef } from "react";

import { useAppStore } from "../stores/app-store";
import { Icon } from "./Icon";
import { ConfirmationCenter } from "./ConfirmationCenter";
import { LauncherPalette } from "./LauncherPalette";
import { NotificationCenter } from "./NotificationCenter";
import { WindowControls } from "./WindowControls";

const navigation = [
  ["工具", "/tools", "tools"],
  ["小组件", "/widgets", "widgets"],
  ["插件", "/plugins", "plugin"],
  ["运行", "/running", "play"],
  ["设置", "/settings", "settings"],
] as const;

export function AppShell() {
  const initialized = useAppStore((state) => state.initialized);
  const theme = useAppStore((state) => state.theme);
  const density = useAppStore((state) => state.density);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const setSearchOpen = useAppStore((state) => state.setSearchOpen);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const location = useLocation();
  const contentRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
      contentRef.current.scrollLeft = 0;
    }
  }, [location.pathname]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLocaleLowerCase() === "p") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [setCommandPaletteOpen, setSearchOpen]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = theme === "system" ? (systemTheme.matches ? "dark" : "light") : theme;
      root.dataset.theme = resolvedTheme;
      root.classList.toggle("mdui-theme-dark", resolvedTheme === "dark");
      root.classList.toggle("mdui-theme-light", resolvedTheme === "light");
    };
    applyTheme();
    systemTheme.addEventListener("change", applyTheme);
    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [density, reducedMotion]);

  if (!initialized) {
    return (
      <div className="app-loading" role="status">
        <span className="app-loading__mark"><Icon name="brand" /></span>
        <strong>正在准备工具中心</strong>
        <span>加载设置与插件运行环境…</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="titlebar" data-tauri-drag-region="deep">
        <Link className="titlebar__logo" to="/" aria-label="打开概览">
          <span className="brand-mark"><Icon name="brand" /></span>
        </Link>
        <div className="titlebar__brand" data-tauri-drag-region>
          <strong>ToolCenter</strong>
          <button type="button" aria-label="后退" onClick={() => window.history.back()}>
            <Icon name="back" />
          </button>
        </div>
        <div className="titlebar__spacer" data-tauri-drag-region />
        <div className="titlebar__actions">
          <button className="button--icon" type="button" aria-label="全局搜索" onClick={() => setSearchOpen(true)}>
            <Icon name="search" />
          </button>
          <button className="button--icon" type="button" aria-label="命令面板" onClick={() => setCommandPaletteOpen(true)}>
            <Icon name="command" />
          </button>
          <span className="titlebar__divider" aria-hidden="true" />
        </div>
        <WindowControls />
      </header>
      <aside className="sidebar">
        <nav aria-label="主导航">
          <ul>
            {navigation.map(([label, route, icon]) => (
              <li key={route}>
                <Link className="sidebar__link" to={route}>
                  <span className="sidebar__icon"><Icon name={icon} /></span>
                  <span>{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <footer className="sidebar__footer">
          <Link className="sidebar__link" to="/diagnostics">
            <span className="sidebar__icon"><Icon name="help" /></span>
            <span>帮助</span>
          </Link>
        </footer>
      </aside>
      <main className="content" ref={contentRef}>
        <Outlet />
      </main>
      <LauncherPalette mode="search" />
      <LauncherPalette mode="command" />
      <ConfirmationCenter />
      <NotificationCenter />
    </div>
  );
}
