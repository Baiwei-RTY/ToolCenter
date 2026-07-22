import permissionIcon from "./assets/state-permission.svg";
import retryIcon from "./assets/action-retry.svg";
import disconnectedIcon from "./assets/audio-device-disconnected.svg";
import errorIcon from "./assets/state-error.svg";

interface AudioStatePanelProps {
  readonly kind: "permission" | "denied" | "empty" | "unsupported" | "unavailable" | "error";
  readonly compact?: boolean;
  readonly detail?: string | null;
  readonly onAction: () => void;
}

const content = {
  permission: {
    title: "允许读取音频输出设备",
    description: "只读取扬声器、耳机等输出设备，不会读取麦克风。",
    action: "允许读取",
    icon: permissionIcon,
  },
  denied: {
    title: "读取权限已关闭",
    description: "请在插件权限设置中允许“音频读取”，然后重新检查。",
    action: "重新检查",
    icon: permissionIcon,
  },
  empty: {
    title: "未找到可用的输出设备",
    description: "连接扬声器或耳机后重试。",
    action: "重新扫描",
    icon: disconnectedIcon,
  },
  unsupported: {
    title: "当前系统不支持音频切换",
    description: "此功能需要 Windows 音频设备接口。",
    action: "重新检查",
    icon: errorIcon,
  },
  unavailable: {
    title: "音频服务暂不可用",
    description: "启动器宿主没有响应，请稍后重试。",
    action: "重试",
    icon: errorIcon,
  },
  error: {
    title: "读取输出设备失败",
    description: "设备可能刚刚断开，重新扫描即可恢复。",
    action: "重试",
    icon: errorIcon,
  },
} as const;

export function AudioStatePanel({ kind, compact = false, detail, onAction }: AudioStatePanelProps) {
  const current = content[kind];
  return (
    <div className={`tc-audio-state${compact ? " tc-audio-state--compact" : ""}`} role={kind === "error" ? "alert" : "status"}>
      <img src={current.icon} alt="" aria-hidden="true" />
      <div>
        <strong>{current.title}</strong>
        <p>{detail || current.description}</p>
      </div>
      <button type="button" onClick={onAction}>
        <img src={retryIcon} alt="" aria-hidden="true" />
        {current.action}
      </button>
    </div>
  );
}
