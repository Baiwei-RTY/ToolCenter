import { Link, Outlet } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";

import { useRuntimeSnapshots } from "../hooks/use-runtime-snapshots";
import { useAppStore } from "../stores/app-store";
import { Icon } from "./Icon";
import { ConfirmationCenter } from "./ConfirmationCenter";
import { LauncherPalette } from "./LauncherPalette";
import { NotificationCenter } from "./NotificationCenter";
import { WindowControls } from "./WindowControls";

const navigation = [
  ["概览", "/", "app"],
  ["收藏", "/favorites", "favorite"],
  ["全部工具", "/tools", "grid"],
  ["最近使用", "/recent", "history"],
  ["正在运行", "/running", "play"],
  ["桌面小组件", "/widgets", "grid"],
  ["插件管理", "/plugins", "plugin"],
] as const;

export function AppShell() {
  const initialized = useAppStore((state) => state.initialized);
  const theme = useAppStore((state) => state.theme);
  const density = useAppStore((state) => state.density);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const setSearchOpen = useAppStore((state) => state.setSearchOpen);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const snapshots = useRuntimeSnapshots();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarManual, setSidebarManual] = useState(false);

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

  useEffect(() => {
    const root = document.documentElement;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      root.dataset.theme = theme === "system" ? (systemTheme.matches ? "dark" : "light") : theme;
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
        <span className="app-loading__mark"><Icon name="app" /></span>
        <strong>正在准备工具中心</strong>
        <span>加载设置与插件运行环境…</span>
      </div>
    );
  }

  return (
    <div
      className="app-shell"
      data-sidebar-collapsed={sidebarCollapsed}
      data-sidebar-manual={sidebarManual || undefined}
    >
      <header className="titlebar" data-tauri-drag-region="deep">
        <div className="titlebar__brand" data-tauri-drag-region>
          <span className="brand-mark"><Icon name="grid" /></span>
          <span>工具中心</span>
        </div>
        <div className="titlebar__history">
          <button type="button" aria-label="后退" onClick={() => window.history.back()}>
            <Icon name="back" />
          </button>
          <button type="button" aria-label="前进" onClick={() => window.history.forward()}>
            <Icon name="forward" />
          </button>
        </div>
        <button className="titlebar__search" type="button" onClick={() => setSearchOpen(true)}>
          <Icon name="search" />
          <span>搜索工具、页面或操作…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="titlebar__spacer" data-tauri-drag-region />
        <div className="titlebar__actions">
          <button className="titlebar__command" type="button" onClick={() => setCommandPaletteOpen(true)}>
            <Icon name="command" />
            <span className="titlebar-command__label">命令</span>
            <kbd>Ctrl Shift P</kbd>
          </button>
          <Link className="titlebar__activity button--icon" to="/running" aria-label="活动中心">
            <Icon name="activity" />
            {snapshots.length > 0 ? <span className="titlebar__badge">{snapshots.length}</span> : null}
          </Link>
          <Link className="titlebar__action titlebar__action--settings button--icon" to="/settings" aria-label="设置">
            <Icon name="settings" />
          </Link>
        </div>
        <WindowControls />
      </header>
      <aside className="sidebar">
        <nav aria-label="主导航">
          <ul>
            {navigation.map(([label, route, icon]) => (
              <Fragment key={route}>
                {route === "/plugins" ? <li className="sidebar__separator" aria-hidden="true" /> : null}
                <li>
                  <Link
                    className="sidebar__link"
                    to={route}
                    activeOptions={{ exact: route === "/" }}
                    title={sidebarCollapsed ? label : undefined}
                  >
                    <Icon name={icon} />
                    <span>{label}</span>
                  </Link>
                </li>
              </Fragment>
            ))}
          </ul>
        </nav>
        <footer className="sidebar__footer">
          <div className="sidebar__fixed-links">
            <Link className="sidebar__link" to="/diagnostics" title={sidebarCollapsed ? "性能与诊断" : undefined}>
              <Icon name="diagnostics" />
              <span>性能与诊断</span>
            </Link>
            <Link className="sidebar__link" to="/settings" title={sidebarCollapsed ? "设置" : undefined}>
              <Icon name="settings" />
              <span>设置</span>
            </Link>
          </div>
          <div className="sidebar__profile">
            <span className="sidebar__avatar" aria-hidden="true">T</span>
            <span className="sidebar__profile-name">Tester</span>
            <span className="sidebar__profile-badge">设计稿</span>
          </div>
          <div className="sidebar__meta">
            <span>V2.0 / Light UI Kit</span>
            <button
              className="sidebar__collapse"
              type="button"
              aria-label={sidebarCollapsed ? "展开导航" : "折叠导航"}
              onClick={() => {
                setSidebarManual(true);
                setSidebarCollapsed((current) => !current);
              }}
            >
              <Icon name={sidebarCollapsed ? "chevron-right" : "back"} />
            </button>
          </div>
        </footer>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      <LauncherPalette mode="search" />
      <LauncherPalette mode="command" />
      <ConfirmationCenter />
      <NotificationCenter />
    </div>
  );
}
