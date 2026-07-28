import { definePlugin } from "@tool-center/plugin-contract";

export default definePlugin({
  id: "toolcenter.market-watch",
  name: "市场行情",
  description: "在桌面小组件中查看股票、外汇、数字资产与期货等金融产品的最新行情和图表。",
  version: "0.1.0",
  category: "金融工具",
  minHostVersion: "0.1.0",
  entrypoints: {
    page: () => import("./src/pages"),
    widget: () => import("./src/widgets"),
  },
  contributes: {
    pages: [
      {
        id: "market-watch-settings",
        title: "市场行情设置",
        route: "/market-watch-settings",
      },
    ],
    widgets: [
      {
        id: "market-watch",
        title: "市场行情",
        supportedSizes: ["small", "medium", "wide"],
        defaultSize: "wide",
        defaultVisible: true,
        minimumSize: { width: 260, height: 160 },
      },
    ],
  },
  permissions: ["network.request"],
});
