import type { WidgetProps } from "@tool-center/plugin-contract";

import { MarketTerminal } from "./MarketTerminal";
import { useMarketWatch } from "./use-market-watch";
import "./styles.css";

export default function MarketWatchWidget({ context, widget }: WidgetProps) {
  const market = useMarketWatch(context, widget.instanceId, widget.visible);

  return (
    <div className="market-watch-widget">
      <MarketTerminal
        market={market}
        locked={widget.locked}
        variant="widget"
        size={widget.size}
      />
    </div>
  );
}
