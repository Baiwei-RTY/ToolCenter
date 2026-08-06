import type { PluginContext } from "@tool-center/plugin-contract";

import { fetchBinanceFuturesSnapshot } from "./binance-futures";
import { fetchBiQuoteStockSnapshot } from "./biquote";
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
    instrument.kind === "stock" ||
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
  if (instrument.kind === "stock") {
    try {
      return await fetchBiQuoteStockSnapshot(context, instrument, range);
    } catch (error: unknown) {
      if (hasTwelveDataCredential) {
        return fetchTwelveDataSnapshot(context, instrument, range, "credential");
      }
      if (supportsPublicDemo(instrument.symbol)) {
        return fetchTwelveDataSnapshot(context, instrument, range, "public-demo");
      }
      throw error;
    }
  }
  return fetchTwelveDataSnapshot(
    context,
    instrument,
    range,
    hasTwelveDataCredential ? "credential" : "public-demo",
  );
}
