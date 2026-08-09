import { definePlugin } from "@tool-center/plugin-contract";

export default definePlugin({
  id: "toolcenter.sticky-notes",
  name: "桌面便签",
  description: "在暖纸便签中记录标题、正文和可排序清单。",
  version: "0.1.0",
  category: "效率",
  minHostVersion: "0.1.0",
  entrypoints: {
    widget: () => import("./src/widgets"),
  },
  contributes: {
    widgets: [
      {
        id: "sticky-notes",
        title: "桌面便签",
        supportedSizes: ["small", "medium", "wide"],
        defaultSize: "medium",
        defaultVisible: true,
        minimumSize: { width: 260, height: 160 },
      },
    ],
  },
  permissions: [],
});
