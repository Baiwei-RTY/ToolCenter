import type { WidgetEntrypointModule } from "@tool-center/plugin-contract";
import { lazy } from "react";

export const widgets: WidgetEntrypointModule["widgets"] = [
  {
    id: "market-watch",
    title: "市场行情",
    supportedSizes: ["small", "medium", "wide"],
    defaultSize: "wide",
    defaultVisible: true,
    minimumSize: { width: 260, height: 160 },
    component: lazy(() => import("./MarketWatchWidget")),
  },
];
