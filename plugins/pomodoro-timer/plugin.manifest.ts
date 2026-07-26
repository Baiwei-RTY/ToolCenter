import { definePlugin } from "@tool-center/plugin-contract";

export default definePlugin({
  id: "toolcenter.pomodoro-timer",
  name: "番茄钟",
  description: "使用可调节的专注与休息时长，在桌面管理番茄工作节奏。",
  version: "0.1.0",
  category: "效率",
  minHostVersion: "0.1.0",
  entrypoints: {
    widget: () => import("./src/widgets"),
  },
  contributes: {
    widgets: [
      {
        id: "pomodoro-timer",
        title: "番茄钟",
        supportedSizes: ["small", "medium", "wide"],
        defaultSize: "medium",
        defaultVisible: true,
        minimumSize: { width: 260, height: 160 },
      },
    ],
  },
  permissions: [],
});
