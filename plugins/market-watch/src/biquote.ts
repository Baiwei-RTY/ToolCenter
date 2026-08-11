import type { PluginContext } from "@tool-center/plugin-contract";

import type {
  MarketBar,
  MarketInstrument,
  MarketRange,
  MarketSnapshot,
} from "./market-model";
import { MarketDataError } from "./twelve-data";

interface BiQuoteOhlcResponse {
  readonly bars?: unknown;
  readonly message?: unknown;
}

const rangeRequests: Readonly<
  Record<MarketRange, { readonly interval: string; readonly limit: number }>
> = {
  "1d": { interval: "5m", limit: 96 },
  "5d": { interval: "30m", limit: 80 },
  "1m": { interval: "1d", limit: 32 },
};

export async function fetchBiQuoteStockSnapshot(
  context: PluginContext,
  instrument: MarketInstrument,
  range: MarketRange,
): Promise<MarketSnapshot> {
  const response = await context.network.getJson<BiQuoteOhlcResponse>({
    url: buildBiQuoteOhlcUrl(instrument.symbol, range),
  });
  return parseBiQuoteOhlcResponse(response, instrument);
}

export function buildBiQuoteOhlcUrl(
  symbol: string,
  range: MarketRange,
): string {
  const request = rangeRequests[range];
  const parameters = new URLSearchParams({
    interval: request.interval,
    limit: String(request.limit),
  });
  return `https://biquote.io/api/${encodeURIComponent(symbol.trim().toUpperCase())}/ohlc?${parameters.toString()}`;
}

export function parseBiQuoteOhlcResponse(
  response: BiQuoteOhlcResponse,
  instrument: MarketInstrument,
): MarketSnapshot {
  if (!isRecord(response)) {
    throw new MarketDataError("invalid-response", "BiQuote 返回了无法识别的数据。");
  }
  if (!Array.isArray(response.bars)) {
    const providerMessage =
      typeof response.message === "string" ? response.message.toLowerCase() : "";
    throw new MarketDataError(
      providerMessage.includes("not found") ||
        providerMessage.includes("doesn't exist") ||
        providerMessage.includes("no tick")
        ? "invalid-symbol"
        : "provider",
      providerMessage.includes("not found") ||
        providerMessage.includes("doesn't exist") ||
        providerMessage.includes("no tick")
        ? "BiQuote 无法识别这个股票代码，请检查后重试。"
        : "BiQuote 股票行情暂时不可用，请稍后重试。",
    );
  }

  const bars = response.bars
    .map(normalizeOhlcBar)
    .filter((bar): bar is MarketBar => bar !== null)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  if (bars.length === 0) {
    throw new MarketDataError("empty", "当前股票在所选时间范围内没有可显示的数据。");
  }

  const first = bars[0]!;
  const last = bars.at(-1)!;
  const change = last.close - first.close;
  return {
    instrument,
    bars,
    price: last.close,
    change,
    changePercent: first.close === 0 ? 0 : (change / first.close) * 100,
    asOf: last.timestamp,
    statusLabel: `${formatTimestamp(last.timestamp)} · BiQuote 免 Key`,
  };
}

function normalizeOhlcBar(value: unknown): MarketBar | null {
  if (!isRecord(value) || typeof value.openTime !== "string") {
    return null;
  }
  const open = numeric(value.open);
  const high = numeric(value.high);
  const low = numeric(value.low);
  const close = numeric(value.close);
  const timestamp = new Date(value.openTime);
  if (
    Number.isNaN(timestamp.getTime()) ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    high < low ||
    high < Math.max(open, close) ||
    low > Math.min(open, close)
  ) {
    return null;
  }
  return {
    timestamp: timestamp.toISOString(),
    open,
    high,
    low,
    close,
  };
}

function numeric(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 16)
    : new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
