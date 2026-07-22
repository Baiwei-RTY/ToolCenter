import type { AudioDeviceSummary, WidgetProps } from "@tool-center/plugin-contract";
import { useState } from "react";

import { AudioIcon } from "./AudioIcon";
import { AudioStatePanel } from "./AudioStatePanel";
import { deviceStateLabel, isDefaultForEveryRole, primaryDefault } from "./audio-device-model";
import successIcon from "./assets/state-success.svg";
import { useAudioOutput } from "./use-audio-output";
import "./styles.css";

export default function AudioDeviceWidget({ context, widget }: WidgetProps) {
  const audio = useAudioOutput(context);
  const [choosing, setChoosing] = useState(false);
  const current = primaryDefault(audio.defaults);
  const stateKind =
    audio.failureKind === "unsupported" || audio.failureKind === "unavailable"
      ? audio.failureKind
      : "error";

  const statePanel =
    audio.readPermission !== "granted" ? (
      <AudioStatePanel
        compact
        kind={audio.readPermission === "denied" ? "denied" : "permission"}
        onAction={() => void (audio.readPermission === "denied" ? audio.checkReadPermission() : audio.requestReadPermission())}
      />
    ) : audio.phase === "error" ? (
      <AudioStatePanel compact kind={stateKind} detail={audio.errorMessage} onAction={() => void audio.refresh()} />
    ) : audio.phase === "empty" ? (
      <AudioStatePanel compact kind="empty" onAction={() => void audio.refresh()} />
    ) : null;

  if (statePanel) {
    return <section className={`tc-audio-widget tc-audio-widget--${widget.size}`}>{statePanel}</section>;
  }

  return (
    <section className={`tc-audio-widget tc-audio-widget--${widget.size}`} aria-label="音频输出切换">
      {choosing ? (
        <WidgetDevicePicker
          devices={audio.devices}
          currentId={current?.id}
          switchingId={audio.switchingDeviceId}
          onClose={() => setChoosing(false)}
          onSelect={(device) => {
            void audio.switchTo(device).then(() => setChoosing(false));
          }}
        />
      ) : (
        <>
          <div className="tc-audio-widget__heading">
            <span>音频设备</span>
            {widget.locked ? <span className="tc-audio-widget__locked">已锁定</span> : null}
          </div>
          <div className="tc-audio-widget__current">
            <AudioIcon device={current} className="tc-audio-icon--widget" />
            <div>
              <strong title={current?.name}>{current?.name ?? "正在读取设备"}</strong>
              <span>默认输出 · 常规 / 媒体 / 通信</span>
            </div>
          </div>
          {audio.actionError ? <p className="tc-audio-widget__error" role="alert">{audio.actionError}</p> : null}
          {audio.lastSwitchedDeviceId ? (
            <span className="tc-audio-widget__success"><img src={successIcon} alt="" aria-hidden="true" />切换成功</span>
          ) : null}
          <button className="tc-audio-widget__switch" type="button" onClick={() => setChoosing(true)} disabled={audio.phase === "loading" || audio.switchingDeviceId !== null}>
            切换设备
          </button>
          {widget.size !== "small" ? (
            <div className="tc-audio-widget__quick-list" aria-label="快速切换设备">
              {audio.devices.filter((device) => device.state === "active").slice(0, widget.size === "wide" ? 3 : 2).map((device) => (
                <button key={device.id} type="button" disabled={isDefaultForEveryRole(device.id, audio.defaults) || audio.switchingDeviceId !== null} onClick={() => void audio.switchTo(device)}>
                  <AudioIcon device={device} />
                  <span title={device.name}>{device.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

interface WidgetDevicePickerProps {
  readonly devices: readonly AudioDeviceSummary[];
  readonly currentId?: string;
  readonly switchingId: string | null;
  readonly onClose: () => void;
  readonly onSelect: (device: AudioDeviceSummary) => void;
}

function WidgetDevicePicker({ devices, currentId, switchingId, onClose, onSelect }: WidgetDevicePickerProps) {
  return (
    <div className="tc-audio-widget-picker">
      <div className="tc-audio-widget-picker__header">
        <strong>选择输出设备</strong>
        <button type="button" onClick={onClose} aria-label="关闭设备列表">返回</button>
      </div>
      <div className="tc-audio-widget-picker__list">
        {devices.map((device) => {
          const selected = device.id === currentId;
          const disabled = device.state !== "active" || switchingId !== null || selected;
          return (
            <button key={device.id} type="button" disabled={disabled} onClick={() => onSelect(device)}>
              <AudioIcon device={device} />
              <span title={device.name}>{device.name}</span>
              <small>{switchingId === device.id ? "切换中" : selected ? "当前" : deviceStateLabel(device.state)}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
