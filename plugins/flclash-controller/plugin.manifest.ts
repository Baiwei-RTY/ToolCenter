import { definePlugin } from "@tool-center/plugin-contract";

export default definePlugin({
  id: "toolcenter.flclash-controller",
  name: "FlClash 控制",
  description: "从桌面启动或停止 FlClash 代理，并快速切换代理节点。",
  version: "0.1.0",
  category: "网络工具",
  minHostVersion: "0.1.0",
  entrypoints: {
    widget: () => import("./src/widgets"),
  },
  contributes: {
    widgets: [
      {
        id: "flclash-controller",
        title: "FlClash 控制",
        supportedSizes: ["medium", "wide"],
        defaultSize: "medium",
        defaultVisible: true,
        minimumSize: { width: 360, height: 220 },
      },
    ],
  },
  permissions: ["proxy.read", "proxy.control"],
});
