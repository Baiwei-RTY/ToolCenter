import type { WidgetEntrypointModule } from "@tool-center/plugin-contract";
import { lazy } from "react";

export const widgets: WidgetEntrypointModule["widgets"] = [
  {
    id: "flclash-controller",
    title: "FlClash 控制",
    supportedSizes: ["medium", "wide"],
    defaultSize: "medium",
    defaultVisible: true,
    minimumSize: { width: 360, height: 220 },
    component: lazy(() => import("./FlClashWidget")),
  },
];
