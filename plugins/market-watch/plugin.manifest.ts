import { definePlugin } from "@tool-center/plugin-contract";

export default definePlugin({
  id: "toolcenter.market-watch",
  name: "市场行情",
  description: "以简约深色终端查看股票、外汇、数字资产与期货行情，支持折线、K 线、缩放和平移。",
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
        title: "市场行情",
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
