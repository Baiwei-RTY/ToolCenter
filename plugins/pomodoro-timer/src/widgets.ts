import type { WidgetEntrypointModule } from "@tool-center/plugin-contract";
import { lazy } from "react";

export const widgets: WidgetEntrypointModule["widgets"] = [
  {
    id: "pomodoro-timer",
    title: "番茄钟",
    supportedSizes: ["small", "medium", "wide"],
    defaultSize: "medium",
    defaultVisible: true,
    minimumSize: { width: 260, height: 160 },
    component: lazy(() => import("./PomodoroWidget")),
  },
];
