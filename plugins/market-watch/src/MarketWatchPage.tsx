import type { PluginPageProps } from "@tool-center/plugin-contract";
import { useEffect, useRef, useState } from "react";

import { MarketSettingsPanel } from "./MarketSettingsPanel";
import { MarketTerminal } from "./MarketTerminal";
import { useMarketWatch } from "./use-market-watch";
import "./styles.css";

export default function MarketWatchPage({ context }: PluginPageProps) {
  const market = useMarketWatch(context, "page", true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = Array.from(
        settingsDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKey);
    requestAnimationFrame(() => {
      settingsDialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    });
    return () => {
      document.removeEventListener("keydown", handleDialogKey);
      document
        .querySelector<HTMLButtonElement>(".market-terminal__instrument-button")
        ?.focus();
    };
  }, [settingsOpen]);

  return (
    <main className="market-watch-page">
      <MarketTerminal
        market={market}
        variant="page"
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {settingsOpen ? (
        <div
          className="market-settings-dialog"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setSettingsOpen(false);
            }
          }}
        >
          <div
            className="market-settings-dialog__surface"
            ref={settingsDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="市场行情数据源与自选设置"
          >
            <MarketSettingsPanel context={context} onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
