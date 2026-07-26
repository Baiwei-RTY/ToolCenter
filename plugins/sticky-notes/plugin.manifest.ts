import { definePlugin } from "@tool-center/plugin-contract";

export default definePlugin({
  id: "toolcenter.sticky-notes",
  name: "桌面便签",
  description: "随手记录文字，并用轻量待办追踪需要完成的事项。",
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
