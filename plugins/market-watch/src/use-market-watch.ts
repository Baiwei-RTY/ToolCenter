import type { PermissionDecision, PluginContext } from "@tool-center/plugin-contract";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  API_CREDENTIAL_KEY,
  createDefaultSettings,
  createDemoSnapshot,
  MARKET_CONFIGURATION_CHANGED_EVENT,
  normalizeSettings,
  normalizeWidgetPreferences,
  SETTINGS_STORAGE_KEY,
  type ChartType,
  type MarketRange,
  type MarketSettings,
  type MarketSnapshot,
  type WidgetPreferences,
  widgetStorageKey,
} from "./market-model";
import {
  canFetchWithoutCredential,
  fetchMarketSnapshot,
} from "./market-data";
import { MarketDataError } from "./twelve-data";

export type MarketWatchPhase =
  | "loading"
  | "ready"
  | "empty"
  | "permission"
  | "denied"
  | "unconfigured"
  | "error"
  | "unavailable";

export interface MarketWatchController {
  readonly phase: MarketWatchPhase;
  readonly settings: MarketSettings;
  readonly preferences: WidgetPreferences;
  readonly snapshot?: MarketSnapshot;
  readonly refreshing: boolean;
  readonly demo: boolean;
  readonly stale: boolean;
  readonly errorMessage?: string;
  selectSymbol(symbol: string): void;
  setChartType(chartType: ChartType): void;
  setRange(range: MarketRange): void;
  refresh(): void;
  requestPermission(): void;
}

export function useMarketWatch(
  context: PluginContext,
  instanceId: string,
  visible: boolean,
): MarketWatchController {
  const initialSettings = createDefaultSettings();
  const [settings, setSettings] = useState(initialSettings);
  const [preferences, setPreferences] = useState<WidgetPreferences>(() =>
    normalizeWidgetPreferences(null, initialSettings),
  );
  const [phase, setPhase] = useState<MarketWatchPhase>("loading");
  const [snapshot, setSnapshot] = useState<MarketSnapshot>();
  const [refreshing, setRefreshing] = useState(false);
  const [demo, setDemo] = useState(false);
  const [stale, setStale] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const settingsRef = useRef(settings);
  const preferencesRef = useRef(preferences);
  const snapshotRef = useRef<MarketSnapshot | undefined>(undefined);
  const snapshotKeyRef = useRef("");
  const operationRef = useRef(0);
  const storageKey = widgetStorageKey(instanceId);
  const selectedInstrument = settings.instruments.find(
    (instrument) => instrument.symbol === preferences.symbol,
  );
  const autoRefreshIntervalMs =
    selectedInstrument?.kind === "crypto" || selectedInstrument?.kind === "futures"
      ? 60_000
      : 120_000;

  const loadSnapshot = useCallback(
    async (
      nextSettings: MarketSettings,
      nextPreferences: WidgetPreferences,
      showLoading: boolean,
    ) => {
      if (!visible) {
        return;
      }
      const operation = operationRef.current + 1;
      operationRef.current = operation;
      const requestedKey = `${nextPreferences.symbol}:${nextPreferences.range}`;
      if (showLoading && snapshotKeyRef.current !== requestedKey) {
        setPhase("loading");
      }
      setRefreshing(true);
      setErrorMessage(undefined);

      try {
        const instrument =
          nextSettings.instruments.find((item) => item.symbol === nextPreferences.symbol) ??
          nextSettings.instruments[0];
        if (!instrument) {
          setPhase("empty");
          return;
        }

        const summary = await context.system.getSummary();
        if (operation !== operationRef.current) {
          return;
        }
        if (summary.platform === "browser") {
          const nextSnapshot = createDemoSnapshot(instrument, nextPreferences.range);
          setDemo(true);
          setStale(false);
          snapshotRef.current = nextSnapshot;
          snapshotKeyRef.current = requestedKey;
          setSnapshot(nextSnapshot);
          setPhase("ready");
          return;
        }
        setDemo(false);

        const permission = await context.permissions.status("network.request");
        if (operation !== operationRef.current) {
          return;
        }
        if (permission !== "granted") {
          setPhase(permission === "denied" ? "denied" : "permission");
          return;
        }
        const hasCredential = await context.credentials.has(API_CREDENTIAL_KEY);
        if (!hasCredential && !canFetchWithoutCredential(instrument)) {
          setPhase("unconfigured");
          return;
        }
        const nextSnapshot = await fetchMarketSnapshot(
          context,
          instrument,
          nextPreferences.range,
          hasCredential,
        );
        if (operation !== operationRef.current) {
          return;
        }
        setStale(false);
        snapshotRef.current = nextSnapshot;
        snapshotKeyRef.current = requestedKey;
        setSnapshot(nextSnapshot);
        setPhase("ready");
      } catch (error: unknown) {
        if (operation !== operationRef.current) {
          return;
        }
        const failure = classifyFailure(error);
        if (
          snapshotRef.current !== undefined &&
          snapshotKeyRef.current === requestedKey
        ) {
          setSnapshot(snapshotRef.current);
          setStale(true);
          setPhase("ready");
        } else {
          setStale(false);
          setPhase(failure.phase);
        }
        setErrorMessage(failure.message);
        await context.logger
          .warn("市场行情刷新失败", {
            instanceId,
            category: failure.phase,
            message: failure.message,
          })
          .catch(() => undefined);
      } finally {
        if (operation === operationRef.current) {
          setRefreshing(false);
        }
      }
    },
    [context, instanceId, visible],
  );

  const refreshFromSharedSettings = useCallback(
    async (showLoading: boolean) => {
      try {
        const storedSettings = await context.storage.read<unknown>(
          SETTINGS_STORAGE_KEY,
        );
        const nextSettings = normalizeSettings(storedSettings);
        const nextPreferences = normalizeWidgetPreferences(
          preferencesRef.current,
          nextSettings,
        );
        const symbolChanged = nextPreferences.symbol !== preferencesRef.current.symbol;
        settingsRef.current = nextSettings;
        preferencesRef.current = nextPreferences;
        setSettings(nextSettings);
        if (symbolChanged) {
          setPreferences(nextPreferences);
          await context.storage.write(storageKey, nextPreferences);
        }
        await loadSnapshot(nextSettings, nextPreferences, showLoading);
      } catch (error: unknown) {
        await context.logger
          .warn("市场行情共享设置刷新失败", {
            instanceId,
            message: errorMessageOf(error),
          })
          .catch(() => undefined);
        await loadSnapshot(
          settingsRef.current,
          preferencesRef.current,
          showLoading,
        );
      }
    },
    [
      context.logger,
      context.storage,
      instanceId,
      loadSnapshot,
      storageKey,
    ],
  );

  useEffect(() => {
    if (!visible) {
      operationRef.current += 1;
      return;
    }
    let active = true;
    void Promise.all([
      context.storage.read<unknown>(SETTINGS_STORAGE_KEY),
      context.storage.read<unknown>(storageKey),
    ])
      .then(([storedSettings, storedPreferences]) => {
        if (!active) {
          return;
        }
        const nextSettings = normalizeSettings(storedSettings);
        const nextPreferences = normalizeWidgetPreferences(
          storedPreferences,
          nextSettings,
        );
        settingsRef.current = nextSettings;
        preferencesRef.current = nextPreferences;
        setSettings(nextSettings);
        setPreferences(nextPreferences);
        void loadSnapshot(nextSettings, nextPreferences, true);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setPhase("error");
        setErrorMessage("无法读取小组件设置，请重试。");
        void context.logger
          .warn("市场行情设置读取失败", {
            instanceId,
            message: errorMessageOf(error),
          })
          .catch(() => undefined);
      });
    return () => {
      active = false;
      operationRef.current += 1;
    };
  }, [context, instanceId, loadSnapshot, storageKey, visible]);

  useEffect(() => {
    let active = true;
    const release = context.events.subscribe(
      MARKET_CONFIGURATION_CHANGED_EVENT,
      () => {
        void Promise.all([
          context.storage.read<unknown>(SETTINGS_STORAGE_KEY),
          context.storage.read<unknown>(storageKey),
        ])
          .then(([storedSettings, storedPreferences]) => {
            if (!active) {
              return;
            }
            const nextSettings = normalizeSettings(storedSettings);
            const nextPreferences = normalizeWidgetPreferences(
              storedPreferences,
              nextSettings,
            );
            settingsRef.current = nextSettings;
            preferencesRef.current = nextPreferences;
            setSettings(nextSettings);
            setPreferences(nextPreferences);
            if (visible) {
              void loadSnapshot(nextSettings, nextPreferences, true);
            }
          })
          .catch((error: unknown) => {
            if (!active) {
              return;
            }
            void context.logger
              .warn("市场行情配置同步失败", {
                instanceId,
                message: errorMessageOf(error),
              })
              .catch(() => undefined);
          });
      },
    );
    return () => {
      active = false;
      void release();
    };
  }, [
    context.events,
    context.logger,
    context.storage,
    instanceId,
    loadSnapshot,
    storageKey,
    visible,
  ]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const release = context.scheduler.register({
      id: `market-watch:${instanceId}`,
      intervalMs: autoRefreshIntervalMs,
      runWhenHidden: false,
      priority: "low",
      callback: () => refreshFromSharedSettings(false),
    });
    return () => {
      void release();
    };
  }, [
    autoRefreshIntervalMs,
    context.scheduler,
    instanceId,
    refreshFromSharedSettings,
    visible,
  ]);

  const persistPreferences = useCallback(
    (next: WidgetPreferences) => {
      preferencesRef.current = next;
      setPreferences(next);
      void context.storage.write(storageKey, next).catch((error: unknown) =>
        context.logger
          .warn("市场行情小组件偏好保存失败", {
            instanceId,
            message: errorMessageOf(error),
          })
          .catch(() => undefined),
      );
    },
    [context.logger, context.storage, instanceId, storageKey],
  );

  return {
    phase,
    settings,
    preferences,
    snapshot,
    refreshing,
    demo,
    stale,
    errorMessage,
    selectSymbol: (symbol) => {
      if (!settingsRef.current.instruments.some((item) => item.symbol === symbol)) {
        return;
      }
      const next = { ...preferencesRef.current, symbol };
      persistPreferences(next);
      void loadSnapshot(settingsRef.current, next, true);
    },
    setChartType: (chartType) => {
      persistPreferences({ ...preferencesRef.current, chartType });
    },
    setRange: (range) => {
      const next = { ...preferencesRef.current, range };
      persistPreferences(next);
      void loadSnapshot(settingsRef.current, next, true);
    },
    refresh: () => {
      void refreshFromSharedSettings(false);
    },
    requestPermission: () => {
      void context.permissions
        .request(
          "network.request",
          "用于从 Twelve Data、Kraken 或 Binance 公共行情接口读取所选金融产品的最新价格与 OHLC 时间序列。",
        )
        .then((decision: PermissionDecision) => {
          if (decision === "granted") {
            return loadSnapshot(settingsRef.current, preferencesRef.current, true);
          }
          setPhase("denied");
          return undefined;
        })
        .catch((error: unknown) => {
          const failure = classifyFailure(error);
          setErrorMessage(failure.message);
          setPhase(failure.phase);
        });
    },
  };
}

function classifyFailure(error: unknown): {
  readonly phase: MarketWatchPhase;
  readonly message: string;
} {
  if (error instanceof MarketDataError) {
    return {
      phase:
        error.kind === "empty"
          ? "empty"
          : error.kind === "authentication"
            ? "unconfigured"
            : error.kind === "rate-limit"
              ? "unavailable"
              : "error",
      message: error.message,
    };
  }
  const record = isRecord(error) ? error : undefined;
  const code = typeof record?.code === "string" ? record.code : "";
  if (code === "credential.not-found") {
    return { phase: "unconfigured", message: "尚未配置 Twelve Data 免费 API Key。" };
  }
  if (code === "permission.denied") {
    return { phase: "denied", message: "网络权限未授权，无法读取行情。" };
  }
  if (code.startsWith("network.")) {
    return { phase: "unavailable", message: "当前无法连接行情服务，请稍后重试。" };
  }
  return { phase: "error", message: errorMessageOf(error) };
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 180);
  }
  if (isRecord(error) && typeof error.userMessage === "string") {
    return error.userMessage.slice(0, 180);
  }
  if (isRecord(error) && typeof error.message === "string") {
    return error.message.slice(0, 180);
  }
  return "行情数据加载失败，请重试。";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
