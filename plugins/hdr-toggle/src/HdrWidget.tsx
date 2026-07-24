import type { WidgetProps } from "@tool-center/plugin-contract";

import actionRefreshIcon from "./assets/action-refresh.svg";
import stateErrorIcon from "./assets/state-error.svg";
import statePermissionIcon from "./assets/state-permission.svg";
import stateSuccessIcon from "./assets/state-success.svg";
import displayIcon from "./assets/widget-display.svg";
import { displaySourceLabel, hdrStatusLabel } from "./hdr-display-model";
import "./styles.css";
import { useHdrDisplays } from "./use-hdr-displays";

export default function HdrWidget({ context, widget }: WidgetProps) {
  const hdr = useHdrDisplays(context, widget.instanceId, widget.visible);

  if (!widget.visible) {
    return <section className="tc-hdr-widget" aria-hidden="true" />;
  }

  if (hdr.readPermission !== "granted") {
    const denied = hdr.readPermission === "denied";
    return (
      <WidgetState
        size={widget.size}
        icon={statePermissionIcon}
        title={denied ? "未获得显示器权限" : "需要读取显示器"}
        detail={
          denied
            ? "请在插件权限设置中允许 display.read。"
            : "授权后才能查看可用屏幕和 HDR 状态。"
        }
        action={denied ? "重新检查" : "允许读取"}
        onAction={() =>
          void (denied ? hdr.checkReadPermission() : hdr.requestReadPermission())
        }
      />
    );
  }

  if (hdr.phase === "checking" || hdr.phase === "loading") {
    return (
      <WidgetState
        size={widget.size}
        icon={displayIcon}
        title="正在读取显示器"
        detail="正在获取 Windows HDR 状态…"
      />
    );
  }

  if (hdr.phase === "error" || hdr.phase === "empty") {
    return (
      <WidgetState
        size={widget.size}
        icon={stateErrorIcon}
        title={hdr.phase === "empty" ? "没有活动显示器" : "无法读取 HDR 状态"}
        detail={hdr.errorMessage ?? "请检查显示器连接后重试。"}
        action="刷新"
        onAction={() => void hdr.refresh()}
      />
    );
  }

  const selected = hdr.selected;
  const status = selected === null ? "请选择目标屏幕" : hdrStatusLabel(selected);

  return (
    <section
      className={`tc-hdr-widget tc-hdr-widget--${widget.size}`}
      aria-label="显示器 HDR 开关"
    >
      <div className="tc-hdr-widget__heading">
        <span>显示器 HDR</span>
        <div>
          {widget.locked ? <span className="tc-hdr-widget__locked">已锁定</span> : null}
          <button
            className="tc-hdr-widget__refresh"
            type="button"
            aria-label="刷新显示器状态"
            title="刷新显示器状态"
            onClick={() => void hdr.refresh()}
            disabled={hdr.busy}
          >
            <img src={actionRefreshIcon} alt="" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="tc-hdr-widget__display">
        <span className="tc-hdr-widget__icon">
          <img src={displayIcon} alt="" aria-hidden="true" />
        </span>
        <div>
          <strong title={selected?.name}>{selected?.name ?? "未选择显示器"}</strong>
          <span>{selected === null ? "请从下方重新选择" : displaySourceLabel(selected)}</span>
        </div>
      </div>

      <span
        className={`tc-hdr-widget__status ${
          selected?.hdrEnabled ? "tc-hdr-widget__status--enabled" : ""
        }`}
      >
        {status}
      </span>

      <label className="tc-hdr-widget__selector">
        <span>目标屏幕</span>
        <select
          value={hdr.selectedId ?? ""}
          onChange={(event) => void hdr.selectDisplay(event.target.value)}
          disabled={hdr.busy}
        >
          {hdr.staleSelection || hdr.selectedId === null ? (
            <option value="" disabled>
              请选择显示器
            </option>
          ) : null}
          {hdr.displays.map((display) => (
            <option key={display.id} value={display.id}>
              {display.primary ? "主显示器 · " : ""}
              {display.name} · {display.sourceName.replace(/^\\\\\.\\/, "")}
            </option>
          ))}
        </select>
      </label>

      <button
        className="tc-hdr-widget__toggle"
        type="button"
        onClick={() => void hdr.toggleHdr()}
        disabled={
          selected === null || !selected.hdrSupported || hdr.busy || hdr.staleSelection
        }
      >
        {hdr.busy
          ? "切换中…"
          : selected?.hdrEnabled
            ? "关闭 HDR"
            : selected?.hdrSupported
              ? "开启 HDR"
              : "HDR 不可用"}
      </button>

      <div className="tc-hdr-widget__feedback" aria-live="polite">
        {hdr.errorMessage ? (
          <span className="tc-hdr-widget__error" role="alert">
            {hdr.errorMessage}
          </span>
        ) : hdr.successMessage ? (
          <span className="tc-hdr-widget__success">
            <img src={stateSuccessIcon} alt="" aria-hidden="true" />
            {hdr.successMessage}
          </span>
        ) : null}
      </div>
    </section>
  );
}

interface WidgetStateProps {
  readonly size: "small" | "medium" | "wide";
  readonly icon: string;
  readonly title: string;
  readonly detail: string;
  readonly action?: string;
  readonly onAction?: () => void;
}

function WidgetState({
  size,
  icon,
  title,
  detail,
  action,
  onAction,
}: WidgetStateProps) {
  return (
    <section
      className={`tc-hdr-widget tc-hdr-widget--${size} tc-hdr-widget--state`}
      aria-label="显示器 HDR 状态"
    >
      <img src={icon} alt="" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {action && onAction ? (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </section>
  );
}
