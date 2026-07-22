import type { WidgetEntrypointModule } from "@tool-center/plugin-contract";
import { lazy } from "react";

export const widgets: WidgetEntrypointModule["widgets"] = [
  {
    id: "audio-output-switcher",
    title: "音频输出切换",
    supportedSizes: ["small", "medium", "wide"],
    defaultSize: "small",
    defaultVisible: true,
    minimumSize: { width: 260, height: 160 },
    component: lazy(() => import("./AudioDeviceWidget")),
  },
];
