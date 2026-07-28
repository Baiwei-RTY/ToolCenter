import type {
  PermissionDecision,
  PluginPageProps,
  SystemSummary,
} from "@tool-center/plugin-contract";
import { useEffect, useState, type FormEvent } from "react";

import {
  API_CREDENTIAL_KEY,
  createDefaultSettings,
  MARKET_CONFIGURATION_CHANGED_EVENT,
  MAX_INSTRUMENTS,
  normalizeInstrument,
  normalizeSettings,
  SETTINGS_STORAGE_KEY,
  type InstrumentKind,
  type MarketInstrument,
  type MarketSettings,
} from "./market-model";
import {
  canFetchWithoutCredential,
  fetchMarketSnapshot,
} from "./market-data";
import "./styles.css";

type FeedbackTone = "success" | "error" | "info";

interface Feedback {
  readonly tone: FeedbackTone;
  readonly message: string;
}

const kinds: readonly { readonly value: InstrumentKind; readonly label: string }[] = [
  { value: "stock", label: "股票" },
  { value: "forex", label: "外汇" },
  { value: "crypto", label: "数字资产" },
  { value: "commodity", label: "商品" },
  { value: "futures", label: "数字资产期货" },
];

export default function MarketWatchPage({ context }: PluginPageProps) {
  const [settings, setSettings] = useState<MarketSettings>(createDefaultSettings);
  const [credentialPresent, setCredentialPresent] = useState(false);
  const [permission, setPermission] = useState<PermissionDecision>("prompt");
  const [system, setSystem] = useState<SystemSummary>();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [kind, setKind] = useState<InstrumentKind>("stock");

  useEffect(() => {
    let active = true;
    void Promise.all([
      context.storage.read<unknown>(SETTINGS_STORAGE_KEY),
      context.credentials.has(API_CREDENTIAL_KEY),
      context.permissions.status("network.request"),
      context.system.getSummary(),
    ])
      .then(([stored, hasCredential, decision, summary]) => {
        if (!active) {
          return;
        }
        setSettings(normalizeSettings(stored));
        setCredentialPresent(hasCredential);
        setPermission(decision);
        setSystem(summary);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setLoading(false);
        setFeedback({ tone: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [context]);

  const saveApiKey = async (event: FormEvent) => {
    event.preventDefault();
    const value = apiKey.trim();
    if (!value) {
      setFeedback({ tone: "error", message: "请输入 Twelve Data API Key。" });
      return;
    }
    setSaving(true);
    setFeedback(undefined);
    try {
      await context.credentials.set(API_CREDENTIAL_KEY, value);
      setApiKey("");
      setCredentialPresent(true);
      context.events.emit(MARKET_CONFIGURATION_CHANGED_EVENT, {
        reason: "credential-updated",
      });
      setFeedback({
        tone: "success",
        message:
          system?.platform === "browser"
            ? "预览凭据状态已更新；正式桌面版会安全保存到 Windows 凭据管理器。"
            : "API Key 已保存到 Windows 凭据管理器，不会写入插件 JSON。",
      });
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: messageOf(error) });
    } finally {
      setSaving(false);
    }
  };

  const removeApiKey = async () => {
    const accepted = await context.ui.confirm({
      title: "移除 API Key",
      message:
        "移除后，MSFT 等需要 Twelve Data Key 的产品会暂停更新；AAPL 和 Binance 期货等免 Key 产品不受影响。",
      dangerous: true,
    });
    if (!accepted) {
      return;
    }
    try {
      await context.credentials.remove(API_CREDENTIAL_KEY);
      setCredentialPresent(false);
      context.events.emit(MARKET_CONFIGURATION_CHANGED_EVENT, {
        reason: "credential-removed",
      });
      setFeedback({ tone: "success", message: "API Key 已从 Windows 凭据管理器移除。" });
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: messageOf(error) });
    }
  };

  const verifyConnection = async () => {
    if (system?.platform === "browser") {
      setFeedback({
        tone: "info",
        message: "浏览器预览使用固定演示数据；真实连接请在 ToolCenter 桌面壳中验证。",
      });
      return;
    }
    setSaving(true);
    try {
      let decision = permission;
      if (decision === "prompt") {
        decision = await context.permissions.request(
          "network.request",
          "用于验证 Twelve Data 或 Binance 公共行情连接并读取所选金融产品行情。",
        );
        setPermission(decision);
      }
      if (decision !== "granted") {
        setFeedback({ tone: "error", message: "网络权限未授权，无法验证连接。" });
        return;
      }
      const instrument =
        settings.instruments.find((item) =>
          credentialPresent || canFetchWithoutCredential(item),
        ) ?? settings.instruments[0]!;
      if (!credentialPresent && !canFetchWithoutCredential(instrument)) {
        setFeedback({
          tone: "error",
          message: "当前自选列表没有可免密验证的产品，请先保存 Twelve Data 免费 API Key。",
        });
        return;
      }
      const snapshot = await fetchMarketSnapshot(
        context,
        instrument,
        "1d",
        credentialPresent,
      );
      setFeedback({
        tone: "success",
        message: `公开连接正常：${snapshot.instrument.symbol} 最新 ${snapshot.price.toFixed(2)} ${snapshot.instrument.currency}。`,
      });
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: messageOf(error) });
    } finally {
      setSaving(false);
    }
  };

  const persistSettings = async (next: MarketSettings, successMessage: string) => {
    try {
      await context.storage.write(SETTINGS_STORAGE_KEY, next);
      setSettings(next);
      context.events.emit(MARKET_CONFIGURATION_CHANGED_EVENT, {
        reason: "settings-updated",
      });
      setFeedback({ tone: "success", message: successMessage });
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: messageOf(error) });
    }
  };

  const addInstrument = async (event: FormEvent) => {
    event.preventDefault();
    const instrument = normalizeInstrument({ symbol, name, currency, kind });
    if (!instrument) {
      setFeedback({ tone: "error", message: "请检查产品代码、名称和计价货币。" });
      return;
    }
    if (settings.instruments.some((item) => item.symbol === instrument.symbol)) {
      setFeedback({ tone: "error", message: "这个产品代码已经在列表中。" });
      return;
    }
    if (settings.instruments.length >= MAX_INSTRUMENTS) {
      setFeedback({ tone: "error", message: `当前版本最多保存 ${MAX_INSTRUMENTS} 个产品。` });
      return;
    }
    const next = {
      ...settings,
      instruments: [...settings.instruments, instrument],
    };
    await persistSettings(next, `已添加 ${instrument.symbol}。`);
    setSymbol("");
    setName("");
  };

  const removeInstrument = async (instrument: MarketInstrument) => {
    if (settings.instruments.length <= 1) {
      setFeedback({ tone: "error", message: "至少保留一个行情产品。" });
      return;
    }
    const instruments = settings.instruments.filter(
      (item) => item.symbol !== instrument.symbol,
    );
    const next = {
      ...settings,
      instruments,
      defaultSymbol:
        settings.defaultSymbol === instrument.symbol
          ? instruments[0]!.symbol
          : settings.defaultSymbol,
    };
    await persistSettings(next, `已移除 ${instrument.symbol}。`);
  };

  if (loading) {
    return (
      <section className="market-watch-page market-watch-page--loading" role="status">
        正在读取市场行情设置…
      </section>
    );
  }

  return (
    <section className="market-watch-page" aria-labelledby="market-watch-page-title">
      <header className="market-watch-page__header">
        <div>
          <p>金融工具</p>
          <h1 id="market-watch-page-title">市场行情设置</h1>
          <span>配置数据源和自选产品；桌面小组件负责近实时查看与图表切换。</span>
        </div>
        <div className="market-watch-page__provider-status">
          <span data-active>
            {credentialPresent ? "免费 API Key 已保存" : "免 Key 行情可用"}
          </span>
          <span data-active={permission === "granted"}>
            网络权限：{permission === "granted" ? "已允许" : permission === "denied" ? "已拒绝" : "待确认"}
          </span>
        </div>
      </header>

      {feedback ? (
        <div className={`market-watch-page__feedback market-watch-page__feedback--${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>
          {feedback.message}
        </div>
      ) : null}

      <div className="market-watch-page__grid">
        <section className="market-watch-page__card">
          <div className="market-watch-page__section-heading">
            <div>
              <h2>公开免费数据源</h2>
              <p>AAPL、EUR/USD、BTC/USD 可免 Key 读取；数字资产期货通过 Binance 公共接口读取。</p>
            </div>
            <span>Twelve Data + Binance</span>
          </div>
          <form className="market-watch-page__key-form" onSubmit={(event) => void saveApiKey(event)}>
            <label>
              <span>API Key</span>
              <input
                type="password"
                value={apiKey}
                autoComplete="off"
                placeholder={credentialPresent ? "输入新 Key 可覆盖现有凭据" : "可选：粘贴 Twelve Data 免费 API Key"}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? "保存中…" : credentialPresent ? "更新凭据" : "安全保存"}
            </button>
          </form>
          <div className="market-watch-page__key-actions">
            <button type="button" disabled={saving} onClick={() => void verifyConnection()}>
              验证连接
            </button>
            {credentialPresent ? (
              <button type="button" className="market-watch-page__danger" onClick={() => void removeApiKey()}>
                移除凭据
              </button>
            ) : null}
          </div>
          <p className="market-watch-page__notice">
            Twelve Data Basic 免费方案可扩展更多美股、外汇和现货数字资产；无需 Key 也可读取 AAPL、EUR/USD 与 BTC/USD 的公开行情。数字资产期货代码使用 Binance USDⓈ-M 格式，例如 BTCUSDT。传统商品期货实时数据通常需要额外交易所授权。
          </p>
        </section>

        <section className="market-watch-page__card">
          <div className="market-watch-page__section-heading">
            <div>
              <h2>默认显示</h2>
              <p>新建市场行情小组件时优先显示这个产品。</p>
            </div>
          </div>
          <label className="market-watch-page__default">
            <span>默认产品</span>
            <select
              value={settings.defaultSymbol}
              onChange={(event) =>
                void persistSettings(
                  { ...settings, defaultSymbol: event.target.value },
                  "默认产品已更新。",
                )
              }
            >
              {settings.instruments.map((instrument) => (
                <option key={instrument.symbol} value={instrument.symbol}>
                  {instrument.symbol} · {instrument.name}
                </option>
              ))}
            </select>
          </label>
          <dl className="market-watch-page__facts">
            <div>
              <dt>自动刷新</dt>
              <dd>可见时约 60 秒</dd>
            </div>
            <div>
              <dt>隐藏时</dt>
              <dd>暂停网络任务</dd>
            </div>
            <div>
              <dt>图表</dt>
              <dd>折线 / K 线</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="market-watch-page__card market-watch-page__card--products">
        <div className="market-watch-page__section-heading">
          <div>
            <h2>自选产品</h2>
            <p>股票、外汇、现货数字资产遵循 Twelve Data；数字资产期货使用 Binance USDⓈ-M 产品代码。</p>
          </div>
          <span>{settings.instruments.length} / {MAX_INSTRUMENTS}</span>
        </div>
        <div className="market-watch-page__product-list">
          {settings.instruments.map((instrument) => (
            <article key={instrument.symbol}>
              <div>
                <strong>{instrument.symbol}</strong>
                <span>{instrument.name}</span>
              </div>
              <span>{kinds.find((item) => item.value === instrument.kind)?.label}</span>
              <span>{instrument.currency}</span>
              <span className="market-watch-page__access">
                {canFetchWithoutCredential(instrument) ? "免 Key" : "需 Key"}
              </span>
              <button type="button" onClick={() => void removeInstrument(instrument)}>
                移除
              </button>
            </article>
          ))}
        </div>
        <form className="market-watch-page__add-form" onSubmit={(event) => void addInstrument(event)}>
          <label>
            <span>产品代码</span>
            <input value={symbol} placeholder="例如 AAPL、EUR/USD、BTCUSDT" onChange={(event) => setSymbol(event.target.value)} />
          </label>
          <label>
            <span>显示名称</span>
            <input value={name} placeholder="例如 苹果" onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>类型</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as InstrumentKind)}>
              {kinds.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>计价货币</span>
            <input value={currency} maxLength={8} onChange={(event) => setCurrency(event.target.value)} />
          </label>
          <button type="submit">添加产品</button>
        </form>
      </section>

      <footer className="market-watch-page__disclaimer">
        行情仅供学习与信息参考，不构成任何投资建议；交易前请以持牌行情源和交易所数据为准。
      </footer>
    </section>
  );
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 220);
  }
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record.userMessage === "string") {
      return record.userMessage.slice(0, 220);
    }
    if (typeof record.message === "string") {
      return record.message.slice(0, 220);
    }
  }
  return "操作失败，请查看诊断日志后重试。";
}
