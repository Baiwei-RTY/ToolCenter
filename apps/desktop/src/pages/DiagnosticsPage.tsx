import { useEffect, useState } from "react";

import { Icon } from "../components/Icon";
import { PageHeader, SectionHeading, StatusBadge } from "../components/ui";
import { useRuntimeSnapshots } from "../hooks/use-runtime-snapshots";
import { hostBridge, sharedScheduler } from "../runtime/host";

interface HostDiagnostics { readonly platform: string; readonly architecture: string; readonly appVersion: string; readonly processId?: number; }
interface LogRecord { readonly timestamp?: string; readonly level?: string; readonly pluginId?: string; readonly message?: string; }

export function DiagnosticsPage() {
  const snapshots = useRuntimeSnapshots();
  const [host, setHost] = useState<HostDiagnostics | null>(null);
  const [logs, setLogs] = useState<readonly LogRecord[]>([]);
  const scheduler = sharedScheduler.diagnostics();

  const refresh = async () => {
    const [hostResult, logResult] = await Promise.all([hostBridge.invoke<HostDiagnostics>("diagnostics_get"), hostBridge.invoke<readonly LogRecord[]>("log_list", { limit: 200 })]);
    setHost(hostResult); setLogs(logResult);
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all([hostBridge.invoke<HostDiagnostics>("diagnostics_get"), hostBridge.invoke<readonly LogRecord[]>("log_list", { limit: 200 })]).then(([hostResult, logResult]) => { if (!cancelled) { setHost(hostResult); setLogs(logResult); } });
    return () => { cancelled = true; };
  }, []);

  const metrics = [
    ["平台", host?.platform ?? "读取中"], ["架构", host?.architecture ?? "读取中"], ["应用版本", host?.appVersion ?? "读取中"], ["进程 ID", String(host?.processId ?? "未提供")],
    ["活动插件入口", String(snapshots.length)], ["活动调度任务", String(scheduler.activeRegistrations)], ["WebView 数量", "1"], ["最近日志", String(logs.length)],
  ];

  return (
    <section className="page diagnostics-page">
      <PageHeader title="性能与诊断" description="查看启动器运行环境、调度任务和最近日志" actions={<button className="button--secondary" type="button" onClick={() => void refresh()}><Icon name="refresh" /> 刷新数据</button>} />
      <div className="diagnostic-metrics">{metrics.map(([label, value]) => <article className="surface-card" key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
      <div className="diagnostic-grid">
        <article className="surface-card diagnostic-panel"><SectionHeading title="调度任务" description="由插件运行时集中管理的周期任务" />{scheduler.registrations.length === 0 ? <div className="diagnostic-empty"><Icon name="check" /> 没有活动调度任务</div> : scheduler.registrations.map((item) => <div className="diagnostic-row" key={`${item.ownerId}:${item.id}`}><span><strong>{item.id}</strong><small>{item.ownerId}</small></span><StatusBadge tone={item.failures > 0 ? "warning" : "success"}>{item.intervalMs} ms</StatusBadge></div>)}</article>
        <article className="surface-card diagnostic-panel"><SectionHeading title="最近日志" description="最多显示最近 200 条主程序和插件日志" />{logs.length === 0 ? <div className="diagnostic-empty"><Icon name="info" /> 暂无日志</div> : <div className="log-list">{logs.slice(0, 30).map((log, index) => <div className="log-row" key={`${log.timestamp ?? "log"}:${index}`}><time>{log.timestamp ?? ""}</time><StatusBadge tone={log.level === "error" ? "error" : log.level === "warn" ? "warning" : "neutral"}>{log.level ?? "info"}</StatusBadge><span>{log.pluginId ?? "launcher"}</span><code>{log.message ?? JSON.stringify(log)}</code></div>)}</div>}</article>
      </div>
    </section>
  );
}
