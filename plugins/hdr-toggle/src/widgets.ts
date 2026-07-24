import type { WidgetEntrypointModule } from "@tool-center/plugin-contract";
import { lazy } from "react";

export const widgets: WidgetEntrypointModule["widgets"] = [
  {
    id: "display-hdr-toggle",
    title: "显示器 HDR",
    supportedSizes: ["small", "medium", "wide"],
    defaultSize: "small",
    defaultVisible: true,
    minimumSize: { width: 260, height: 160 },
    component: lazy(() => import("./HdrWidget")),
  },
];
