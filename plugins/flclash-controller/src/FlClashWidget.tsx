import type { WidgetProps } from "@tool-center/plugin-contract";
import {
  createElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type CSSProperties,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import "@mdui/icons/check--rounded.js";
import "@mdui/icons/expand-more--rounded.js";
import "@mdui/icons/power-settings-new.js";
import "@mdui/icons/refresh--rounded.js";

import { proxyNodeOptionLabel, proxyStateLabel } from "./flclash-model";
import flClashMarkUrl from "./assets/flclash-mark-aligned.png";
import "./styles.css";
import { useFlClash } from "./use-flclash";

type IconName = "check" | "expand" | "power" | "refresh";

const iconTags: Record<IconName, string> = {
  check: "mdui-icon-check--rounded",
  expand: "mdui-icon-expand-more--rounded",
  power: "mdui-icon-power-settings-new",
  refresh: "mdui-icon-refresh--rounded",
};

function Icon({ name, className }: { readonly name: IconName; readonly className?: string }) {
  return createElement(iconTags[name], {
    class: className,
    "aria-hidden": "true",
  });
}

export default function FlClashWidget({ context, widget }: WidgetProps) {
  const flclash = useFlClash(context, widget.instanceId, widget.visible);

  if (!widget.visible) {
    return <section className="tc-flclash-widget" aria-hidden="true" />;
  }

  if (flclash.readPermission !== "granted") {
    const denied = flclash.readPermission === "denied";
    return (
      <WidgetState
        size={widget.size}
        icon="permission"
        title={denied ? "未获得代理读取权限" : "需要读取代理状态"}
        detail={
          denied
            ? "请在插件权限设置中允许 proxy.read。"
            : "授权后仅访问定制版的本机接口 127.0.0.1:19090。"
        }
        action={denied ? "重新检查" : "允许读取"}
        onAction={() =>
          void (denied
            ? flclash.checkReadPermission()
            : flclash.requestReadPermission())
        }
      />
    );
  }

  if (flclash.phase === "checking" || flclash.phase === "loading") {
    return (
      <WidgetState
        size={widget.size}
        icon="route"
        title="正在连接 FlClash"
        detail="正在读取外部控制接口和代理运行状态…"
      />
    );
  }

  if (flclash.phase === "unavailable") {
    return (
      <WidgetState
        size={widget.size}
        icon="route"
        title="需要开启外部控制"
        detail="请打开 FlClash → 设置 → 高级设置 → 外部控制，然后刷新。"
        action="重新连接"
        onAction={() => void flclash.refresh()}
      />
    );
  }

  if (flclash.phase === "error" || flclash.phase === "empty") {
    return (
      <WidgetState
        size={widget.size}
        icon="error"
        title={flclash.phase === "empty" ? "没有可切换的代理组" : "无法读取代理状态"}
        detail={
          flclash.errorMessage ??
          "当前配置没有 Selector 类型的代理组，请在 FlClash 中检查配置。"
        }
        action="刷新"
        onAction={() => void flclash.refresh()}
      />
    );
  }

  const status = flclash.status;
  const selectedGroup = flclash.selectedGroup;
  const connectedLabel = status.version ? `已连接 · ${status.version}` : "已连接";

  return (
    <section
      className={`tc-flclash-widget tc-flclash-widget--${widget.size}`}
      aria-label="FlClash 桌面控制"
      data-running={status.proxyEnabled ? "true" : "false"}
    >
      <header className="tc-flclash-widget__heading">
        <div className="tc-flclash-widget__identity">
          <span className="tc-flclash-widget__brand-mark" aria-hidden="true">
            <img src={flClashMarkUrl} alt="" />
          </span>
          <div className="tc-flclash-widget__identity-copy">
            <strong>FlClash</strong>
            <span>
              <i aria-hidden="true" />
              {connectedLabel}
            </span>
          </div>
        </div>
        <div className="tc-flclash-widget__tools">
          {widget.locked ? <span className="tc-flclash-widget__locked">已锁定</span> : null}
          <button
            className="tc-flclash-widget__refresh"
            type="button"
            aria-label="刷新 FlClash 状态"
            title="刷新 FlClash 状态"
            onClick={() => void flclash.refresh()}
            disabled={flclash.busy}
          >
            <Icon name="refresh" />
          </button>
        </div>
      </header>

      <button
        className="tc-flclash-widget__power"
        type="button"
        aria-pressed={status.proxyEnabled}
        aria-label={`${status.proxyEnabled ? "停止" : "启动"} FlClash 代理`}
        title="对应 FlClash 首页主开关，需将“启动”全局快捷键设置为 Ctrl+Alt+Shift+F12"
        onClick={() => void flclash.toggleProxy()}
        disabled={flclash.busy}
      >
        <Icon name="power" className="tc-flclash-widget__power-icon" />
        <span className="tc-flclash-widget__power-copy">
          <strong>
            {flclash.busy
              ? "正在应用…"
              : status.proxyEnabled
                ? "停止 FlClash 代理"
                : "启动 FlClash 代理"}
          </strong>
          <span>{proxyStateLabel(status)}</span>
        </span>
        <span
          className="tc-flclash-widget__power-state"
          data-running={status.proxyEnabled ? "true" : "false"}
        >
          <i aria-hidden="true" />
          {status.proxyEnabled ? "运行中" : "已停止"}
        </span>
      </button>

      <div className="tc-flclash-widget__selectors">
        <MaterialSelect
          label="代理组"
          value={flclash.selectedGroupName ?? ""}
          options={flclash.groups.map((group) => ({
            value: group.name,
            label: group.name,
          }))}
          disabled={flclash.busy}
          onChange={(value) => void flclash.selectGroup(value)}
        />
        <MaterialSelect
          label="当前节点"
          value={selectedGroup?.selected ?? ""}
          options={(selectedGroup?.nodes ?? []).map((node) => ({
            value: node.name,
            label: proxyNodeOptionLabel(node),
          }))}
          wideMenu
          disabled={flclash.busy || selectedGroup === null}
          onChange={(value) => void flclash.selectNode(value)}
        />
      </div>

      <div className="tc-flclash-widget__feedback" aria-live="polite">
        {flclash.errorMessage ? (
          <span className="tc-flclash-widget__error" role="alert">
            {flclash.errorMessage}
          </span>
        ) : flclash.successMessage ? (
          <span className="tc-flclash-widget__success">
            <span aria-hidden="true">✓</span>
            {flclash.successMessage}
          </span>
        ) : flclash.busy ? (
          <span>正在应用更改…</span>
        ) : flclash.staleSelection ? (
          <span>之前的代理组已失效，请确认当前选择。</span>
        ) : (
          <span>状态每 5 秒自动刷新</span>
        )}
      </div>
    </section>
  );
}

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface MaterialSelectProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly disabled?: boolean;
  readonly wideMenu?: boolean;
  readonly onChange: (value: string) => void;
}

function MaterialSelect({
  label,
  value,
  options,
  disabled = false,
  wideMenu = false,
  onChange,
}: MaterialSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const openMenu = () => {
    if (disabled || options.length === 0) return;
    const triggerRect = rootRef.current?.getBoundingClientRect();
    if (triggerRect) {
      const menuWidth = wideMenu ? Math.min(320, window.innerWidth - 16) : triggerRect.width;
      const left = Math.min(
        Math.max(8, triggerRect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );
      const estimatedHeight = Math.min(options.length * 38 + 12, 220);
      const openAbove =
        window.innerHeight - triggerRect.bottom < estimatedHeight + 8 &&
        triggerRect.top > window.innerHeight - triggerRect.bottom;
      setMenuStyle({
        position: "fixed",
        top: openAbove ? undefined : triggerRect.bottom + 5,
        bottom: openAbove ? window.innerHeight - triggerRect.top + 5 : undefined,
        left,
        width: menuWidth,
      });
    }
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const choose = (option: SelectOption, index: number) => {
    setActiveIndex(index);
    if (option.value !== value) onChange(option.value);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled || options.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + direction + options.length) % options.length);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) choose(option, activeIndex);
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    }
  };

  return (
    <div className="tc-flclash-widget__select-card" data-open={open || undefined} ref={rootRef}>
      <span className="tc-flclash-widget__select-label">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className="tc-flclash-widget__select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled || options.length === 0}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{selectedOption?.label ?? "暂无选项"}</span>
        <Icon name="expand" />
      </button>
      {open ? (
        <div
          className="tc-flclash-widget__select-popover"
          data-wide={wideMenu || undefined}
          style={menuStyle}
        >
          <div
            className="tc-flclash-widget__select-menu"
            data-toolcenter-widget-region
            id={listboxId}
            role="listbox"
            aria-label={label}
          >
            {options.map((option, index) => {
              const selected = option.value === value;
              return (
                <button
                  type="button"
                  className="tc-flclash-widget__select-option"
                  role="option"
                  aria-selected={selected}
                  data-active={index === activeIndex || undefined}
                  key={option.value}
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => choose(option, index)}
                >
                  <span>{option.label}</span>
                  {selected ? <Icon name="check" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface WidgetStateProps {
  readonly size: "small" | "medium" | "wide";
  readonly icon: "route" | "permission" | "error";
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
      className={`tc-flclash-widget tc-flclash-widget--${size} tc-flclash-widget--state`}
      aria-label="FlClash 控制状态"
    >
      <span
        className={`tc-flclash-widget__state-icon tc-flclash-widget__state-icon--${icon}`}
        aria-hidden="true"
      />
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
