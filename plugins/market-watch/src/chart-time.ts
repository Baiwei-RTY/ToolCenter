import type { MarketRange } from "./market-model";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const DETAILED_WINDOW_MILLISECONDS = 7 * DAY_MILLISECONDS;
const INTRADAY_INTERVAL_MILLISECONDS = 20 * 60 * 60 * 1_000;

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type AxisTimestampMode = "date" | "date-time" | "time";

export function resolveAxisTimestampMode(
  timestamps: readonly string[],
  range: MarketRange,
  isFullView: boolean,
): AxisTimestampMode {
  if (range === "1d") {
    return "time";
  }
  if (isFullView) {
    return "date";
  }

  const dates = timestamps
    .map(dateFromProviderTimestamp)
    .filter((date): date is Date => date !== null);
  if (dates.length < 2) {
    return "date";
  }

  const intervals = dates
    .slice(1)
    .map((date, index) => {
      const previous = dates[index];
      return previous ? date.getTime() - previous.getTime() : 0;
    })
    .filter((interval) => interval > 0)
    .sort((left, right) => left - right);
  const typicalInterval = intervals[Math.floor((intervals.length - 1) / 2)];
  if (typicalInterval === undefined || typicalInterval >= INTRADAY_INTERVAL_MILLISECONDS) {
    return "date";
  }

  const first = dates[0];
  const last = dates.at(-1);
  if (!first || !last) {
    return "date";
  }
  if (sameCalendarDay(first, last)) {
    return "time";
  }
  return last.getTime() - first.getTime() <= DETAILED_WINDOW_MILLISECONDS
    ? "date-time"
    : "date";
}

export function formatAxisTimestamp(
  value: string | undefined,
  mode: AxisTimestampMode,
): string {
  if (!value) {
    return "";
  }
  const date = dateFromProviderTimestamp(value);
  if (!date) {
    return fallbackTimestamp(value, mode);
  }
  if (mode === "time") {
    return timeFormatter.format(date);
  }
  if (mode === "date-time") {
    return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`;
  }
  return dateFormatter.format(date);
}

export function dateFromProviderTimestamp(value: string): Date | null {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function fallbackTimestamp(value: string, mode: AxisTimestampMode): string {
  const date = value.match(/\d{4}[-/]?(\d{2})[-/]?(\d{2})/)?.slice(1).join("/") ?? value;
  const time = value.match(/(\d{2}:\d{2})/)?.[1] ?? value;
  if (mode === "time") {
    return time;
  }
  return mode === "date-time" ? `${date} ${time}` : date;
}
