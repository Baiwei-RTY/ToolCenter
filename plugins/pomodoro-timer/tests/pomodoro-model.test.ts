import { describe, expect, it } from "vitest";

import {
  advancePomodoro,
  createDefaultPomodoroDocument,
  DEFAULT_BREAK_MINUTES,
  DEFAULT_FOCUS_MINUTES,
  elapsedRatio,
  formatTimerClock,
  isValidDurationMinutes,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  normalizePomodoroDocument,
  pausePomodoro,
  pomodoroStorageKey,
  remainingMilliseconds,
  resetPomodoro,
  startPomodoro,
  switchPomodoroPhase,
  updatePomodoroDurations,
} from "../src/pomodoro-model";

describe("pomodoro model", () => {
  it("creates the default 25 minute focus and 5 minute break settings", () => {
    const document = createDefaultPomodoroDocument();

    expect(document.settings).toEqual({
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      breakMinutes: DEFAULT_BREAK_MINUTES,
    });
    expect(document.phase).toBe("focus");
    expect(formatTimerClock(document.remainingMs)).toBe("25:00");
  });

  it("starts, pauses and resumes using an absolute end time", () => {
    const started = startPomodoro(createDefaultPomodoroDocument(), 1_000);
    const paused = pausePomodoro(started, 61_000);
    const resumed = startPomodoro(paused, 120_000);

    expect(started.endAt).toBe(1_501_000);
    expect(formatTimerClock(remainingMilliseconds(paused, 61_000))).toBe("24:00");
    expect(resumed.endAt).toBe(1_560_000);
  });

  it("completes focus once and starts the configured break next", () => {
    const configured = updatePomodoroDurations(
      createDefaultPomodoroDocument(),
      1,
      7,
    );
    const started = startPomodoro(configured, 0);
    const completed = advancePomodoro(started, 60_000);
    const breakStarted = startPomodoro(completed, 65_000);

    expect(completed.status).toBe("completed");
    expect(completed.completedFocusSessions).toBe(1);
    expect(breakStarted.phase).toBe("break");
    expect(formatTimerClock(breakStarted.remainingMs)).toBe("07:00");
  });

  it("recovers an elapsed running session after sleep or restart", () => {
    const recovered = normalizePomodoroDocument(
      {
        ...createDefaultPomodoroDocument(),
        status: "running",
        remainingMs: 60_000,
        endAt: 10_000,
      },
      20_000,
    );

    expect(recovered.status).toBe("completed");
    expect(recovered.completedFocusSessions).toBe(1);
  });

  it("updates manual durations, clamps stored values and resets the current phase", () => {
    const running = startPomodoro(createDefaultPomodoroDocument(), 0);
    const updated = updatePomodoroDurations(running, 45, 10);
    const normalized = normalizePomodoroDocument(
      {
        ...updated,
        settings: { focusMinutes: 999, breakMinutes: -10 },
      },
      0,
    );

    expect(updated.settings).toEqual({ focusMinutes: 45, breakMinutes: 10 });
    expect(updated.status).toBe("idle");
    expect(formatTimerClock(updated.remainingMs)).toBe("45:00");
    expect(normalized.settings).toEqual({
      focusMinutes: MAX_DURATION_MINUTES,
      breakMinutes: 1,
    });
  });

  it("accepts integer duration boundaries and rejects invalid manual values", () => {
    expect(isValidDurationMinutes(MIN_DURATION_MINUTES)).toBe(true);
    expect(isValidDurationMinutes(MAX_DURATION_MINUTES)).toBe(true);
    expect(isValidDurationMinutes(0)).toBe(false);
    expect(isValidDurationMinutes(1.5)).toBe(false);
    expect(isValidDurationMinutes(MAX_DURATION_MINUTES + 1)).toBe(false);
  });

  it("switches and resets phases without changing completed focus count", () => {
    const document = {
      ...createDefaultPomodoroDocument(),
      completedFocusSessions: 3,
    };
    const breakDocument = switchPomodoroPhase(document, "break");
    const reset = resetPomodoro(startPomodoro(breakDocument, 0));

    expect(reset.phase).toBe("break");
    expect(reset.status).toBe("idle");
    expect(reset.completedFocusSessions).toBe(3);
    expect(formatTimerClock(reset.remainingMs)).toBe("05:00");
  });

  it("reports progress and uses stable per-instance storage keys", () => {
    const started = startPomodoro(createDefaultPomodoroDocument(), 0);

    expect(elapsedRatio(started, 750_000)).toBe(0.5);
    expect(pomodoroStorageKey("w123abc")).toBe("widget.w123abc.v1");
  });
});
