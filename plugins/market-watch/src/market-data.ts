import type { PluginContext } from "@tool-center/plugin-contract";

import { fetchBinanceFuturesSnapshot } from "./binance-futures";
import { fetchKrakenSpotSnapshot } from "./kraken-spot";
import type {
  MarketInstrument,
  MarketRange,
  MarketSnapshot,
} from "./market-model";
import {
  fetchMarketSnapshot as fetchTwelveDataSnapshot,
  supportsPublicDemo,
} from "./twelve-data";

export function canFetchWithoutCredential(instrument: MarketInstrument): boolean {
  return (
    instrument.kind === "futures" ||
    instrument.kind === "crypto" ||
    supportsPublicDemo(instrument.symbol)
  );
}

export async function fetchMarketSnapshot(
  context: PluginContext,
  instrument: MarketInstrument,
  range: MarketRange,
  hasTwelveDataCredential: boolean,
): Promise<MarketSnapshot> {
  if (instrument.kind === "futures") {
    return fetchBinanceFuturesSnapshot(context, instrument, range);
  }
  if (instrument.kind === "crypto") {
    return fetchKrakenSpotSnapshot(context, instrument, range);
  }
  return fetchTwelveDataSnapshot(
    context,
    instrument,
    range,
    hasTwelveDataCredential ? "credential" : "public-demo",
  );
}
