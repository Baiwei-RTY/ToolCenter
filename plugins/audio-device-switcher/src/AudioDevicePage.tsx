import type { AudioDefaultRole, AudioDeviceSummary, PluginPageProps } from "@tool-center/plugin-contract";

import { AudioIcon } from "./AudioIcon";
import { AudioStatePanel } from "./AudioStatePanel";
import {
  allDefaultRoles,
  deviceStateLabel,
  isDefaultForEveryRole,
  primaryDefault,
  roleLabel,
} from "./audio-device-model";
import refreshIcon from "./assets/action-refresh.svg";
import successIcon from "./assets/state-success.svg";
import { useAudioOutput } from "./use-audio-output";
import "./styles.css";

export default function AudioDevicePage({ context }: PluginPageProps) {
  const audio = useAudioOutput(context);
  const current = primaryDefault(audio.defaults);

  return (
    <section className="tc-audio-page" aria-labelledby="tc-audio-page-title">
      <header className="tc-audio-page__header">
        <div>
          <p className="tc-audio-eyebrow">音频工具</p>
          <h1 id="tc-audio-page-title">音频输出设备</h1>
          <p>选择一个设备，同时设为 Windows 的常规、媒体和通信默认输出。</p>
        </div>
        {audio.readPermission === "granted" ? (
          <button className="tc-audio-button tc-audio-button--secondary" type="button" onClick={() => void audio.refresh()} disabled={audio.phase === "loading"}>
            <img src={refreshIcon} alt="" aria-hidden="true" />
            {audio.phase === "loading" ? "正在扫描" : "刷新设备"}
          </button>
        ) : null}
      </header>

      {audio.readPermission !== "granted" ? (
        <AudioStatePanel
          kind={audio.readPermission === "denied" ? "denied" : "permission"}
          onAction={() => void (audio.readPermission === "denied" ? audio.checkReadPermission() : audio.requestReadPermission())}
        />
      ) : audio.phase === "error" ? (
        <AudioStatePanel kind={audio.failureKind === "unsupported" || audio.failureKind === "unavailable" ? audio.failureKind : "error"} detail={audio.errorMessage} onAction={() => void audio.refresh()} />
      ) : audio.phase === "empty" ? (
        <AudioStatePanel kind="empty" onAction={() => void audio.refresh()} />
      ) : (
        <>
          <section className="tc-audio-current" aria-label="当前默认输出">
            <div className="tc-audio-current__device">
              <AudioIcon device={current} className="tc-audio-icon--hero" />
              <div>
                <span>当前默认输出</span>
                <strong>{current?.name ?? "正在读取设备"}</strong>
                <p>三个 Windows 默认角色将始终一起切换。</p>
              </div>
            </div>
            <div className="tc-audio-role-grid">
              {allDefaultRoles.map((role) => (
                <RoleCard key={role} role={role} device={audio.defaults[role]} />
              ))}
            </div>
          </section>

          {audio.actionError ? (
            <div className="tc-audio-banner tc-audio-banner--error" role="alert">
              <strong>切换失败</strong>
              <span>{audio.actionError}</span>
            </div>
          ) : null}
          {audio.lastSwitchedDeviceId ? (
            <div className="tc-audio-banner tc-audio-banner--success" role="status">
              <img src={successIcon} alt="" aria-hidden="true" />
              <span>已同步更新常规、媒体和通信默认输出。</span>
            </div>
          ) : null}

          <section className="tc-audio-device-section" aria-labelledby="tc-audio-device-list-title">
            <div className="tc-audio-section-heading">
              <div>
                <h2 id="tc-audio-device-list-title">输出设备</h2>
                <p>仅显示扬声器、耳机等播放设备，不读取麦克风。</p>
              </div>
              <span>{audio.devices.length} 个设备</span>
            </div>
            <div className="tc-audio-device-list">
              {audio.devices.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  selected={isDefaultForEveryRole(device.id, audio.defaults)}
                  switching={audio.switchingDeviceId === device.id}
                  disabled={audio.switchingDeviceId !== null}
                  onSelect={() => void audio.switchTo(device)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function RoleCard({ role, device }: { readonly role: AudioDefaultRole; readonly device: AudioDeviceSummary | null }) {
  return (
    <div className="tc-audio-role-card">
      <span>{roleLabel(role)}</span>
      <strong title={device?.name}>{device?.name ?? "未设置"}</strong>
    </div>
  );
}

interface DeviceRowProps {
  readonly device: AudioDeviceSummary;
  readonly selected: boolean;
  readonly switching: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}

function DeviceRow({ device, selected, switching, disabled, onSelect }: DeviceRowProps) {
  const available = device.state === "active";
  return (
    <article className={`tc-audio-device-row${selected ? " tc-audio-device-row--selected" : ""}`}>
      <AudioIcon device={device} />
      <div className="tc-audio-device-row__copy">
        <strong title={device.name}>{device.name}</strong>
        <span>{selected ? "三个角色的默认输出" : deviceStateLabel(device.state)}</span>
      </div>
      <span className={`tc-audio-status-pill tc-audio-status-pill--${available ? "available" : "offline"}`}>
        {deviceStateLabel(device.state)}
      </span>
      <button className={selected ? "tc-audio-button tc-audio-button--selected" : "tc-audio-button"} type="button" disabled={!available || disabled || selected} onClick={onSelect}>
        {switching ? "切换中…" : selected ? "当前默认" : "设为默认"}
      </button>
    </article>
  );
}
