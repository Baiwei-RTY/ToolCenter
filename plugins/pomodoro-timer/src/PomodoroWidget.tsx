import type { WidgetProps } from "@tool-center/plugin-contract";
import {
  buildStyles,
  CircularProgressbar,
  CircularProgressbarWithChildren,
} from "react-circular-progressbar";
import {
  createElement,
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import "@mdui/icons/adjust.js";
import "@mdui/icons/check-circle-outline.js";
import "@mdui/icons/close.js";
import "@mdui/icons/coffee.js";
import "@mdui/icons/fiber-manual-record.js";
import "@mdui/icons/pause.js";
import "@mdui/icons/play-arrow.js";
import "@mdui/icons/restart-alt.js";
import "@mdui/icons/tune.js";

import {
  completionSoundForTransition,
  elapsedRatio,
  formatTimerClock,
  isValidDurationMinutes,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  remainingMilliseconds,
  type PomodoroDocument,
  type PomodoroPhase,
  type PomodoroStatus,
} from "./pomodoro-model";
import {
  createPomodoroSoundController,
  type PomodoroSoundController,
} from "./pomodoro-sound";
import "./styles.css";
import { usePomodoro } from "./use-pomodoro";

type IconName =
  | "break"
  | "check"
  | "close"
  | "focus"
  | "pause"
  | "play"
  | "reset"
  | "status"
  | "tune";

const ICON_TAGS: Record<IconName, string> = {
  break: "mdui-icon-coffee",
  check: "mdui-icon-check-circle-outline",
  close: "mdui-icon-close",
  focus: "mdui-icon-adjust",
  pause: "mdui-icon-pause",
  play: "mdui-icon-play-arrow",
  reset: "mdui-icon-restart-alt",
  status: "mdui-icon-fiber-manual-record",
  tune: "mdui-icon-tune",
};

function Icon({ name, className }: { readonly name: IconName; readonly className?: string }) {
  return createElement(ICON_TAGS[name], {
    class: className,
    "aria-hidden": "true",
  });
}

export default function PomodoroWidget({ context, widget }: WidgetProps) {
  const timer = usePomodoro(context, widget.instanceId, widget.visible);
  const soundControllerRef = useRef<PomodoroSoundController | null>(null);
  const previousDocumentRef = useRef<PomodoroDocument | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusDraft, setFocusDraft] = useState("25");
  const [breakDraft, setBreakDraft] = useState("5");
  const [settingsError, setSettingsError] = useState<string>();
  const settingsTitleId = useId();
  const settingsHintId = useId();

  if (soundControllerRef.current === null) {
    soundControllerRef.current = createPomodoroSoundController();
  }

  useEffect(
    () => () => {
      soundControllerRef.current?.dispose();
    },
    [],
  );

  useEffect(() => {
    const previous = previousDocumentRef.current;
    previousDocumentRef.current = timer.document;
    if (!previous || timer.loadStatus !== "ready") {
      return;
    }

    const completedPhase = completionSoundForTransition(
      previous,
      timer.document,
    );
    if (completedPhase) {
      soundControllerRef.current?.play(completedPhase);
    }
  }, [timer.document, timer.loadStatus]);

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
  const progress = elapsedRatio(document, timer.nowMs) * 100;

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

  const handlePrimaryAction = () => {
    if (running) {
      timer.pause();
      return;
    }
    soundControllerRef.current?.unlock();
    timer.start();
  };

  return (
    <section
      className={`plugin-pomodoro-timer plugin-pomodoro-timer--${widget.size}`}
      data-phase={document.phase}
      data-status={document.status}
      aria-label="番茄钟桌面小组件"
    >
      <div className="plugin-pomodoro-timer__dial-pane">
        <div
          className="plugin-pomodoro-timer__dial-shell"
          aria-label={`${phaseLabel}计时进度`}
        >
          <CircularProgressbarWithChildren
            value={progress}
            strokeWidth={2.8}
            styles={buildStyles({
              rotation: 0,
              pathColor: "var(--pomodoro-primary)",
              trailColor: "var(--pomodoro-track)",
              pathTransitionDuration: 0.35,
            })}
          >
            <strong className="plugin-pomodoro-timer__time" role="timer">
              {formatTimerClock(remainingMs)}
            </strong>
          </CircularProgressbarWithChildren>
          <CircularProgressbar
            className="plugin-pomodoro-timer__dial-ticks"
            value={100}
            strokeWidth={1.4}
            styles={buildStyles({
              pathColor: "var(--pomodoro-tick)",
              trailColor: "transparent",
              strokeLinecap: "butt",
            })}
          />
        </div>
      </div>

      <div className="plugin-pomodoro-timer__control-pane">
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

        <div className="plugin-pomodoro-timer__status" aria-live="polite">
          <Icon name="status" className="plugin-pomodoro-timer__status-icon" />
          <span>{statusMessage}</span>
        </div>

        <div className="plugin-pomodoro-timer__divider" aria-hidden="true" />

        <div className="plugin-pomodoro-timer__completion">
          <Icon name="check" className="plugin-pomodoro-timer__completion-icon" />
          <span>已完成 {document.completedFocusSessions} 轮</span>
        </div>

        <div className="plugin-pomodoro-timer__controls">
          <button
            className="plugin-pomodoro-timer__primary"
            type="button"
            onClick={handlePrimaryAction}
          >
            <Icon
              name={running ? "pause" : "play"}
              className="plugin-pomodoro-timer__primary-icon"
            />
            <span>{primaryActionLabel(document.phase, document.status)}</span>
          </button>
          <button
            className="plugin-pomodoro-timer__icon-action"
            type="button"
            aria-label="重置计时"
            title="重置计时"
            onClick={timer.reset}
          >
            <Icon name="reset" />
          </button>
          <button
            className="plugin-pomodoro-timer__icon-action"
            type="button"
            aria-label="调整时长"
            title={running ? "请先暂停计时" : "调整专注和休息时长"}
            disabled={running}
            onClick={openSettings}
          >
            <Icon name="tune" />
          </button>
        </div>
      </div>

      <span className="plugin-pomodoro-timer__announcement" aria-live="polite">
        {statusMessage}
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

      {settingsOpen ? (
        <div
          className="plugin-pomodoro-timer__settings-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSettings();
            }
          }}
        >
          <form
            className="plugin-pomodoro-timer__settings"
            role="dialog"
            aria-modal="true"
            aria-labelledby={settingsTitleId}
            onSubmit={submitSettings}
          >
            <header>
              <div>
                <h2 id={settingsTitleId}>调整时长</h2>
                <p>保存后重置当前阶段，不会自动开始。</p>
              </div>
              <button
                className="plugin-pomodoro-timer__dialog-close"
                type="button"
                aria-label="关闭"
                onClick={closeSettings}
              >
                <Icon name="close" />
              </button>
            </header>
            <div className="plugin-pomodoro-timer__settings-fields">
              <label>
                <span>专注分钟</span>
                <input
                  autoFocus
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
            <p id={settingsHintId} className="plugin-pomodoro-timer__settings-message">
              {settingsError ?? "专注完成后会自动开始休息。"}
            </p>
            <div className="plugin-pomodoro-timer__settings-actions">
              <button type="button" onClick={closeSettings}>
                取消
              </button>
              <button
                className="plugin-pomodoro-timer__dialog-save"
                type="submit"
              >
                保存时长
              </button>
            </div>
          </form>
        </div>
      ) : null}
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
  const label = phase === "focus" ? "专注" : "休息";
  return (
    <button
      className="plugin-pomodoro-timer__phase-button"
      type="button"
      aria-label={`${label} ${minutes} 分钟`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(phase)}
    >
      <Icon name={phase} className="plugin-pomodoro-timer__phase-icon" />
      <span className="plugin-pomodoro-timer__phase-copy">
        <strong>{label}</strong>
        <small>{minutes} 分钟</small>
      </span>
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
