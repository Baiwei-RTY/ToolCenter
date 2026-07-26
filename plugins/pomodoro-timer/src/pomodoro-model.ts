export const POMODORO_SCHEMA_VERSION = 1;
export const DEFAULT_FOCUS_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;
export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 180;

const MINUTE_MS = 60_000;

export type PomodoroPhase = "focus" | "break";
export type PomodoroStatus = "idle" | "running" | "paused" | "completed";

export interface PomodoroSettings {
  readonly focusMinutes: number;
  readonly breakMinutes: number;
}

export interface PomodoroDocument {
  readonly schemaVersion: 1;
  readonly settings: PomodoroSettings;
  readonly phase: PomodoroPhase;
  readonly status: PomodoroStatus;
  readonly remainingMs: number;
  readonly endAt: number | null;
  readonly completedFocusSessions: number;
}

export function createDefaultPomodoroDocument(): PomodoroDocument {
  const settings = {
    focusMinutes: DEFAULT_FOCUS_MINUTES,
    breakMinutes: DEFAULT_BREAK_MINUTES,
  };
  return {
    schemaVersion: POMODORO_SCHEMA_VERSION,
    settings,
    phase: "focus",
    status: "idle",
    remainingMs: durationMilliseconds(settings, "focus"),
    endAt: null,
    completedFocusSessions: 0,
  };
}

export function pomodoroStorageKey(instanceId: string): string {
  return `widget.${instanceId}.v1`;
}

export function normalizePomodoroDocument(
  value: unknown,
  now: number,
): PomodoroDocument {
  if (!isRecord(value)) {
    return createDefaultPomodoroDocument();
  }

  const rawSettings = isRecord(value.settings) ? value.settings : {};
  const settings: PomodoroSettings = {
    focusMinutes: normalizeDurationMinutes(
      rawSettings.focusMinutes,
      DEFAULT_FOCUS_MINUTES,
    ),
    breakMinutes: normalizeDurationMinutes(
      rawSettings.breakMinutes,
      DEFAULT_BREAK_MINUTES,
    ),
  };
  const phase: PomodoroPhase = value.phase === "break" ? "break" : "focus";
  const phaseDuration = durationMilliseconds(settings, phase);
  const status = isPomodoroStatus(value.status) ? value.status : "idle";
  const completedFocusSessions = normalizeSessionCount(
    value.completedFocusSessions,
  );

  if (status === "running") {
    const endAt =
      typeof value.endAt === "number" &&
      Number.isFinite(value.endAt) &&
      value.endAt > 0
        ? value.endAt
        : null;
    if (endAt !== null) {
      return advancePomodoro(
        {
          schemaVersion: POMODORO_SCHEMA_VERSION,
          settings,
          phase,
          status,
          remainingMs: clampFiniteNumber(
            value.remainingMs,
            1,
            phaseDuration,
            phaseDuration,
          ),
          endAt,
          completedFocusSessions,
        },
        now,
      );
    }
  }

  if (status === "paused") {
    const remainingMs = clampFiniteNumber(
      value.remainingMs,
      0,
      phaseDuration,
      phaseDuration,
    );
    if (remainingMs <= 0) {
      return completedDocument(settings, phase, completedFocusSessions);
    }
    return {
      schemaVersion: POMODORO_SCHEMA_VERSION,
      settings,
      phase,
      status,
      remainingMs,
      endAt: null,
      completedFocusSessions,
    };
  }

  if (status === "completed") {
    return completedDocument(settings, phase, completedFocusSessions);
  }

  return {
    schemaVersion: POMODORO_SCHEMA_VERSION,
    settings,
    phase,
    status: "idle",
    remainingMs: phaseDuration,
    endAt: null,
    completedFocusSessions,
  };
}

export function startPomodoro(
  document: PomodoroDocument,
  now: number,
): PomodoroDocument {
  const prepared =
    document.status === "completed"
      ? switchPomodoroPhase(document, nextPhase(document.phase))
      : advancePomodoro(document, now);
  if (prepared.status === "running") {
    return prepared;
  }

  const remainingMs =
    prepared.status === "idle"
      ? durationMilliseconds(prepared.settings, prepared.phase)
      : Math.max(1, prepared.remainingMs);
  return {
    ...prepared,
    status: "running",
    remainingMs,
    endAt: now + remainingMs,
  };
}

export function pausePomodoro(
  document: PomodoroDocument,
  now: number,
): PomodoroDocument {
  if (document.status !== "running") {
    return document;
  }
  const advanced = advancePomodoro(document, now);
  if (advanced.status !== "running") {
    return advanced;
  }
  return {
    ...advanced,
    status: "paused",
    remainingMs: remainingMilliseconds(advanced, now),
    endAt: null,
  };
}

export function resetPomodoro(document: PomodoroDocument): PomodoroDocument {
  return {
    ...document,
    status: "idle",
    remainingMs: durationMilliseconds(document.settings, document.phase),
    endAt: null,
  };
}

export function switchPomodoroPhase(
  document: PomodoroDocument,
  phase: PomodoroPhase,
): PomodoroDocument {
  return {
    ...document,
    phase,
    status: "idle",
    remainingMs: durationMilliseconds(document.settings, phase),
    endAt: null,
  };
}

export function updatePomodoroDurations(
  document: PomodoroDocument,
  focusMinutes: number,
  breakMinutes: number,
): PomodoroDocument {
  const settings = {
    focusMinutes: normalizeDurationMinutes(
      focusMinutes,
      document.settings.focusMinutes,
    ),
    breakMinutes: normalizeDurationMinutes(
      breakMinutes,
      document.settings.breakMinutes,
    ),
  };
  return {
    ...document,
    settings,
    status: "idle",
    remainingMs: durationMilliseconds(settings, document.phase),
    endAt: null,
  };
}

export function advancePomodoro(
  document: PomodoroDocument,
  now: number,
): PomodoroDocument {
  if (
    document.status !== "running" ||
    document.endAt === null ||
    document.endAt > now
  ) {
    return document;
  }
  return completedDocument(
    document.settings,
    document.phase,
    document.completedFocusSessions + (document.phase === "focus" ? 1 : 0),
  );
}

export function remainingMilliseconds(
  document: PomodoroDocument,
  now: number,
): number {
  if (document.status === "completed") {
    return 0;
  }
  if (document.status === "running" && document.endAt !== null) {
    return Math.max(0, document.endAt - now);
  }
  return Math.max(0, document.remainingMs);
}

export function durationMilliseconds(
  settings: PomodoroSettings,
  phase: PomodoroPhase,
): number {
  return (
    (phase === "focus" ? settings.focusMinutes : settings.breakMinutes) *
    MINUTE_MS
  );
}

export function elapsedRatio(
  document: PomodoroDocument,
  now: number,
): number {
  const duration = durationMilliseconds(document.settings, document.phase);
  return Math.max(
    0,
    Math.min(1, 1 - remainingMilliseconds(document, now) / duration),
  );
}

export function formatTimerClock(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function isValidDurationMinutes(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_DURATION_MINUTES &&
    value <= MAX_DURATION_MINUTES
  );
}

function completedDocument(
  settings: PomodoroSettings,
  phase: PomodoroPhase,
  completedFocusSessions: number,
): PomodoroDocument {
  return {
    schemaVersion: POMODORO_SCHEMA_VERSION,
    settings,
    phase,
    status: "completed",
    remainingMs: 0,
    endAt: null,
    completedFocusSessions,
  };
}

function nextPhase(phase: PomodoroPhase): PomodoroPhase {
  return phase === "focus" ? "break" : "focus";
}

function normalizeDurationMinutes(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(
    MIN_DURATION_MINUTES,
    Math.min(MAX_DURATION_MINUTES, Math.round(value)),
  );
}

function normalizeSessionCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function clampFiniteNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, value));
}

function isPomodoroStatus(value: unknown): value is PomodoroStatus {
  return (
    value === "idle" ||
    value === "running" ||
    value === "paused" ||
    value === "completed"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
