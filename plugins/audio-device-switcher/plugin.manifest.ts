import { definePlugin } from "@tool-center/plugin-contract";

export default definePlugin({
  id: "toolcenter.audio-device-switcher",
  name: "音频设备切换",
  description: "快速查看并切换 Windows 默认音频输出设备。",
  version: "0.1.0",
  category: "音频",
  minHostVersion: "0.1.0",
  entrypoints: {
    page: () => import("./src/pages"),
    widget: () => import("./src/widgets"),
  },
  contributes: {
    pages: [
      {
        id: "audio-output-devices",
        title: "音频输出设备",
        route: "/audio-output-devices",
      },
    ],
    widgets: [
      {
        id: "audio-output-switcher",
        title: "音频输出切换",
        supportedSizes: ["small", "medium", "wide"],
        defaultSize: "small",
        defaultVisible: true,
        minimumSize: { width: 260, height: 160 },
      },
    ],
  },
  permissions: ["audio.read", "audio.control"],
});
