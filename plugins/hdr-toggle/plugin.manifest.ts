import { definePlugin } from "@tool-center/plugin-contract";

export default definePlugin({
  id: "toolcenter.hdr-toggle",
  name: "HDR 开关",
  description: "查看并切换指定 Windows 显示器的 HDR 状态。",
  version: "0.1.0",
  category: "显示器",
  minHostVersion: "0.1.0",
  entrypoints: {
    widget: () => import("./src/widgets"),
  },
  contributes: {
    widgets: [
      {
        id: "display-hdr-toggle",
        title: "显示器 HDR",
        supportedSizes: ["small", "medium", "wide"],
        defaultSize: "small",
        defaultVisible: true,
        minimumSize: { width: 260, height: 160 },
      },
    ],
  },
  permissions: ["display.read", "display.control"],
});
