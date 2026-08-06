import type {
  PermissionDecision,
  PluginContext,
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
import { supportsPublicDemo } from "./twelve-data";

type FeedbackTone = "success" | "error" | "info";

interface Feedback {
  readonly tone: FeedbackTone;
  readonly message: string;
}

const kinds: readonly { readonly value: InstrumentKind; readonly label: string }[] = [
  { value: "stock", label: "股票" },
  { value: "forex", label: "外汇" },
  { value: "crypto", label: "数字资产现货" },
  { value: "commodity", label: "商品" },
  { value: "futures", label: "数字资产期货" },
];

export function MarketSettingsPanel({
  context,
  onClose,
}: {
  readonly context: PluginContext;
  readonly onClose: () => void;
}) {
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
            ? "预览凭据状态已更新；正式桌面版会保存到 Windows 凭据管理器。"
            : "API Key 已保存到 Windows 凭据管理器，不会写入插件设置或日志。",
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
        "移除后，MSFT 等需要 Twelve Data Key 的产品会暂停更新；Kraken 现货、Binance 永续和公开演示产品不受影响。",
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
          "用于验证 Twelve Data、Kraken 或 Binance 公共行情连接。",
        );
        setPermission(decision);
      }
      if (decision !== "granted") {
        setFeedback({ tone: "error", message: "网络权限未授权，无法验证连接。" });
        return;
      }
      const instrument =
        settings.instruments.find((item) => credentialPresent || canFetchWithoutCredential(item)) ??
        settings.instruments[0]!;
      if (!credentialPresent && !canFetchWithoutCredential(instrument)) {
        setFeedback({
          tone: "error",
          message: "当前自选列表没有免 Key 产品，请先保存 Twelve Data 免费 API Key。",
        });
        return;
      }
      const snapshot = await fetchMarketSnapshot(context, instrument, "1d", credentialPresent);
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
    await persistSettings(
      { ...settings, instruments: [...settings.instruments, instrument] },
      `已添加 ${instrument.symbol}。`,
    );
    setSymbol("");
    setName("");
  };

  const removeInstrument = async (instrument: MarketInstrument) => {
    if (settings.instruments.length <= 1) {
      setFeedback({ tone: "error", message: "至少保留一个行情产品。" });
      return;
    }
    const instruments = settings.instruments.filter((item) => item.symbol !== instrument.symbol);
    await persistSettings(
      {
        ...settings,
        instruments,
        defaultSymbol:
          settings.defaultSymbol === instrument.symbol
            ? instruments[0]!.symbol
            : settings.defaultSymbol,
      },
      `已移除 ${instrument.symbol}。`,
    );
  };

  return (
    <section className="market-settings" aria-labelledby="market-settings-title">
      <header className="market-settings__header">
        <div>
          <span>市场行情</span>
          <h2 id="market-settings-title">数据源与自选</h2>
          <p>配置免费数据源、默认产品和自选列表。</p>
        </div>
        <button className="market-settings__done" type="button" onClick={onClose}>
          完成
        </button>
      </header>

      {loading ? (
        <div className="market-settings__loading" role="status">正在读取设置…</div>
      ) : (
        <>
          <div className="market-settings__status-row">
            <span data-active={permission === "granted"}>
              网络：{permission === "granted" ? "已允许" : permission === "denied" ? "已拒绝" : "待确认"}
            </span>
            <span data-active>{credentialPresent ? "Twelve Data Key 已保存" : "免 Key 行情可用"}</span>
            <span data-active>Kraken + Binance 公共接口</span>
          </div>

          {feedback ? (
            <div
              className={`market-settings__feedback market-settings__feedback--${feedback.tone}`}
              role={feedback.tone === "error" ? "alert" : "status"}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="market-settings__grid">
            <section className="market-settings__card">
              <div className="market-settings__section-heading">
                <div>
                  <h3>免费数据源</h3>
                  <p>现货数字资产与永续合约免 Key；更多股票和外汇可使用 Twelve Data 免费 Key。</p>
                </div>
                <span>Twelve Data · Kraken · Binance</span>
              </div>
              <form className="market-settings__key-form" onSubmit={(event) => void saveApiKey(event)}>
                <label>
                  <span>Twelve Data API Key</span>
                  <input
                    type="password"
                    value={apiKey}
                    autoComplete="off"
                    placeholder={credentialPresent ? "输入新 Key 可覆盖现有凭据" : "可选：粘贴免费 API Key"}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                </label>
                <button type="submit" disabled={saving}>
                  {saving ? "保存中…" : credentialPresent ? "更新" : "安全保存"}
                </button>
              </form>
              <div className="market-settings__key-actions">
                <button type="button" disabled={saving} onClick={() => void verifyConnection()}>
                  验证连接
                </button>
                {credentialPresent ? (
                  <button type="button" data-danger onClick={() => void removeApiKey()}>
                    移除凭据
                  </button>
                ) : null}
              </div>
              <p className="market-settings__notice">
                Kraken 提供免 Key 现货 OHLC；Binance 提供免 Key USDⓈ-M 永续行情。AAPL、EUR/USD 可使用 Twelve Data 公开演示，其余股票、外汇和商品通常需要个人免费 Key 或更高数据授权。
              </p>
            </section>

            <section className="market-settings__card">
              <div className="market-settings__section-heading">
                <div>
                  <h3>默认显示</h3>
                  <p>新建行情组件时优先显示这个产品。</p>
                </div>
              </div>
              <label className="market-settings__default">
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
              <dl className="market-settings__facts">
                <div><dt>自动刷新</dt><dd>数字资产约 60 秒 / 其他约 120 秒</dd></div>
                <div><dt>隐藏时</dt><dd>暂停网络任务</dd></div>
                <div><dt>交互</dt><dd>滚轮缩放 / 拖动平移</dd></div>
              </dl>
            </section>
          </div>

          <section className="market-settings__card market-settings__card--products">
            <div className="market-settings__section-heading">
              <div>
                <h3>自选产品</h3>
                <p>数字资产现货优先 Kraken，永续合约使用 Binance，其余产品使用 Twelve Data。</p>
              </div>
              <span>{settings.instruments.length} / {MAX_INSTRUMENTS}</span>
            </div>
            <div className="market-settings__product-list">
              {settings.instruments.map((instrument) => (
                <article key={instrument.symbol}>
                  <div>
                    <strong>{instrument.symbol}</strong>
                    <span>{instrument.name}</span>
                  </div>
                  <span>{kinds.find((item) => item.value === instrument.kind)?.label}</span>
                  <span>{instrument.currency}</span>
                  <span className="market-settings__provider">{providerLabel(instrument)}</span>
                  <span className="market-settings__access">
                    {canFetchWithoutCredential(instrument) ? "免 Key" : "需 Key"}
                  </span>
                  <button type="button" onClick={() => void removeInstrument(instrument)}>移除</button>
                </article>
              ))}
            </div>
            <form className="market-settings__add-form" onSubmit={(event) => void addInstrument(event)}>
              <label>
                <span>产品代码</span>
                <input value={symbol} placeholder="AAPL、BTC/USD、BTCUSDT" onChange={(event) => setSymbol(event.target.value)} />
              </label>
              <label>
                <span>显示名称</span>
                <input value={name} placeholder="例如 苹果" onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                <span>类型</span>
                <select value={kind} onChange={(event) => setKind(event.target.value as InstrumentKind)}>
                  {kinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label>
                <span>计价货币</span>
                <input value={currency} maxLength={8} onChange={(event) => setCurrency(event.target.value)} />
              </label>
              <button type="submit">添加产品</button>
            </form>
          </section>

          <footer className="market-settings__disclaimer">
            行情仅供学习与信息参考，不构成任何投资建议。
          </footer>
        </>
      )}
    </section>
  );
}

function providerLabel(instrument: MarketInstrument): string {
  if (instrument.kind === "futures") {
    return "Binance";
  }
  if (instrument.kind === "crypto") {
    return "Kraken";
  }
  return supportsPublicDemo(instrument.symbol) ? "Twelve 演示" : "Twelve Data";
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
