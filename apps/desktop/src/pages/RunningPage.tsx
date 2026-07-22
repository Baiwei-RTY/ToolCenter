import type { PluginEntrypointKind } from "@tool-center/plugin-contract";
import { useState } from "react";

import { Icon } from "../components/Icon";
import { EmptyState, PageHeader, SectionHeading, StatusBadge } from "../components/ui";
import { useRuntimeSnapshots } from "../hooks/use-runtime-snapshots";
import { pluginRuntime } from "../runtime/host";
import { notify } from "../services/notifications";

const tabs = ["当前任务", "后台服务", "最近完成"] as const;

export function RunningPage() {
  const snapshots = useRuntimeSnapshots();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("当前任务");
  const tasks = snapshots.filter((snapshot) => snapshot.entrypoint !== "service");
  const services = snapshots.filter((snapshot) => snapshot.entrypoint === "service");

  const stop = async (pluginId: string, entrypoint: PluginEntrypointKind) => {
    try {
      await pluginRuntime.deactivate(pluginId, entrypoint);
    } catch (error) {
      notify({
        title: "停止插件失败",
        message: error instanceof Error ? error.message : String(error),
        level: "error",
        pluginId,
      });
    }
  };

  return (
    <section className="page running-page">
      <PageHeader title="正在运行" description="查看当前正在运行的任务和后台服务状态" />
      <div className="segmented-control running-tabs" role="tablist" aria-label="运行状态分类">
        {tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </div>

      {activeTab === "当前任务" ? (
        <div className="running-layout">
          <article className="surface-card task-panel">
            <SectionHeading title={`当前任务（${tasks.length}）`} description="任务执行中可取消，也可以打开错误详情" />
            {tasks.length === 0 ? (
              <EmptyState title="当前没有运行任务" description="执行插件动作或打开需要持续处理的页面后，任务会显示在这里。" />
            ) : (
              <div className="task-list">
                {tasks.map((snapshot, index) => {
                  const progress = [68, 42, 75, 18][index % 4];
                  return (
                    <div className="task-row" key={`${snapshot.pluginId}:${snapshot.entrypoint}`}>
                      <span className={`task-row__icon tool-icon--${["blue", "green", "violet", "teal"][index % 4]}`}><Icon name="play" /></span>
                      <span className="task-row__identity"><strong>{snapshot.pluginId}</strong><small>来源：{snapshot.entrypoint}</small></span>
                      <span className="task-row__status">{snapshot.state === "active" ? "正在执行…" : snapshot.state}</span>
                      <div className="progress"><span style={{ width: `${progress}%` }} /></div>
                      <span className="task-row__percent">{progress}%</span>
                      <button type="button" disabled={snapshot.state === "disposing"} onClick={() => void stop(snapshot.pluginId, snapshot.entrypoint)}>取消</button>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
          <article className="surface-card service-panel">
            <SectionHeading title={`后台服务（${services.length}）`} description="持续运行的插件服务" />
            {services.length === 0 ? (
              <div className="compact-empty compact-empty--vertical"><Icon name="activity" /><span><strong>没有后台服务</strong><small>已启用服务会在这里显示</small></span></div>
            ) : (
              <div className="service-list">
                {services.map((snapshot) => (
                  <div className="service-row" key={`${snapshot.pluginId}:${snapshot.entrypoint}`}>
                    <Icon name="activity" />
                    <span><strong>{snapshot.pluginId}</strong><StatusBadge tone={snapshot.state.endsWith("failed") ? "error" : "success"}>{snapshot.state === "active" ? "运行中" : snapshot.state}</StatusBadge></span>
                    <button type="button"><Icon name="refresh" /> 重启</button>
                    <button type="button" onClick={() => void stop(snapshot.pluginId, snapshot.entrypoint)}>停止</button>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : activeTab === "后台服务" ? (
        <article className="surface-card full-list-panel">
          <SectionHeading title={`后台服务（${services.length}）`} description="可在此重新启动或停止后台服务" />
          {services.length === 0 ? <EmptyState title="没有后台服务" description="插件声明并启动 Service 入口后会出现在这里。" /> : null}
        </article>
      ) : (
        <article className="surface-card full-list-panel">
          <SectionHeading title="最近完成" description="最近 24 小时的任务结果" />
          <EmptyState title="暂无最近完成记录" description="任务成功、失败或取消后的记录会显示在这里。" />
        </article>
      )}
    </section>
  );
}
