import type { WidgetProps } from "@tool-center/plugin-contract";
import { type FormEvent, useId, useState } from "react";

import {
  elapsedRatio,
  formatTimerClock,
  isValidDurationMinutes,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  remainingMilliseconds,
  type PomodoroPhase,
  type PomodoroStatus,
} from "./pomodoro-model";
import "./styles.css";
import { usePomodoro } from "./use-pomodoro";

export default function PomodoroWidget({ context, widget }: WidgetProps) {
  const timer = usePomodoro(context, widget.instanceId, widget.visible);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusDraft, setFocusDraft] = useState("25");
  const [breakDraft, setBreakDraft] = useState("5");
  const [settingsError, setSettingsError] = useState<string>();
  const settingsHintId = useId();

  if (!widget.visible) {
    return <section className="plugin-pomodoro-timer" aria-hidden="true" />;
  }

  if (timer.loadStatus === "loading") {
    return (
      <WidgetState
        size={widget.size}
        title="正在恢复番茄钟"
        detail="正在读取当前阶段和剩余时间…"
        busy
      />
    );
  }

  if (timer.loadStatus === "error") {
    return (
      <WidgetState
        size={widget.size}
        title="无法读取番茄钟"
        detail={timer.errorMessage ?? "请稍后重试。"}
        action="重新读取"
        onAction={timer.retryLoad}
        error
      />
    );
  }

  const { document } = timer;
  const running = document.status === "running";
  const remainingMs = remainingMilliseconds(document, timer.nowMs);
  const phaseLabel = document.phase === "focus" ? "专注" : "休息";
  const statusMessage = timerStatusMessage(document.phase, document.status);
  const saveMessage =
    timer.saveStatus === "saving"
      ? "保存中…"
      : timer.saveStatus === "error"
        ? "保存失败"
        : widget.locked
          ? "位置已锁定"
          : `已完成 ${document.completedFocusSessions} 轮`;

  const openSettings = () => {
    setFocusDraft(String(document.settings.focusMinutes));
    setBreakDraft(String(document.settings.breakMinutes));
    setSettingsError(undefined);
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    setSettingsError(undefined);
    setSettingsOpen(false);
  };

  const submitSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const focusMinutes = Number(focusDraft);
    const breakMinutes = Number(breakDraft);
    if (
      !isValidDurationMinutes(focusMinutes) ||
      !isValidDurationMinutes(breakMinutes)
    ) {
      setSettingsError(
        `请输入 ${MIN_DURATION_MINUTES}–${MAX_DURATION_MINUTES} 之间的整数分钟。`,
      );
      return;
    }
    timer.updateDurations(focusMinutes, breakMinutes);
    setSettingsError(undefined);
    setSettingsOpen(false);
  };

  return (
    <section
      className={`plugin-pomodoro-timer plugin-pomodoro-timer--${widget.size}`}
      data-phase={document.phase}
      data-status={document.status}
      aria-label="番茄钟桌面小组件"
    >
      {settingsOpen ? (
        <form
          className="plugin-pomodoro-timer__settings"
          onSubmit={submitSettings}
        >
          <div className="plugin-pomodoro-timer__settings-fields">
            <label>
              <span>专注分钟</span>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_DURATION_MINUTES}
                max={MAX_DURATION_MINUTES}
                step={1}
                value={focusDraft}
                aria-describedby={settingsHintId}
                onChange={(event) => setFocusDraft(event.target.value)}
              />
            </label>
            <label>
              <span>休息分钟</span>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_DURATION_MINUTES}
                max={MAX_DURATION_MINUTES}
                step={1}
                value={breakDraft}
                aria-describedby={settingsHintId}
                onChange={(event) => setBreakDraft(event.target.value)}
              />
            </label>
          </div>
          <p id={settingsHintId} className="plugin-pomodoro-timer__settings-hint">
            保存后重置当前阶段，不会自动开始。
          </p>
          {settingsError ? (
            <p className="plugin-pomodoro-timer__settings-error" role="alert">
              {settingsError}
            </p>
          ) : null}
          <div className="plugin-pomodoro-timer__settings-actions">
            <button
              className="plugin-pomodoro-timer__primary"
              type="submit"
            >
              保存时长
            </button>
            <button type="button" onClick={closeSettings}>
              取消
            </button>
          </div>
        </form>
      ) : (
        <>
          <div
            className="plugin-pomodoro-timer__phases"
            role="group"
            aria-label="选择计时阶段"
          >
            <PhaseButton
              phase="focus"
              current={document.phase}
              minutes={document.settings.focusMinutes}
              disabled={running}
              onSelect={timer.setPhase}
            />
            <PhaseButton
              phase="break"
              current={document.phase}
              minutes={document.settings.breakMinutes}
              disabled={running}
              onSelect={timer.setPhase}
            />
          </div>

          <div className="plugin-pomodoro-timer__display">
            <strong role="timer">{formatTimerClock(remainingMs)}</strong>
            <div className="plugin-pomodoro-timer__meta">
              <span>{statusMessage}</span>
              <span>{saveMessage}</span>
            </div>
            <progress
              max={1}
              value={elapsedRatio(document, timer.nowMs)}
              aria-label={`${phaseLabel}计时进度`}
            />
          </div>

          <div className="plugin-pomodoro-timer__controls">
            <button
              className="plugin-pomodoro-timer__primary"
              type="button"
              onClick={running ? timer.pause : timer.start}
            >
              {primaryActionLabel(document.phase, document.status)}
            </button>
            <button type="button" onClick={timer.reset}>
              重置
            </button>
            <button
              type="button"
              disabled={running}
              title={running ? "请先暂停计时" : "调整专注和休息时长"}
              onClick={openSettings}
            >
              时长
            </button>
          </div>

          <span
            className="plugin-pomodoro-timer__announcement"
            aria-live="polite"
          >
            {document.status === "completed" ? statusMessage : ""}
          </span>

          {timer.errorMessage ? (
            <div className="plugin-pomodoro-timer__feedback" role="alert">
              <span>{timer.errorMessage}</span>
              {timer.saveStatus === "error" ? (
                <button type="button" onClick={timer.retrySave}>
                  重试
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function PhaseButton({
  phase,
  current,
  minutes,
  disabled,
  onSelect,
}: {
  readonly phase: PomodoroPhase;
  readonly current: PomodoroPhase;
  readonly minutes: number;
  readonly disabled: boolean;
  readonly onSelect: (phase: PomodoroPhase) => void;
}) {
  const selected = phase === current;
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(phase)}
    >
      <span>{phase === "focus" ? "专注" : "休息"}</span>
      <small>{minutes} 分钟</small>
    </button>
  );
}

function WidgetState({
  size,
  title,
  detail,
  action,
  onAction,
  busy = false,
  error = false,
}: {
  readonly size: "small" | "medium" | "wide";
  readonly title: string;
  readonly detail: string;
  readonly action?: string;
  readonly onAction?: () => void;
  readonly busy?: boolean;
  readonly error?: boolean;
}) {
  return (
    <section
      className={`plugin-pomodoro-timer plugin-pomodoro-timer--${size} plugin-pomodoro-timer--state`}
      aria-label="番茄钟状态"
      aria-busy={busy}
      role={error ? "alert" : "status"}
    >
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {action && onAction ? (
        <button
          className="plugin-pomodoro-timer__primary"
          type="button"
          onClick={onAction}
        >
          {action}
        </button>
      ) : null}
    </section>
  );
}

function timerStatusMessage(
  phase: PomodoroPhase,
  status: PomodoroStatus,
): string {
  if (status === "completed") {
    return phase === "focus"
      ? "专注完成，可以开始休息"
      : "休息完成，可以开始专注";
  }
  if (status === "running") {
    return phase === "focus" ? "正在专注" : "正在休息";
  }
  if (status === "paused") {
    return `${phase === "focus" ? "专注" : "休息"}已暂停`;
  }
  return phase === "focus" ? "准备开始专注" : "准备开始休息";
}

function primaryActionLabel(
  phase: PomodoroPhase,
  status: PomodoroStatus,
): string {
  if (status === "running") {
    return "暂停";
  }
  if (status === "paused") {
    return "继续";
  }
  if (status === "completed") {
    return phase === "focus" ? "开始休息" : "开始专注";
  }
  return phase === "focus" ? "开始专注" : "开始休息";
}
