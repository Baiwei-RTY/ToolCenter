import type { PluginContext } from "@tool-center/plugin-contract";

import type {
  MarketBar,
  MarketInstrument,
  MarketRange,
  MarketSnapshot,
} from "./market-model";
import { MarketDataError } from "./twelve-data";

export async function fetchBinanceFuturesSnapshot(
  context: PluginContext,
  instrument: MarketInstrument,
  range: MarketRange,
): Promise<MarketSnapshot> {
  const response = await context.network.getJson<unknown>({
    url: buildBinanceFuturesUrl(instrument.symbol, range),
  });
  return parseBinanceFuturesResponse(response, instrument);
}

export function buildBinanceFuturesUrl(symbol: string, range: MarketRange): string {
  const request =
    range === "1d"
      ? { interval: "5m", limit: "288" }
      : range === "5d"
        ? { interval: "1h", limit: "120" }
        : { interval: "8h", limit: "90" };
  const parameters = new URLSearchParams({
    symbol: normalizeBinanceSymbol(symbol),
    interval: request.interval,
    limit: request.limit,
  });
  return `https://fapi.binance.com/fapi/v1/klines?${parameters.toString()}`;
}

export function parseBinanceFuturesResponse(
  response: unknown,
  instrument: MarketInstrument,
): MarketSnapshot {
  if (isRecord(response) && typeof response.msg === "string") {
    const code = typeof response.code === "number" ? response.code : Number(response.code);
    throw new MarketDataError(
      code === -1121 ? "invalid-symbol" : "provider",
      code === -1121
        ? "Binance 无法识别这个期货代码，请使用 USDⓈ-M 格式，例如 BTCUSDT。"
        : "Binance 期货行情暂时不可用，请稍后重试。",
    );
  }
  if (!Array.isArray(response)) {
    throw new MarketDataError("invalid-response", "期货行情服务返回了无法识别的数据。");
  }

  const bars = response
    .map(normalizeKline)
    .filter((bar): bar is MarketBar => bar !== null)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  if (bars.length === 0) {
    throw new MarketDataError("empty", "当前期货产品在所选时间范围内没有可显示的数据。");
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
    statusLabel: `${formatTimestamp(last.timestamp)} · Binance USDⓈ-M`,
  };
}

function normalizeKline(value: unknown): MarketBar | null {
  if (!Array.isArray(value) || value.length < 5) {
    return null;
  }
  const timestamp = numeric(value[0]);
  const open = numeric(value[1]);
  const high = numeric(value[2]);
  const low = numeric(value[3]);
  const close = numeric(value[4]);
  if (
    timestamp === null ||
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
    timestamp: new Date(timestamp).toISOString(),
    open,
    high,
    low,
    close,
  };
}

function normalizeBinanceSymbol(value: string): string {
  return value.replaceAll("/", "").replaceAll("-", "").toUpperCase();
}

function numeric(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
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
      }).format(date);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
