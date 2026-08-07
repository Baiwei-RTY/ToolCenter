import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";

import { Icon } from "../components/Icon";
import { PageHeader, StatusBadge, Switch } from "../components/ui";
import { hostBridge } from "../runtime/host";
import { notify } from "../services/notifications";
import { useAppStore } from "../stores/app-store";

type PermissionRecords = Readonly<Record<string, Readonly<Record<string, string>>>>;
type SettingsSection = "常规" | "外观" | "快捷键" | "权限与隐私" | "数据与存储" | "更新" | "关于";

const sections: readonly { label: SettingsSection; icon: "app" | "settings" | "command" | "shield" | "diagnostics" | "refresh" | "info" }[] = [
  { label: "常规", icon: "app" },
  { label: "外观", icon: "settings" },
  { label: "快捷键", icon: "command" },
  { label: "权限与隐私", icon: "shield" },
  { label: "数据与存储", icon: "diagnostics" },
  { label: "更新", icon: "refresh" },
  { label: "关于", icon: "info" },
];

export function SettingsPage() {
  const state = useAppStore();
  const [activeSection, setActiveSection] = useState<SettingsSection>("常规");
  const [permissions, setPermissions] = useState<PermissionRecords>({});

  const refreshPermissions = async () => {
    try {
      setPermissions(await hostBridge.invoke<PermissionRecords>("permissions_list"));
    } catch (error) {
      notify({ title: "读取权限记录失败", message: error instanceof Error ? error.message : String(error), level: "error" });
    }
  };

  const revokePermission = async (pluginId: string, permission: string) => {
    await hostBridge.invoke("permission_set", { pluginId, permission, decision: "prompt" });
    await refreshPermissions();
  };

  return (
    <section className="page settings-page">
      <PageHeader title="设置" description="自定义工具中心的行为和外观" />
      <div className="settings-layout">
        <nav className="surface-card settings-nav" aria-label="设置分类">
          {sections.map((section) => (
            <button key={section.label} type="button" aria-current={activeSection === section.label ? "page" : undefined} onClick={() => setActiveSection(section.label)}>
              <Icon name={section.icon} /><span>{section.label}</span>
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {activeSection === "常规" ? (
            <section className="surface-card settings-group">
              <h2>启动与行为</h2>
              <SettingsRow title="启动后的默认页面" description="选择工具中心启动后默认显示的页面">
                <select value={state.defaultRoute} onChange={(event) => state.updateSettings({ defaultRoute: event.target.value })}>
                  <option value="/">概览页</option><option value="/tools">全部工具</option><option value="/favorites">收藏</option>
                </select>
              </SettingsRow>
              <SettingsRow title="关闭窗口时的行为" description="关闭主窗口时是否最小化到系统托盘">
                <select value={state.closeBehavior} onChange={(event) => state.updateSettings({ closeBehavior: event.target.value === "tray" ? "tray" : "close" })}>
                  <option value="close">退出程序</option><option value="tray">最小化到系统托盘</option>
                </select>
              </SettingsRow>
              <SettingsRow title="是否显示系统托盘" description="在系统托盘显示工具中心图标"><Switch label="显示系统托盘" checked={state.showTray} onChange={(event) => state.updateSettings({ showTray: event.target.checked })} /></SettingsRow>
              <SettingsRow title="恢复上次窗口位置和大小" description="启动时恢复上次关闭时的窗口位置和大小"><Switch label="恢复窗口状态" checked={state.restoreWindow} onChange={(event) => state.updateSettings({ restoreWindow: event.target.checked })} /></SettingsRow>
            </section>
          ) : null}

          {activeSection === "外观" || activeSection === "常规" ? (
            <section className="surface-card settings-group">
              <h2>外观</h2>
              <div className="theme-options" role="radiogroup" aria-label="主题模式">
                {(["system", "light", "dark"] as const).map((theme) => (
                  <button key={theme} type="button" role="radio" aria-checked={state.theme === theme} onClick={() => state.updateSettings({ theme })}>
                    <Icon name={theme === "dark" ? "dark" : theme === "light" ? "weather" : "settings"} />
                    <span>{theme === "system" ? "跟随系统" : theme === "light" ? "浅色" : "深色"}</span>
                    {state.theme === theme ? <Icon name="check" /> : null}
                  </button>
                ))}
              </div>
              <SettingsRow title="减少动态效果" description="关闭页面切换、展开和浮层的非必要动画"><Switch label="减少动态效果" checked={state.reducedMotion} onChange={(event) => state.updateSettings({ reducedMotion: event.target.checked })} /></SettingsRow>
              <SettingsRow title="界面显示密度" description="标准密度为推荐的桌面端信息密度">
                <select value={state.density} onChange={(event) => state.updateSettings({ density: event.target.value === "compact" ? "compact" : "standard" })}><option value="standard">标准</option><option value="compact">紧凑</option></select>
              </SettingsRow>
            </section>
          ) : null}

          {activeSection === "快捷键" ? (
            <section className="surface-card settings-group">
              <h2>快捷键</h2>
              <SettingsRow title="打开全局搜索" description="从启动器任意页面打开搜索"><kbd>Ctrl K</kbd></SettingsRow>
              <SettingsRow title="打开命令面板" description="搜索并执行启动器命令"><kbd>Ctrl Shift P</kbd></SettingsRow>
              <p className="settings-note">全局系统快捷键注册将在托盘与后台驻留功能接入后开放。</p>
            </section>
          ) : null}

          {activeSection === "权限与隐私" ? (
            <section className="surface-card settings-group">
              <header className="settings-group__header"><div><h2>权限与隐私</h2><p>查看并撤销插件的主机权限决定</p></div><button type="button" onClick={() => void refreshPermissions()}><Icon name="refresh" /> 刷新权限记录</button></header>
              {Object.keys(permissions).length === 0 ? <div className="settings-empty"><Icon name="shield" /><span>当前没有已记录的插件权限</span></div> : null}
              {Object.entries(permissions).map(([pluginId, records]) => (
                <section className="permission-record" key={pluginId}><h3>{pluginId}</h3>{Object.entries(records).map(([permission, decision]) => <div key={permission}><span>{permission}</span><StatusBadge tone={decision === "allow" ? "success" : decision === "deny" ? "error" : "warning"}>{decision}</StatusBadge><button className="button--text" type="button" onClick={() => void revokePermission(pluginId, permission)}>撤销</button></div>)}</section>
              ))}
            </section>
          ) : null}

          {activeSection === "数据与存储" ? (
            <section className="surface-card settings-group">
              <h2>数据与存储</h2>
              <SettingsRow title="插件隔离存储" description="每个插件的数据、缓存和日志都保存在独立命名空间"><StatusBadge tone="success">已启用</StatusBadge></SettingsRow>
              <SettingsRow title="性能与诊断" description="查看运行环境、调度任务和最近日志"><Link className="button-link" to="/diagnostics">打开诊断</Link></SettingsRow>
            </section>
          ) : null}

          {activeSection === "更新" ? (
            <section className="surface-card settings-group"><h2>更新</h2><SettingsRow title="当前版本" description="ToolCenter 开发版本"><StatusBadge tone="info">v0.1.0</StatusBadge></SettingsRow><p className="settings-note">自动更新服务尚未接入；本地开发构建不会主动下载或安装更新。</p></section>
          ) : null}

          {activeSection === "关于" ? (
            <section className="surface-card settings-group about-panel"><span className="brand-mark"><Icon name="grid" /></span><div><h2>工具中心</h2><p>轻量化桌面插件启动器与工程底座</p><StatusBadge tone="info">v0.1.0</StatusBadge></div></section>
          ) : null}
          <footer className="settings-shortcut-footer"><span>快捷键 · Ctrl+K 全局搜索 · Ctrl+Shift+P 命令面板</span><button className="button--text" type="button" onClick={() => setActiveSection("快捷键")}>管理快捷键</button></footer>
        </div>
      </div>
    </section>
  );
}

function SettingsRow({ title, description, children }: { readonly title: string; readonly description: string; readonly children: ReactNode }) {
  return <div className="settings-row"><div><strong>{title}</strong><span>{description}</span></div><div className="settings-row__control">{children}</div></div>;
}
