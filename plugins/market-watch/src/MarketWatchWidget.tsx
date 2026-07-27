import type { WidgetProps } from "@tool-center/plugin-contract";
import { useId, type CSSProperties } from "react";

import marketIcon from "./assets/market-grid.svg";
import refreshIcon from "./assets/action-refresh.svg";
import {
  type ChartType,
  type MarketBar,
  type MarketRange,
  type MarketSnapshot,
  rangeLabel,
} from "./market-model";
import { useMarketWatch, type MarketWatchController } from "./use-market-watch";
import "./styles.css";

const chartTypes: readonly { readonly value: ChartType; readonly label: string }[] = [
  { value: "line", label: "折线" },
  { value: "candlestick", label: "K线" },
];
const ranges: readonly MarketRange[] = ["1d", "5d", "1m"];

export default function MarketWatchWidget({ context, widget }: WidgetProps) {
  const market = useMarketWatch(context, widget.instanceId, widget.visible);

  return (
    <section
      className={`market-watch market-watch--${widget.size}`}
      aria-label="市场行情"
      data-chart-type={market.preferences.chartType}
    >
      <header className="market-watch__title">
        <img className="market-watch__title-icon" src={marketIcon} alt="" aria-hidden="true" />
        <strong>市场行情</strong>
        {market.phase === "ready" ? (
          <span
            className="market-watch__connection"
            data-state={market.stale ? "stale" : market.demo ? "demo" : "online"}
          >
            {market.stale ? "离线缓存" : market.demo ? "演示" : "在线"}
          </span>
        ) : null}
      </header>

      {market.phase === "ready" && market.snapshot ? (
        <MarketView market={market} locked={widget.locked} />
      ) : (
        <MarketState market={market} />
      )}
    </section>
  );
}

function MarketView({
  market,
  locked,
}: {
  readonly market: MarketWatchController;
  readonly locked: boolean;
}) {
  const snapshot = market.snapshot!;
  const positive = snapshot.change >= 0;
  const formattedPrice = formatPrice(snapshot.price);
  const priceLength = formattedPrice.length;

  return (
    <div className="market-watch__body">
      <section className="market-watch__quote" aria-label="当前报价">
        <label className="market-watch__instrument">
          <span className="market-watch__sr-only">金融产品</span>
          <select
            value={market.preferences.symbol}
            disabled={locked}
            onChange={(event) => market.selectSymbol(event.target.value)}
          >
            {market.settings.instruments.map((instrument) => (
              <option key={instrument.symbol} value={instrument.symbol}>
                {instrument.symbol} · {instrument.name}
              </option>
            ))}
          </select>
        </label>
        <div
          className="market-watch__price"
          data-length={priceLength >= 11 ? "extra-long" : priceLength >= 8 ? "long" : undefined}
        >
          <strong>{formattedPrice}</strong>
          <span>{snapshot.instrument.currency}</span>
        </div>
        <div
          className={`market-watch__change market-watch__change--${positive ? "positive" : "negative"}`}
          title={`${rangeLabel(market.preferences.range)}区间涨跌`}
        >
          <span className="market-watch__direction" aria-hidden="true">
            {positive ? "涨" : "跌"}
          </span>
          <strong>
            <span>{signed(snapshot.change, fractionDigits(snapshot.price))}</span>
            <span>{signed(snapshot.changePercent, 2)}%</span>
          </strong>
        </div>
        <div
          className="market-watch__status"
          data-stale={market.stale ? "true" : undefined}
          title={
            market.stale
              ? `${market.errorMessage ?? "更新失败"}；${snapshot.statusLabel}`
              : snapshot.statusLabel
          }
        >
          <span className="market-watch__status-dot" aria-hidden="true" />
          <span>
            {market.stale ? "更新失败 · 显示上次行情" : snapshot.statusLabel}
          </span>
        </div>
      </section>

      <section className="market-watch__chart-pane" aria-label="行情图表">
        <div className="market-watch__chart-controls">
          <SegmentedControl
            label="图表类型"
            items={chartTypes}
            value={market.preferences.chartType}
            disabled={locked}
            onChange={market.setChartType}
          />
          <SegmentedControl
            label="时间范围"
            items={ranges.map((range) => ({ value: range, label: rangeLabel(range) }))}
            value={market.preferences.range}
            disabled={locked}
            onChange={market.setRange}
          />
          <button
            className="market-watch__refresh"
            type="button"
            aria-label="刷新行情"
            title="刷新行情"
            disabled={locked || market.refreshing}
            data-refreshing={market.refreshing ? "true" : undefined}
            onClick={market.refresh}
          >
            <img src={refreshIcon} alt="" aria-hidden="true" />
          </button>
        </div>
        <MarketChart
          snapshot={snapshot}
          chartType={market.preferences.chartType}
          range={market.preferences.range}
        />
      </section>
      <span className="market-watch__sr-only" role="status" aria-live="polite">
        {market.refreshing
          ? `正在更新 ${snapshot.instrument.symbol}`
          : `${snapshot.instrument.symbol} 最新价格 ${formattedPrice} ${snapshot.instrument.currency}`}
      </span>
    </div>
  );
}

function SegmentedControl<T extends string>({
  label,
  items,
  value,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly items: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly disabled: boolean;
  readonly onChange: (value: T) => void;
}) {
  return (
    <div className="market-watch__segments" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={value === item.value}
          disabled={disabled}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function MarketChart({
  snapshot,
  chartType,
  range,
}: {
  readonly snapshot: MarketSnapshot;
  readonly chartType: ChartType;
  readonly range: MarketRange;
}) {
  const gradientId = `market-area-${useId().replaceAll(":", "")}`;
  const bounds = chartBounds(snapshot.bars);
  const ticks = [bounds.maximum, (bounds.maximum + bounds.minimum) / 2, bounds.minimum];
  const timeLabels = chartTimeLabels(snapshot.bars, range);
  const lastPriceY = yFor(snapshot.price, bounds);
  const lastPriceStyle = {
    "--market-watch-last-price-y": `${Math.min(92, Math.max(8, (lastPriceY / 112) * 100))}%`,
  } as CSSProperties;

  return (
    <div className="market-watch__chart" style={lastPriceStyle}>
      <svg
        viewBox="0 0 320 112"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${snapshot.instrument.symbol} ${
          chartType === "line" ? "折线图" : "K线图"
        }`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <g className="market-watch__grid">
          <line x1="0" y1="8" x2="294" y2="8" />
          <line x1="0" y1="56" x2="294" y2="56" />
          <line x1="0" y1="104" x2="294" y2="104" />
          <line x1="16" y1="0" x2="16" y2="104" />
          <line x1="108" y1="0" x2="108" y2="104" />
          <line x1="200" y1="0" x2="200" y2="104" />
          <line x1="292" y1="0" x2="292" y2="104" />
        </g>
        <line
          className="market-watch__price-guide"
          x1="0"
          y1={lastPriceY}
          x2="294"
          y2={lastPriceY}
        />
        {chartType === "line" ? (
          <LineSeries bars={snapshot.bars} bounds={bounds} gradientId={gradientId} />
        ) : (
          <CandlestickSeries bars={snapshot.bars} bounds={bounds} />
        )}
      </svg>
      <div className="market-watch__y-axis" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick}>{formatAxis(tick)}</span>
        ))}
      </div>
      <div className="market-watch__x-axis" aria-hidden="true">
        {timeLabels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <output className="market-watch__last-price">{formatPrice(snapshot.price)}</output>
    </div>
  );
}

function LineSeries({
  bars,
  bounds,
  gradientId,
}: {
  readonly bars: readonly MarketBar[];
  readonly bounds: ChartBounds;
  readonly gradientId: string;
}) {
  const points = bars.map((bar, index) => [
    xFor(index, bars.length),
    yFor(bar.close, bounds),
  ] as const);
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const first = points[0]!;
  const last = points.at(-1)!;
  const area = `${line} L${last[0]},104 L${first[0]},104 Z`;
  return (
    <g>
      <path className="market-watch__area" d={area} fill={`url(#${gradientId})`} />
      <path className="market-watch__line" d={line} />
      <circle className="market-watch__last-dot" cx={last[0]} cy={last[1]} r="3.5" />
    </g>
  );
}

function CandlestickSeries({
  bars,
  bounds,
}: {
  readonly bars: readonly MarketBar[];
  readonly bounds: ChartBounds;
}) {
  const sampled = aggregateBars(bars, 34);
  const step = 292 / Math.max(1, sampled.length);
  const width = Math.max(2, Math.min(6, step * 0.58));
  return (
    <g className="market-watch__candles">
      {sampled.map((bar, index) => {
        const x = 2 + index * step + step / 2;
        const positive = bar.close >= bar.open;
        const openY = yFor(bar.open, bounds);
        const closeY = yFor(bar.close, bounds);
        const top = Math.min(openY, closeY);
        const height = Math.max(1.5, Math.abs(closeY - openY));
        return (
          <g
            key={`${bar.timestamp}-${index}`}
            className={positive ? "market-watch__candle--up" : "market-watch__candle--down"}
          >
            <title>
              {bar.timestamp} 开 {formatPrice(bar.open)} 高 {formatPrice(bar.high)} 低{" "}
              {formatPrice(bar.low)} 收 {formatPrice(bar.close)}
            </title>
            <line x1={x} y1={yFor(bar.high, bounds)} x2={x} y2={yFor(bar.low, bounds)} />
            <rect x={x - width / 2} y={top} width={width} height={height} rx="0.5" />
          </g>
        );
      })}
    </g>
  );
}

function MarketState({ market }: { readonly market: MarketWatchController }) {
  const copy =
    market.phase === "permission"
      ? {
          title: "需要网络权限",
          message: "允许后才能读取最新行情。",
          action: "允许访问",
        }
      : market.phase === "denied"
        ? {
            title: "网络权限已拒绝",
            message: "请在插件管理中重置权限。",
            action: "重新检查",
          }
        : market.phase === "unconfigured"
          ? {
              title: "此产品需要免费 Key",
              message: "请在“市场行情设置”中保存 Twelve Data 免费 API Key。",
              action: "重新检查",
            }
          : market.phase === "empty"
            ? {
                title: "暂无行情数据",
                message: market.errorMessage ?? "换一个产品或时间范围后重试。",
                action: "刷新",
              }
            : market.phase === "unavailable"
              ? {
                  title: "行情服务暂不可用",
                  message: market.errorMessage ?? "请检查网络后重试。",
                  action: "重试",
                }
              : market.phase === "error"
                ? {
                    title: "行情加载失败",
                    message: market.errorMessage ?? "请稍后重试。",
                    action: "重试",
                  }
                : undefined;

  if (!copy) {
    return (
      <div className="market-watch__state market-watch__state--loading" role="status">
        <span />
        <span />
        <span />
        <em>正在读取行情…</em>
      </div>
    );
  }
  return (
    <div className="market-watch__state" role={market.phase === "error" ? "alert" : "status"}>
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.message}</p>
      </div>
      <button
        type="button"
        onClick={market.phase === "permission" ? market.requestPermission : market.refresh}
      >
        {copy.action}
      </button>
    </div>
  );
}

interface ChartBounds {
  readonly minimum: number;
  readonly maximum: number;
}

function chartBounds(bars: readonly MarketBar[]): ChartBounds {
  const values = bars.flatMap((bar) => [bar.low, bar.high]);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max(0.01, (maximum - minimum) * 0.08);
  return { minimum: minimum - padding, maximum: maximum + padding };
}

function xFor(index: number, length: number): number {
  return (index / Math.max(1, length - 1)) * 292;
}

function yFor(value: number, bounds: ChartBounds): number {
  return 8 + ((bounds.maximum - value) / (bounds.maximum - bounds.minimum)) * 96;
}

function aggregateBars(bars: readonly MarketBar[], maximum: number): readonly MarketBar[] {
  if (bars.length <= maximum) {
    return bars;
  }
  const result: MarketBar[] = [];
  for (let index = 0; index < maximum; index += 1) {
    const start = Math.floor((index * bars.length) / maximum);
    const end = Math.max(start + 1, Math.floor(((index + 1) * bars.length) / maximum));
    const bucket = bars.slice(start, end);
    const first = bucket[0]!;
    const last = bucket.at(-1)!;
    result.push({
      timestamp: last.timestamp,
      open: first.open,
      high: Math.max(...bucket.map((bar) => bar.high)),
      low: Math.min(...bucket.map((bar) => bar.low)),
      close: last.close,
    });
  }
  return result;
}

function chartTimeLabels(
  bars: readonly MarketBar[],
  range: MarketRange,
): readonly string[] {
  const positions = [0, 1 / 3, 2 / 3, 1];
  return positions.map((position) => {
    const bar = bars[Math.round(position * Math.max(0, bars.length - 1))]!;
    const normalized = bar.timestamp.includes("T")
      ? bar.timestamp
      : bar.timestamp.replace(" ", "T");
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return bar.timestamp.slice(-5);
    }
    return range === "1d"
      ? new Intl.DateTimeFormat("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(date)
      : new Intl.DateTimeFormat("zh-CN", {
          month: "numeric",
          day: "numeric",
        }).format(date);
  });
}

function formatPrice(value: number): string {
  const digits = fractionDigits(value);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatAxis(value: number): string {
  return value >= 100 ? value.toFixed(0) : value.toFixed(fractionDigits(value));
}

function signed(value: number, digits: number): string {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function fractionDigits(value: number): number {
  const absolute = Math.abs(value);
  return absolute < 0.01 ? 6 : absolute < 10 ? 4 : 2;
}
