import type { PluginContext } from "@tool-center/plugin-contract";

import {
  API_CREDENTIAL_KEY,
  type MarketBar,
  type MarketInstrument,
  type MarketRange,
  type MarketSnapshot,
} from "./market-model";

const PUBLIC_DEMO_SYMBOLS = new Set(["AAPL", "EUR/USD", "BTC/USD"]);

interface TwelveDataResponse {
  readonly code?: unknown;
  readonly status?: unknown;
  readonly message?: unknown;
  readonly meta?: unknown;
  readonly values?: unknown;
}

export class MarketDataError extends Error {
  readonly kind:
    | "provider"
    | "authentication"
    | "rate-limit"
    | "invalid-symbol"
    | "invalid-response"
    | "empty";

  constructor(kind: MarketDataError["kind"], message: string) {
    super(message);
    this.name = "MarketDataError";
    this.kind = kind;
  }
}

export async function fetchMarketSnapshot(
  context: PluginContext,
  instrument: MarketInstrument,
  range: MarketRange,
  access: "credential" | "public-demo" = "credential",
): Promise<MarketSnapshot> {
  const response = await context.network.getJson<TwelveDataResponse>({
    url: buildTimeSeriesUrl(instrument.symbol, range, access === "public-demo"),
    authorization:
      access === "credential"
        ? {
            credentialKey: API_CREDENTIAL_KEY,
            scheme: "apikey",
          }
        : undefined,
  });
  return parseTimeSeriesResponse(
    response,
    instrument,
    access === "public-demo" ? "Twelve Data 公开演示" : "Twelve Data",
  );
}

export function supportsPublicDemo(symbol: string): boolean {
  return PUBLIC_DEMO_SYMBOLS.has(symbol);
}

export function buildTimeSeriesUrl(
  symbol: string,
  range: MarketRange,
  publicDemo = false,
): string {
  const request =
    range === "1d"
      ? { interval: "1min", outputsize: "390" }
      : range === "5d"
        ? { interval: "15min", outputsize: "130" }
        : { interval: "1day", outputsize: "32" };
  const parameters = new URLSearchParams({
    symbol,
    interval: request.interval,
    outputsize: request.outputsize,
    order: "ASC",
    timezone: "Exchange",
  });
  if (publicDemo) {
    parameters.set("apikey", "demo");
  }
  return `https://api.twelvedata.com/time_series?${parameters.toString()}`;
}

export function parseTimeSeriesResponse(
  response: TwelveDataResponse,
  instrument: MarketInstrument,
  sourceLabel = "Twelve Data",
): MarketSnapshot {
  if (!isRecord(response)) {
    throw new MarketDataError("invalid-response", "行情服务返回了无法识别的数据。");
  }
  if (response.status === "error") {
    throw classifyProviderError(response.code, response.message);
  }
  if (!Array.isArray(response.values)) {
    throw new MarketDataError("invalid-response", "行情服务没有返回价格序列。");
  }

  const bars = response.values
    .map(normalizeBar)
    .filter((bar): bar is MarketBar => bar !== null)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  if (bars.length === 0) {
    throw new MarketDataError("empty", "当前产品在所选时间范围内没有可显示的数据。");
  }
  const last = bars.at(-1)!;
  const first = bars[0]!;
  const change = last.close - first.close;
  return {
    instrument: currencyFromMeta(response.meta, instrument),
    bars,
    price: last.close,
    change,
    changePercent: first.close === 0 ? 0 : (change / first.close) * 100,
    asOf: last.timestamp,
    statusLabel: `${formatTimestamp(last.timestamp)} · ${sourceLabel}`,
  };
}

function normalizeBar(value: unknown): MarketBar | null {
  if (!isRecord(value) || typeof value.datetime !== "string") {
    return null;
  }
  const open = numeric(value.open);
  const high = numeric(value.high);
  const low = numeric(value.low);
  const close = numeric(value.close);
  if (
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
    timestamp: value.datetime,
    open,
    high,
    low,
    close,
  };
}

function currencyFromMeta(meta: unknown, instrument: MarketInstrument): MarketInstrument {
  if (!isRecord(meta) || typeof meta.currency !== "string") {
    return instrument;
  }
  const currency = meta.currency.trim().toUpperCase().slice(0, 8);
  return currency ? { ...instrument, currency } : instrument;
}

function numeric(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function formatTimestamp(value: string): string {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function classifyProviderError(code: unknown, message: unknown): MarketDataError {
  const numericCode = typeof code === "number" ? code : Number(code);
  const providerMessage = typeof message === "string" ? message.toLowerCase() : "";
  if (numericCode === 401 || providerMessage.includes("api key")) {
    return new MarketDataError(
      "authentication",
      "Twelve Data API Key 无效或已失效，请在设置中更新凭据。",
    );
  }
  if (numericCode === 429 || providerMessage.includes("rate limit")) {
    return new MarketDataError(
      "rate-limit",
      "免费行情接口已达到当前频率限制，请稍后重试。",
    );
  }
  if (
    numericCode === 404 ||
    providerMessage.includes("symbol") ||
    providerMessage.includes("not found")
  ) {
    return new MarketDataError(
      "invalid-symbol",
      "行情服务无法识别这个产品代码，请检查代码和产品类型。",
    );
  }
  return new MarketDataError("provider", "行情服务暂时无法处理本次请求，请稍后重试。");
}
