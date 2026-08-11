export const SETTINGS_STORAGE_KEY = "settings.v1";
export const API_CREDENTIAL_KEY = "twelve-data-api-key";
export const MARKET_SCHEMA_VERSION = 1;
export const MAX_INSTRUMENTS = 12;
export const MARKET_CONFIGURATION_CHANGED_EVENT =
  "toolcenter.market-watch:configuration-changed";

export type ChartType = "line" | "candlestick";
export type MarketRange = "1d" | "5d" | "1m";
export type InstrumentKind = "stock" | "forex" | "crypto" | "commodity" | "futures";

export interface MarketInstrument {
  readonly symbol: string;
  readonly name: string;
  readonly currency: string;
  readonly kind: InstrumentKind;
}

export interface MarketSettings {
  readonly schemaVersion: typeof MARKET_SCHEMA_VERSION;
  readonly instruments: readonly MarketInstrument[];
  readonly defaultSymbol: string;
}

export interface WidgetPreferences {
  readonly schemaVersion: typeof MARKET_SCHEMA_VERSION;
  readonly symbol: string;
  readonly chartType: ChartType;
  readonly range: MarketRange;
}

export interface MarketBar {
  readonly timestamp: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

export interface MarketSnapshot {
  readonly instrument: MarketInstrument;
  readonly bars: readonly MarketBar[];
  readonly price: number;
  readonly change: number;
  readonly changePercent: number;
  readonly asOf: string;
  readonly statusLabel: string;
}

export const DEFAULT_INSTRUMENTS: readonly MarketInstrument[] = [
  { symbol: "AAPL", name: "苹果", currency: "USD", kind: "stock" },
  { symbol: "MSFT", name: "微软", currency: "USD", kind: "stock" },
  { symbol: "EUR/USD", name: "欧元 / 美元", currency: "USD", kind: "forex" },
  { symbol: "BTC/USD", name: "比特币", currency: "USD", kind: "crypto" },
  { symbol: "BTCUSDT", name: "比特币永续", currency: "USDT", kind: "futures" },
  { symbol: "ETHUSDT", name: "以太坊永续", currency: "USDT", kind: "futures" },
  { symbol: "SOLUSDT", name: "Solana 永续", currency: "USDT", kind: "futures" },
];

export function createDefaultSettings(): MarketSettings {
  return {
    schemaVersion: MARKET_SCHEMA_VERSION,
    instruments: DEFAULT_INSTRUMENTS,
    defaultSymbol: DEFAULT_INSTRUMENTS[0]!.symbol,
  };
}

export function normalizeSettings(value: unknown): MarketSettings {
  if (!isRecord(value) || !Array.isArray(value.instruments)) {
    return createDefaultSettings();
  }
  const instruments: MarketInstrument[] = [];
  const symbols = new Set<string>();
  for (const candidate of value.instruments) {
    const instrument = normalizeInstrument(candidate);
    if (!instrument || symbols.has(instrument.symbol) || instruments.length >= MAX_INSTRUMENTS) {
      continue;
    }
    symbols.add(instrument.symbol);
    instruments.push(instrument);
  }
  if (instruments.length === 0) {
    return createDefaultSettings();
  }
  const requestedDefault =
    typeof value.defaultSymbol === "string" ? normalizeSymbol(value.defaultSymbol) : "";
  return {
    schemaVersion: MARKET_SCHEMA_VERSION,
    instruments,
    defaultSymbol: symbols.has(requestedDefault) ? requestedDefault : instruments[0]!.symbol,
  };
}

export function normalizeWidgetPreferences(
  value: unknown,
  settings: MarketSettings,
): WidgetPreferences {
  const record = isRecord(value) ? value : {};
  const requestedSymbol =
    typeof record.symbol === "string" ? normalizeSymbol(record.symbol) : "";
  return {
    schemaVersion: MARKET_SCHEMA_VERSION,
    symbol: settings.instruments.some((item) => item.symbol === requestedSymbol)
      ? requestedSymbol
      : settings.defaultSymbol,
    chartType: record.chartType === "candlestick" ? "candlestick" : "line",
    range: record.range === "5d" || record.range === "1m" ? record.range : "1d",
  };
}

export function widgetStorageKey(instanceId: string): string {
  return `widget.${instanceId}.v1`;
}

export function normalizeInstrument(value: unknown): MarketInstrument | null {
  if (!isRecord(value)) {
    return null;
  }
  const symbol = typeof value.symbol === "string" ? normalizeSymbol(value.symbol) : "";
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 40) : "";
  const currency =
    typeof value.currency === "string" ? value.currency.trim().toUpperCase().slice(0, 8) : "";
  const kind = isInstrumentKind(value.kind) ? value.kind : "stock";
  if (!symbol || !name || !currency) {
    return null;
  }
  return { symbol, name, currency, kind };
}

export function normalizeSymbol(value: string): string {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9:/._-]{0,31}$/.test(normalized) ? normalized : "";
}

export function createDemoSnapshot(
  instrument: MarketInstrument,
  range: MarketRange,
): MarketSnapshot {
  if (instrument.symbol === "AAPL" && range === "1d") {
    return createReferenceAppleSnapshot(instrument);
  }
  const count = range === "1d" ? 78 : range === "5d" ? 65 : 22;
  const profile = demoProfile(instrument);
  const rangeFactor = range === "1d" ? 1 : range === "5d" ? 1.8 : 3.2;
  const targetChange = profile.change * rangeFactor;
  const firstClose = Math.max(profile.price * 0.05, profile.price - targetChange);
  const seed = hashString(`${instrument.symbol}:${range}`);
  const random = createSeededRandom(seed);
  const primaryCycles = 2.2 + (seed % 5) * 0.38;
  const secondaryCycles = 5.1 + ((seed >>> 5) % 7) * 0.31;
  const phase = ((seed >>> 11) % 360) * (Math.PI / 180);
  const amplitude = Math.max(profile.price * profile.volatility * rangeFactor, 0.000_05);
  const bars: MarketBar[] = [];
  for (let index = 0; index < count; index += 1) {
    const progress = index / Math.max(1, count - 1);
    const envelope = Math.sin(Math.PI * progress);
    const wave =
      Math.sin(progress * Math.PI * 2 * primaryCycles + phase) * 0.64 +
      Math.sin(progress * Math.PI * 2 * secondaryCycles + phase * 0.37) * 0.24 +
      (random() - 0.5) * 0.34;
    const close = Math.max(
      profile.price * 0.01,
      firstClose + targetChange * progress + wave * amplitude * envelope,
    );
    const open =
      index === 0
        ? close - (random() - 0.42) * amplitude * 0.24
        : bars[index - 1]!.close;
    const wick = amplitude * (0.12 + random() * 0.16);
    const high = Math.max(open, close) + wick;
    const low = Math.max(0, Math.min(open, close) - wick * (0.82 + random() * 0.32));
    bars.push({
      timestamp: demoTimestamp(range, index).toISOString(),
      open,
      high,
      low,
      close,
    });
  }
  const offset = profile.price - bars.at(-1)!.close;
  const adjusted = bars.map((bar) => ({
    ...bar,
    open: bar.open + offset,
    high: bar.high + offset,
    low: bar.low + offset,
    close: bar.close + offset,
  }));
  const price = adjusted.at(-1)!.close;
  const baseline = adjusted[0]!.close;
  const change = price - baseline;
  return {
    instrument,
    bars: adjusted,
    price,
    change,
    changePercent: (change / baseline) * 100,
    asOf: adjusted.at(-1)!.timestamp,
    statusLabel: `${formatDemoTimestamp(adjusted.at(-1)!.timestamp)} · 演示数据`,
  };
}

const AAPL_REFERENCE_SHAPE = [
  212.12, 212.52, 212.68, 212.72, 212.14, 212.2, 211.9, 211.8,
  212.38, 212.76, 212.88, 212.63, 212.65, 212.5, 213.28, 213.58,
  213.92, 213.58, 213.62, 213.2, 213.44, 213.58, 214.02, 213.78,
  213.84, 213.6, 213.68, 214.48, 214.55, 214.95, 214.48, 214.62,
  214.34, 213.87,
] as const;

function createReferenceAppleSnapshot(instrument: MarketInstrument): MarketSnapshot {
  const count = 260;
  const random = createSeededRandom(hashString("AAPL:reference-terminal"));
  const closes = Array.from({ length: count }, (_, index) => {
    const position = (index / (count - 1)) * (AAPL_REFERENCE_SHAPE.length - 1);
    const left = Math.floor(position);
    const right = Math.min(AAPL_REFERENCE_SHAPE.length - 1, left + 1);
    const amount = position - left;
    const base =
      AAPL_REFERENCE_SHAPE[left]! +
      (AAPL_REFERENCE_SHAPE[right]! - AAPL_REFERENCE_SHAPE[left]!) * amount;
    const noise = index === 0 || index === count - 1 ? 0 : (random() - 0.5) * 0.18;
    return base + noise;
  });
  closes[closes.length - 1] = 213.87;
  const bars = closes.map((close, index): MarketBar => {
    const open = index === 0 ? close - 0.03 : closes[index - 1]!;
    const spread = Math.max(Math.abs(close - open), 0.035 + random() * 0.03);
    const totalMinutes = 570 + (378 * index) / (count - 1);
    return {
      timestamp: new Date(2026, 6, 31, 0, totalMinutes).toISOString(),
      open,
      high: Math.max(open, close) + spread * (0.35 + random() * 0.4),
      low: Math.min(open, close) - spread * (0.35 + random() * 0.4),
      close,
    };
  });
  return {
    instrument,
    bars,
    price: 213.87,
    change: 2.41,
    changePercent: 1.14,
    asOf: bars.at(-1)!.timestamp,
    statusLabel: "7月31日收盘 · 周末休市",
  };
}

export function rangeLabel(range: MarketRange): string {
  return range === "1d" ? "1日" : range === "5d" ? "5日" : "1月";
}

function isInstrumentKind(value: unknown): value is InstrumentKind {
  return (
    value === "stock" ||
    value === "forex" ||
    value === "crypto" ||
    value === "commodity" ||
    value === "futures"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function demoProfile(instrument: MarketInstrument): {
  readonly price: number;
  readonly change: number;
  readonly volatility: number;
} {
  const known: Readonly<
    Record<string, { readonly price: number; readonly change: number }>
  > = {
    AAPL: { price: 213.87, change: 2.41 },
    MSFT: { price: 514.68, change: -3.72 },
    "EUR/USD": { price: 1.0842, change: 0.0028 },
    "BTC/USD": { price: 68_120.45, change: -912.3 },
    BTCUSDT: { price: 68_088.6, change: 645.2 },
    ETHUSDT: { price: 3_294.12, change: 64.38 },
    SOLUSDT: { price: 178.54, change: -3.92 },
  };
  const fallbackPrice =
    instrument.kind === "forex"
      ? 1.25
      : instrument.kind === "crypto" || instrument.kind === "futures"
        ? 1_250
        : 125;
  const reference = known[instrument.symbol] ?? {
    price: fallbackPrice,
    change: fallbackPrice * (((hashString(instrument.symbol) % 13) - 6) / 500),
  };
  return {
    ...reference,
    volatility:
      instrument.kind === "forex"
        ? 0.000_9
        : instrument.kind === "crypto" || instrument.kind === "futures"
          ? 0.009
          : 0.004,
  };
}

function demoTimestamp(range: MarketRange, index: number): Date {
  if (range === "1d") {
    return new Date(2026, 6, 24, 9, 30 + index * 5);
  }
  if (range === "5d") {
    const tradingDay = Math.floor(index / 13);
    const barInDay = index % 13;
    return new Date(2026, 6, 20 + tradingDay, 9, 30 + barInDay * 30);
  }
  const date = new Date(2026, 5, 25);
  let remaining = index;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      remaining -= 1;
    }
  }
  date.setHours(16, 0, 0, 0);
  return date;
}

function formatDemoTimestamp(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
