import type { PageEntrypointModule } from "@tool-center/plugin-contract";
import { lazy } from "react";

export const pages: PageEntrypointModule["pages"] = [
  {
    id: "audio-output-devices",
    route: "/audio-output-devices",
    title: "音频输出设备",
    component: lazy(() => import("./AudioDevicePage")),
  },
];
