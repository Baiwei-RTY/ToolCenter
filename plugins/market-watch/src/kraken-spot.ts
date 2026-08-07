import type { PluginContext } from "@tool-center/plugin-contract";

import type {
  MarketBar,
  MarketInstrument,
  MarketRange,
  MarketSnapshot,
} from "./market-model";
import { MarketDataError } from "./twelve-data";

interface KrakenOhlcResponse {
  readonly error?: unknown;
  readonly result?: unknown;
}

const rangeRequests: Readonly<
  Record<MarketRange, { readonly interval: string; readonly limit: number }>
> = {
  "1d": { interval: "5", limit: 288 },
  "5d": { interval: "15", limit: 480 },
  "1m": { interval: "60", limit: 720 },
};

export async function fetchKrakenSpotSnapshot(
  context: PluginContext,
  instrument: MarketInstrument,
  range: MarketRange,
): Promise<MarketSnapshot> {
  const response = await context.network.getJson<KrakenOhlcResponse>({
    url: buildKrakenSpotUrl(instrument.symbol, range),
  });
  return parseKrakenSpotResponse(response, instrument, range);
}

export function buildKrakenSpotUrl(symbol: string, range: MarketRange): string {
  const request = rangeRequests[range];
  const parameters = new URLSearchParams({
    pair: normalizeKrakenPair(symbol),
    assetVersion: "1",
    interval: request.interval,
  });
  return `https://api.kraken.com/0/public/OHLC?${parameters.toString()}`;
}

export function parseKrakenSpotResponse(
  response: KrakenOhlcResponse,
  instrument: MarketInstrument,
  range: MarketRange,
): MarketSnapshot {
  if (!isRecord(response)) {
    throw new MarketDataError("invalid-response", "Kraken 返回了无法识别的数据。");
  }

  const errors = Array.isArray(response.error)
    ? response.error.filter((value): value is string => typeof value === "string")
    : [];
  if (errors.length > 0) {
    const providerMessage = errors.join(" ").toLowerCase();
    throw new MarketDataError(
      providerMessage.includes("pair") || providerMessage.includes("asset")
        ? "invalid-symbol"
        : providerMessage.includes("rate limit") || providerMessage.includes("throttled")
          ? "rate-limit"
          : "provider",
      providerMessage.includes("pair") || providerMessage.includes("asset")
        ? "Kraken 无法识别这个现货代码，请使用 BTC/USD 一类交易对格式。"
        : providerMessage.includes("rate limit") || providerMessage.includes("throttled")
          ? "Kraken 公共行情已达到当前频率限制，请稍后重试。"
          : "Kraken 现货行情暂时不可用，请稍后重试。",
    );
  }
  if (!isRecord(response.result)) {
    throw new MarketDataError("invalid-response", "Kraken 没有返回价格序列。");
  }

  const pairEntry = Object.entries(response.result).find(
    ([key, value]) => key !== "last" && Array.isArray(value),
  );
  if (!pairEntry) {
    throw new MarketDataError("empty", "当前现货产品在所选时间范围内没有可显示的数据。");
  }

  const [pairName, rawRows] = pairEntry;
  const rows = rawRows as unknown[];
  const limit = rangeRequests[range].limit;
  const bars = rows
    .map(normalizeOhlcRow)
    .filter((bar): bar is MarketBar => bar !== null)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-limit);
  if (bars.length === 0) {
    throw new MarketDataError("empty", "当前现货产品在所选时间范围内没有可显示的数据。");
  }

  const first = bars[0]!;
  const last = bars.at(-1)!;
  const change = last.close - first.close;
  const currency = pairName.includes("/")
    ? pairName.split("/").at(-1)!.slice(0, 8)
    : instrument.currency;

  return {
    instrument: currency ? { ...instrument, currency } : instrument,
    bars,
    price: last.close,
    change,
    changePercent: first.close === 0 ? 0 : (change / first.close) * 100,
    asOf: last.timestamp,
    statusLabel: `${formatTimestamp(last.timestamp)} · Kraken 现货`,
  };
}

export function normalizeKrakenPair(symbol: string): string {
  const normalized = symbol.trim().toUpperCase().replace(/^XBT/, "BTC");
  if (normalized.includes("/")) {
    return normalized;
  }
  const separated = normalized.replaceAll(":", "/").replaceAll("-", "/").replaceAll("_", "/");
  if (separated.includes("/")) {
    return separated;
  }
  const quote = ["USDT", "USDC", "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"]
    .find((candidate) => separated.length > candidate.length && separated.endsWith(candidate));
  return quote ? `${separated.slice(0, -quote.length)}/${quote}` : separated;
}

function normalizeOhlcRow(value: unknown): MarketBar | null {
  if (!Array.isArray(value) || value.length < 5) {
    return null;
  }
  const time = numeric(value[0]);
  const open = numeric(value[1]);
  const high = numeric(value[2]);
  const low = numeric(value[3]);
  const close = numeric(value[4]);
  if (
    time === null ||
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
    timestamp: new Date(time * 1_000).toISOString(),
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
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }
  return new Intl.DateTimeFormat("zh-CN", {
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
