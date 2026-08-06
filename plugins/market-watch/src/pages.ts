import type { PageEntrypointModule } from "@tool-center/plugin-contract";
import { lazy } from "react";

export const pages: PageEntrypointModule["pages"] = [
  {
    id: "market-watch-settings",
    route: "/market-watch-settings",
    title: "市场行情",
    component: lazy(() => import("./MarketWatchPage")),
  },
];
