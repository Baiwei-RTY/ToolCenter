import { CandlestickChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import {
  createElement,
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "@mdui/icons/calendar-month--outlined.js";
import "@mdui/icons/expand-more--rounded.js";
import "@mdui/icons/refresh--rounded.js";
import "@mdui/icons/settings--rounded.js";

import {
  type ChartType,
  type MarketBar,
  type MarketRange,
  type MarketSnapshot,
  rangeLabel,
} from "./market-model";
import type {
  MarketWatchController,
  MarketWatchPhase,
} from "./use-market-watch";

echarts.use([
  LineChart,
  CandlestickChart,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const chartTypes: readonly { readonly value: ChartType; readonly label: string }[] = [
  { value: "line", label: "折线" },
  { value: "candlestick", label: "K线" },
];
const ranges: readonly MarketRange[] = ["1d", "5d", "1m"];
const FULL_ZOOM = Object.freeze({ start: 0, end: 1 });
const REFERENCE_TIME_FRACTIONS = [0, 0.2, 0.387, 0.55, 0.715, 0.855, 1] as const;
const REFERENCE_TIME_LABELS = ["09:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:48"] as const;
const COMPACT_REFERENCE_TIME_FRACTIONS = [0, 0.387, 0.715, 1] as const;
const COMPACT_REFERENCE_TIME_LABELS = ["09:30", "11:30", "13:30", "15:48"] as const;

interface MarketTerminalProps {
  readonly market: MarketWatchController;
  readonly locked?: boolean;
  readonly variant: "page" | "widget";
  readonly size?: "small" | "medium" | "wide";
  readonly onOpenSettings?: () => void;
}

interface ZoomWindow {
  readonly start: number;
  readonly end: number;
}

export function MarketTerminal({
  market,
  locked = false,
  variant,
  size = "wide",
  onOpenSettings,
}: MarketTerminalProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedInstrument =
    market.settings.instruments.find(
      (instrument) => instrument.symbol === market.preferences.symbol,
    ) ?? market.settings.instruments[0];
  const snapshot = market.snapshot;
  const positive = (snapshot?.change ?? 0) >= 0;
  const connection = connectionState(market.phase, market.demo, market.stale);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <section
      className={`market-terminal market-terminal--${variant} market-terminal--${size}`}
      aria-label="市场行情"
      data-phase={market.phase}
      data-stale={market.stale ? "true" : undefined}
    >
      {variant === "page" ? (
        <header className="market-terminal__header">
          <div className="market-terminal__instrument-area">
            <div className="market-terminal__picker" ref={menuRef}>
              <button
                className="market-terminal__instrument-button"
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                disabled={locked}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span>
                  {selectedInstrument?.symbol ?? "—"} · {selectedInstrument?.name ?? "未选择"}
                </span>
                <Icon name="chevron" className={menuOpen ? "is-open" : ""} />
              </button>
              {menuOpen ? (
                <ProductMenu
                  market={market}
                  onManage={
                    onOpenSettings
                      ? () => {
                          setMenuOpen(false);
                          onOpenSettings();
                        }
                      : undefined
                  }
                  onSelect={(symbol) => {
                    market.selectSymbol(symbol);
                    setMenuOpen(false);
                  }}
                />
              ) : null}
            </div>
            <div className="market-terminal__connection" data-state={connection.state}>
              <span className="market-terminal__status-dot" aria-hidden="true" />
              <span>{connection.label}</span>
            </div>
          </div>

          <nav className="market-terminal__controls" aria-label="图表控制">
            <div className="market-terminal__control-group market-terminal__mode-control">
              {chartTypes.map((item) => (
                <button
                  type="button"
                  aria-pressed={market.preferences.chartType === item.value}
                  className={market.preferences.chartType === item.value ? "is-active" : ""}
                  disabled={locked}
                  key={item.value}
                  onClick={() => market.setChartType(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <span className="market-terminal__control-divider" aria-hidden="true" />
            <div className="market-terminal__control-group market-terminal__range-control">
              {ranges.map((range) => (
                <button
                  type="button"
                  aria-pressed={market.preferences.range === range}
                  className={market.preferences.range === range ? "is-active" : ""}
                  disabled={locked}
                  key={range}
                  onClick={() => market.setRange(range)}
                >
                  {rangeLabel(range)}
                </button>
              ))}
            </div>
            <button
              className="market-terminal__refresh-button"
              type="button"
              aria-label="刷新行情"
              aria-busy={market.refreshing}
              disabled={locked || market.refreshing}
              onClick={market.refresh}
            >
              <Icon name="refresh" className={market.refreshing ? "is-refreshing" : ""} />
            </button>
          </nav>
        </header>
      ) : null}

      <section className="market-terminal__chart-zone">
        {variant === "widget" ? (
          <div className="market-terminal__widget-toolbar">
            <div className="market-terminal__widget-picker" ref={menuRef}>
              <button
                className="market-terminal__widget-instrument"
                type="button"
                aria-label="切换行情产品"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                disabled={locked}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span>{selectedInstrument?.symbol ?? "—"}</span>
                <Icon name="chevron" className={menuOpen ? "is-open" : ""} />
              </button>
              {menuOpen ? (
                <ProductMenu
                  market={market}
                  onSelect={(symbol) => {
                    market.selectSymbol(symbol);
                    setMenuOpen(false);
                  }}
                />
              ) : null}
            </div>

            <nav className="market-terminal__widget-controls" aria-label="小组件图表控制">
              <div className="market-terminal__widget-control-group">
                {chartTypes.map((item) => (
                  <button
                    type="button"
                    aria-pressed={market.preferences.chartType === item.value}
                    className={market.preferences.chartType === item.value ? "is-active" : ""}
                    disabled={locked}
                    key={item.value}
                    onClick={() => market.setChartType(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <span className="market-terminal__widget-divider" aria-hidden="true" />
              <div className="market-terminal__widget-control-group">
                {ranges.map((range) => (
                  <button
                    type="button"
                    aria-pressed={market.preferences.range === range}
                    className={market.preferences.range === range ? "is-active" : ""}
                    disabled={locked}
                    key={range}
                    onClick={() => market.setRange(range)}
                  >
                    {rangeLabel(range)}
                  </button>
                ))}
              </div>
            </nav>
          </div>
        ) : null}

        {snapshot ? (
          <div className="market-terminal__quote" aria-live="polite">
            <div className="market-terminal__price-row">
              <strong>{formatPrice(snapshot.price)}</strong>
              <span>{snapshot.instrument.currency}</span>
            </div>
            <div className={`market-terminal__change-row ${positive ? "is-positive" : "is-negative"}`}>
              <span>{formatSigned(snapshot.change, fractionDigits(snapshot.price))}</span>
              <span>{formatSigned(snapshot.changePercent, 2)}%</span>
            </div>
          </div>
        ) : null}

        {snapshot ? (
          <MarketChart
            key={`${snapshot.instrument.symbol}:${market.preferences.range}`}
            snapshot={snapshot}
            range={market.preferences.range}
            chartType={market.preferences.chartType}
            compact={variant === "widget"}
          />
        ) : null}

        {market.phase !== "ready" || !snapshot ? (
          <MarketTerminalState market={market} onOpenSettings={onOpenSettings} />
        ) : null}
      </section>

      {variant === "page" ? (
        <footer className="market-terminal__footer">
          <Icon name="calendar" />
          <span title={market.errorMessage}>
            {market.stale
              ? "更新失败 · 显示上次行情"
              : snapshot?.statusLabel ?? footerStatus(market.phase)}
          </span>
        </footer>
      ) : null}
      <span className="market-terminal__sr-only" role="status" aria-live="polite">
        {market.refreshing
          ? `正在更新 ${selectedInstrument?.symbol ?? "行情"}`
          : snapshot
            ? `${snapshot.instrument.symbol} 最新价格 ${formatPrice(snapshot.price)} ${snapshot.instrument.currency}`
            : footerStatus(market.phase)}
      </span>
    </section>
  );
}

function ProductMenu({
  market,
  onSelect,
  onManage,
}: {
  readonly market: MarketWatchController;
  readonly onSelect: (symbol: string) => void;
  readonly onManage?: () => void;
}) {
  return (
    <div className="market-terminal__product-menu" role="menu" aria-label="选择行情产品">
      {market.settings.instruments.map((instrument) => (
        <button
          type="button"
          role="menuitemradio"
          aria-checked={market.preferences.symbol === instrument.symbol}
          className={market.preferences.symbol === instrument.symbol ? "is-selected" : ""}
          key={instrument.symbol}
          onClick={() => onSelect(instrument.symbol)}
        >
          <strong>{instrument.symbol}</strong>
          <span>{instrument.name}</span>
        </button>
      ))}
      {onManage ? (
        <button
          className="market-terminal__manage-button"
          type="button"
          role="menuitem"
          onClick={onManage}
        >
          <span className="market-terminal__manage-label">
            <Icon name="settings" />
            管理自选与数据源
          </span>
        </button>
      ) : null}
    </div>
  );
}

function MarketChart({
  snapshot,
  range,
  chartType,
  compact,
}: {
  readonly snapshot: MarketSnapshot;
  readonly range: MarketRange;
  readonly chartType: ChartType;
  readonly compact: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  const zoomRef = useRef<ZoomWindow>(FULL_ZOOM);
  const dragStateRef = useRef<{
    readonly pointerId: number;
    readonly originX: number;
    readonly start: number;
    readonly span: number;
  } | null>(null);
  const [width, setWidth] = useState(1_928);
  const [zoom, setZoom] = useState<ZoomWindow>(FULL_ZOOM);
  const [dragging, setDragging] = useState(false);
  const visibleBounds = useMemo(
    () => getVisibleBounds(snapshot.bars.length, zoom),
    [snapshot.bars.length, zoom],
  );
  const option = useMemo(
    () => buildChartOption(snapshot, range, chartType, width, zoom, compact),
    [chartType, compact, range, snapshot, width, zoom],
  );

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const chart = echarts.init(host, null, { renderer: "canvas" });
    chartRef.current = chart;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.max(1, Math.round(entries[0]!.contentRect.width)));
      chart.resize();
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const applyZoom = (nextZoom: ZoomWindow) => {
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
    };

    const updateZoom = (direction: number, anchorRatio: number) => {
      const current = zoomRef.current;
      const currentSpan = current.end - current.start;
      const minSpan = Math.max(18 / Math.max(1, snapshot.bars.length - 1), 0.06);
      const nextSpan = clamp(currentSpan * (direction < 0 ? 0.82 : 1.22), minSpan, 1);
      if (Math.abs(nextSpan - currentSpan) < 0.000_1) {
        return;
      }
      if (nextSpan >= 0.999_9) {
        applyZoom(FULL_ZOOM);
        return;
      }
      const anchor = current.start + currentSpan * anchorRatio;
      const nextStart = clamp(anchor - nextSpan * anchorRatio, 0, 1 - nextSpan);
      applyZoom({
        start: Number(nextStart.toFixed(6)),
        end: Number((nextStart + nextSpan).toFixed(6)),
      });
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const rectangle = host.getBoundingClientRect();
      const plotLeft = rectangle.width * 0.028;
      const plotRight = rectangle.width * (compact ? 0.86 : 1 - 0.0855);
      const anchorRatio = clamp(
        (event.clientX - rectangle.left - plotLeft) / Math.max(1, plotRight - plotLeft),
        0,
        1,
      );
      updateZoom(Math.sign(event.deltaY), anchorRatio);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.isPrimary === false) {
        return;
      }
      const current = zoomRef.current;
      const span = current.end - current.start;
      if (span >= 0.999_9) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      host.focus({ preventScroll: true });
      chartRef.current?.dispatchAction({ type: "hideTip" });
      dragStateRef.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        start: current.start,
        span,
      };
      host.setPointerCapture(event.pointerId);
      setDragging(true);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      chartRef.current?.dispatchAction({ type: "hideTip" });
      const rectangle = host.getBoundingClientRect();
      const plotWidth = Math.max(
        1,
        rectangle.width * ((compact ? 0.86 : 1 - 0.0855) - 0.028),
      );
      const nextStart = clamp(
        dragState.start - ((event.clientX - dragState.originX) / plotWidth) * dragState.span,
        0,
        1 - dragState.span,
      );
      applyZoom({
        start: Number(nextStart.toFixed(6)),
        end: Number((nextStart + dragState.span).toFixed(6)),
      });
    };

    const finishDrag = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      dragStateRef.current = null;
      if (host.hasPointerCapture(event.pointerId)) {
        host.releasePointerCapture(event.pointerId);
      }
      setDragging(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "0" || event.key === "Home") {
        event.preventDefault();
        applyZoom(FULL_ZOOM);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        updateZoom(-1, 0.5);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        updateZoom(1, 0.5);
      }
    };

    host.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    host.addEventListener("pointerdown", handlePointerDown, true);
    host.addEventListener("pointermove", handlePointerMove, true);
    host.addEventListener("pointerup", finishDrag, true);
    host.addEventListener("pointercancel", finishDrag, true);
    host.addEventListener("lostpointercapture", finishDrag, true);
    host.addEventListener("keydown", handleKeyDown);
    return () => {
      host.removeEventListener("wheel", handleWheel, true);
      host.removeEventListener("pointerdown", handlePointerDown, true);
      host.removeEventListener("pointermove", handlePointerMove, true);
      host.removeEventListener("pointerup", finishDrag, true);
      host.removeEventListener("pointercancel", finishDrag, true);
      host.removeEventListener("lostpointercapture", finishDrag, true);
      host.removeEventListener("keydown", handleKeyDown);
      dragStateRef.current = null;
    };
  }, [compact, snapshot.bars.length]);

  const showReferenceAxis =
    snapshot.instrument.symbol === "AAPL" &&
    range === "1d" &&
    snapshot.statusLabel.includes("周末休市") &&
    zoom.end - zoom.start >= 0.999_9;
  const compactTop = compactGridTop(width);
  const referenceAxisLabels: readonly (readonly [string, string])[] = compact
    ? [215, 214, 213, 212, 211].map((value) => {
        const top = compactTop + ((215 - value) / (215 - 210.4)) * (100 - compactTop - 15);
        return [value.toFixed(2), `${Number(top.toFixed(1))}%`];
      })
    : [
        ["215.00", "23.7%"],
        ["214.00", "39.8%"],
        ["213.00", "56.7%"],
        ["212.00", "71.9%"],
        ["211.00", "88.3%"],
      ];

  return (
    <>
    <div
      className="market-terminal__chart"
      ref={hostRef}
      role="application"
      tabIndex={0}
      data-zoomed={zoom.end - zoom.start < 0.999_9 ? "true" : "false"}
      data-dragging={dragging ? "true" : "false"}
      data-visible-start={visibleBounds.startIndex}
      data-visible-end={visibleBounds.endIndex}
      title="滚轮缩放；按住鼠标左键拖动左右查看；按 0 恢复完整视图"
      aria-label={`${snapshot.instrument.symbol} ${chartType === "line" ? "折线图" : "K线图"}，支持滚轮缩放和按住鼠标左键拖动时间范围`}
    />
      {showReferenceAxis ? (
        <div className="market-terminal__reference-axis" aria-hidden="true">
          {referenceAxisLabels.map(([label, top]) => (
            <span style={{ "--market-axis-top": top } as CSSProperties} key={label}>{label}</span>
          ))}
        </div>
      ) : null}
    </>
  );
}

function buildChartOption(
  snapshot: MarketSnapshot,
  range: MarketRange,
  chartType: ChartType,
  width: number,
  zoom: ZoomWindow,
  compact: boolean,
): EChartsCoreOption {
  const { startIndex, endIndex } = getVisibleBounds(snapshot.bars.length, zoom);
  const bars = snapshot.bars.slice(startIndex, endIndex + 1);
  const includesLatest = endIndex === snapshot.bars.length - 1;
  const isFullView = startIndex === 0 && includesLatest;
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isReferencePreview =
    snapshot.instrument.symbol === "AAPL" &&
    range === "1d" &&
    snapshot.statusLabel.includes("周末休市") &&
    isFullView;
  const scale = clamp(width / 1_928, 0.62, 1.15);
  const labelCount = width < 620 ? 4 : 7;
  const useCompactReferenceLabels = compact && width < 430;
  const referenceTimeFractions = useCompactReferenceLabels
    ? COMPACT_REFERENCE_TIME_FRACTIONS
    : REFERENCE_TIME_FRACTIONS;
  const referenceTimeLabels = useCompactReferenceLabels
    ? COMPACT_REFERENCE_TIME_LABELS
    : REFERENCE_TIME_LABELS;
  const keyIndexes = isReferencePreview
    ? referenceTimeFractions.map((fraction) =>
        Math.round(fraction * Math.max(0, bars.length - 1)),
      )
    : Array.from({ length: labelCount }, (_, index) =>
        Math.round((index / Math.max(1, labelCount - 1)) * Math.max(0, bars.length - 1)),
      );
  const axisLabels = new Map(
    keyIndexes.map((index, labelIndex) => [
      index,
      isReferencePreview
        ? referenceTimeLabels[labelIndex]
        : formatAxisTimestamp(bars[index]?.timestamp, range),
    ]),
  );
  const categories = bars.map((_, index) => index);
  const lineValues = bars.map((bar) => bar.close);
  const candleValues = bars.map((bar) => [bar.open, bar.close, bar.low, bar.high]);
  const allValues = bars.flatMap((bar) => [bar.low, bar.high]);
  const minimum = Math.min(...allValues);
  const maximum = Math.max(...allValues);
  const padding = Math.max((maximum - minimum) * 0.13, Math.abs(snapshot.price) * 0.002, 0.000_1);
  const digits = fractionDigits(snapshot.price);
  const chartData = chartType === "line" ? lineValues : candleValues;
  const commonSeries = {
    animationDuration: reduceMotion ? 0 : 360,
    animationEasing: "cubicOut" as const,
    data: chartData,
    markLine: {
      silent: true,
      symbol: ["none", "none"],
      label: { show: false },
      lineStyle: {
        color: "rgba(84, 94, 106, 0.36)",
        type: [6, 7],
        width: Math.max(1, scale),
      },
      data: keyIndexes.slice(1, -1).map((index) => ({ xAxis: index })),
    },
  };
  const compactTop = compactGridTop(width);

  return {
    backgroundColor: "transparent",
    animation: isFullView && !reduceMotion,
    grid: {
      left: "2.8%",
      right: compact ? "14%" : "8.55%",
      top: compact ? `${compactTop}%` : "23.7%",
      bottom: compact ? "15%" : "6.5%",
      containLabel: false,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#151b22",
      borderColor: "#333d48",
      borderWidth: 1,
      padding: [8 * scale, 12 * scale],
      textStyle: { color: "#f4f6f8", fontSize: 15 * scale },
      axisPointer: {
        type: "line",
        lineStyle: { color: "#5c6672", type: "dashed" },
      },
      formatter: (parameters: unknown) =>
        formatTooltip(parameters, bars, snapshot.instrument.currency, chartType),
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: categories,
      axisLine: {
        show: true,
        lineStyle: { color: "rgba(84, 94, 106, 0.38)", width: Math.max(1, scale) },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        show: true,
        color: "#8e949b",
        fontFamily: '"Segoe UI Variable", "Microsoft YaHei UI", sans-serif',
        fontSize: 21 * scale,
        margin: 18 * scale,
        interval: (index: number) => keyIndexes.includes(index),
        formatter: (value: string) => axisLabels.get(Number(value)) ?? "",
        align: "center",
        hideOverlap: false,
      },
    },
    yAxis: {
      type: "value",
      position: "right",
      min: isReferencePreview ? 210.4 : minimum - padding,
      max: isReferencePreview ? 215 : maximum + padding,
      interval: isReferencePreview ? 1 : undefined,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        show: !isReferencePreview,
        color: "#8e949b",
        fontFamily: '"Segoe UI Variable", "Microsoft YaHei UI", sans-serif',
        fontSize: 20 * scale,
        margin: 41 * scale,
        formatter: (value: number) => Number(value).toFixed(digits),
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: "rgba(84, 94, 106, 0.36)",
          type: [6, 7],
          width: Math.max(1, scale),
        },
      },
    },
    series:
      chartType === "line"
        ? [
            {
              ...commonSeries,
              type: "line",
              showSymbol: false,
              smooth: false,
              lineStyle: { color: "#2f7df4", width: 3.2 * scale },
              itemStyle: { color: "#2f7df4" },
              areaStyle: { color: "rgba(35, 103, 196, 0.09)" },
              markPoint: includesLatest
                ? {
                    symbol: "circle",
                    symbolSize: 10 * scale,
                    itemStyle: {
                      color: "#d9e9ff",
                      borderColor: "#2f7df4",
                      borderWidth: 3 * scale,
                    },
                    label: {
                      show: true,
                      position: compact ? "left" : "right",
                      distance: (compact ? 10 : 16) * scale,
                      padding: [5 * scale, 10 * scale],
                      borderRadius: 4 * scale,
                      backgroundColor: "#2f7df4",
                      color: "#ffffff",
                      fontSize: 24 * scale,
                      fontWeight: 650,
                      formatter: formatPrice(snapshot.price),
                    },
                    data: [{ coord: [bars.length - 1, bars.at(-1)!.close] }],
                  }
                : undefined,
            },
          ]
        : [
            {
              ...commonSeries,
              type: "candlestick",
              barMaxWidth: 10 * scale,
              itemStyle: {
                color: "#35b88a",
                color0: "#ec6b72",
                borderColor: "#35b88a",
                borderColor0: "#ec6b72",
              },
            },
          ],
  };
}

function MarketTerminalState({
  market,
  onOpenSettings,
}: {
  readonly market: MarketWatchController;
  readonly onOpenSettings?: () => void;
}) {
  if (market.phase === "loading") {
    return (
      <div className="market-terminal__state market-terminal__state--loading" role="status">
        <span />
        <strong>正在读取行情…</strong>
      </div>
    );
  }
  const copy = stateCopy(market.phase, market.errorMessage);
  const configure = market.phase === "unconfigured" && onOpenSettings;
  return (
    <div
      className="market-terminal__state"
      role={market.phase === "error" ? "alert" : "status"}
    >
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.message}</p>
      </div>
      <button
        type="button"
        onClick={
          configure
            ? onOpenSettings
            : market.phase === "permission"
              ? market.requestPermission
              : market.refresh
        }
      >
        {configure ? "配置数据源" : copy.action}
      </button>
    </div>
  );
}

function stateCopy(
  phase: MarketWatchPhase,
  errorMessage?: string,
): { readonly title: string; readonly message: string; readonly action: string } {
  if (phase === "permission") {
    return { title: "需要网络权限", message: "允许后才能读取最新行情。", action: "允许访问" };
  }
  if (phase === "denied") {
    return { title: "网络权限已拒绝", message: "请在插件管理中重置权限。", action: "重新检查" };
  }
  if (phase === "unconfigured") {
    return { title: "此产品需要免费 Key", message: "请配置 Twelve Data 免费 API Key。", action: "重新检查" };
  }
  if (phase === "empty") {
    return { title: "暂无行情数据", message: errorMessage ?? "换一个产品或时间范围后重试。", action: "刷新" };
  }
  if (phase === "unavailable") {
    return { title: "行情服务暂不可用", message: errorMessage ?? "请检查网络后重试。", action: "重试" };
  }
  return { title: "行情加载失败", message: errorMessage ?? "请稍后重试。", action: "重试" };
}

function connectionState(
  phase: MarketWatchPhase,
  demo: boolean,
  stale: boolean,
): { readonly state: string; readonly label: string } {
  if (phase === "ready" && stale) {
    return { state: "stale", label: "离线缓存" };
  }
  if (phase === "ready" && demo) {
    return { state: "online", label: "在线" };
  }
  if (phase === "ready") {
    return { state: "online", label: "在线" };
  }
  if (phase === "denied" || phase === "error" || phase === "unavailable") {
    return { state: "offline", label: "离线" };
  }
  return { state: "pending", label: "连接中" };
}

function footerStatus(phase: MarketWatchPhase): string {
  if (phase === "permission") {
    return "等待网络授权";
  }
  if (phase === "denied") {
    return "网络权限未开启";
  }
  if (phase === "unconfigured") {
    return "等待配置数据源";
  }
  if (phase === "loading") {
    return "正在同步行情";
  }
  return "行情暂不可用";
}

function formatTooltip(
  parameters: unknown,
  bars: readonly MarketBar[],
  currency: string,
  chartType: ChartType,
): string {
  const item = Array.isArray(parameters) ? parameters[0] : undefined;
  if (!isRecord(item)) {
    return "";
  }
  const index = typeof item.dataIndex === "number" ? item.dataIndex : 0;
  const bar = bars[index] ?? bars[0];
  if (!bar) {
    return "";
  }
  const timestamp = formatTooltipTimestamp(bar.timestamp);
  if (chartType === "line") {
    return `${timestamp}<br/><strong>${formatPrice(bar.close)} ${currency}</strong>`;
  }
  return `${timestamp}<br/>开 ${formatPrice(bar.open)} / 收 ${formatPrice(bar.close)}<br/>低 ${formatPrice(bar.low)} / 高 ${formatPrice(bar.high)}`;
}

function getVisibleBounds(totalPoints: number, zoom: ZoomWindow) {
  const lastIndex = Math.max(0, totalPoints - 1);
  const startIndex = clamp(Math.floor(zoom.start * lastIndex), 0, lastIndex);
  const endIndex = clamp(Math.ceil(zoom.end * lastIndex), startIndex, lastIndex);
  return { startIndex, endIndex };
}

function formatAxisTimestamp(value: string | undefined, range: MarketRange): string {
  if (!value) {
    return "";
  }
  const date = dateFromProviderTimestamp(value);
  if (!date) {
    return value.slice(-5);
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
}

function formatTooltipTimestamp(value: string): string {
  const date = dateFromProviderTimestamp(value);
  if (!date) {
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

function dateFromProviderTimestamp(value: string): Date | null {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPrice(value: number): string {
  const digits = fractionDigits(value);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatSigned(value: number, digits: number): string {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function fractionDigits(value: number): number {
  const absolute = Math.abs(value);
  return absolute < 0.01 ? 6 : absolute < 10 ? 4 : 2;
}

function Icon({
  name,
  className = "",
}: {
  readonly name: "calendar" | "chevron" | "refresh" | "settings";
  readonly className?: string;
}) {
  const tags = {
    calendar: "mdui-icon-calendar-month--outlined",
    chevron: "mdui-icon-expand-more--rounded",
    refresh: "mdui-icon-refresh--rounded",
    settings: "mdui-icon-settings--rounded",
  } as const;
  return createElement(tags[name], {
    class: `market-terminal__icon ${className}`.trim(),
    "aria-hidden": "true",
  });
}

function compactGridTop(width: number): number {
  return width < 430 ? 44 : 42;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
