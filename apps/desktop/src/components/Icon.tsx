import { createElement } from "react";

import "@mdui/icons/add.js";
import "@mdui/icons/apps.js";
import "@mdui/icons/arrow-back.js";
import "@mdui/icons/arrow-forward.js";
import "@mdui/icons/bug-report--outlined.js";
import "@mdui/icons/build--outlined.js";
import "@mdui/icons/check.js";
import "@mdui/icons/chevron-right.js";
import "@mdui/icons/close.js";
import "@mdui/icons/crop-square.js";
import "@mdui/icons/delete-outline.js";
import "@mdui/icons/description--outlined.js";
import "@mdui/icons/expand-more.js";
import "@mdui/icons/extension--outlined.js";
import "@mdui/icons/favorite-border.js";
import "@mdui/icons/favorite.js";
import "@mdui/icons/filter-list.js";
import "@mdui/icons/grid-view.js";
import "@mdui/icons/hdr-on--outlined.js";
import "@mdui/icons/help-outline.js";
import "@mdui/icons/history.js";
import "@mdui/icons/home--outlined.js";
import "@mdui/icons/info.js";
import "@mdui/icons/language.js";
import "@mdui/icons/monitor-heart--outlined.js";
import "@mdui/icons/more-vert.js";
import "@mdui/icons/open-in-new.js";
import "@mdui/icons/pause.js";
import "@mdui/icons/play-circle-outline.js";
import "@mdui/icons/push-pin--outlined.js";
import "@mdui/icons/refresh.js";
import "@mdui/icons/remove.js";
import "@mdui/icons/search.js";
import "@mdui/icons/settings--outlined.js";
import "@mdui/icons/shield--outlined.js";
import "@mdui/icons/show-chart.js";
import "@mdui/icons/sticky-note-2--outlined.js";
import "@mdui/icons/stop.js";
import "@mdui/icons/storage--outlined.js";
import "@mdui/icons/timer--outlined.js";
import "@mdui/icons/verified-user.js";
import "@mdui/icons/view-list.js";
import "@mdui/icons/volume-up--outlined.js";
import "@mdui/icons/warning-amber.js";
import "@mdui/icons/wb-sunny--outlined.js";
import "@mdui/icons/widgets--outlined.js";

export type IconName =
  | "activity"
  | "add"
  | "app"
  | "audio"
  | "back"
  | "chart"
  | "check"
  | "chevron-down"
  | "chevron-right"
  | "close"
  | "command"
  | "delete"
  | "diagnostics"
  | "external"
  | "favorite"
  | "favorite-filled"
  | "filter"
  | "forward"
  | "grid"
  | "hdr"
  | "help"
  | "history"
  | "home"
  | "info"
  | "language"
  | "list"
  | "maximize"
  | "minimize"
  | "more"
  | "note"
  | "page"
  | "pause"
  | "pin"
  | "play"
  | "plugin"
  | "refresh"
  | "search"
  | "settings"
  | "shield"
  | "stop"
  | "storage"
  | "timer"
  | "tools"
  | "warning"
  | "weather"
  | "widgets";

const iconElements: Record<IconName, string> = {
  activity: "mdui-icon-monitor-heart--outlined",
  add: "mdui-icon-add",
  app: "mdui-icon-verified-user",
  audio: "mdui-icon-volume-up--outlined",
  back: "mdui-icon-arrow-back",
  chart: "mdui-icon-show-chart",
  check: "mdui-icon-check",
  "chevron-down": "mdui-icon-expand-more",
  "chevron-right": "mdui-icon-chevron-right",
  close: "mdui-icon-close",
  command: "mdui-icon-apps",
  delete: "mdui-icon-delete-outline",
  diagnostics: "mdui-icon-bug-report--outlined",
  external: "mdui-icon-open-in-new",
  favorite: "mdui-icon-favorite-border",
  "favorite-filled": "mdui-icon-favorite",
  filter: "mdui-icon-filter-list",
  forward: "mdui-icon-arrow-forward",
  grid: "mdui-icon-grid-view",
  hdr: "mdui-icon-hdr-on--outlined",
  help: "mdui-icon-help-outline",
  history: "mdui-icon-history",
  home: "mdui-icon-home--outlined",
  info: "mdui-icon-info",
  language: "mdui-icon-language",
  list: "mdui-icon-view-list",
  maximize: "mdui-icon-crop-square",
  minimize: "mdui-icon-remove",
  more: "mdui-icon-more-vert",
  note: "mdui-icon-sticky-note-2--outlined",
  page: "mdui-icon-description--outlined",
  pause: "mdui-icon-pause",
  pin: "mdui-icon-push-pin--outlined",
  play: "mdui-icon-play-circle-outline",
  plugin: "mdui-icon-extension--outlined",
  refresh: "mdui-icon-refresh",
  search: "mdui-icon-search",
  settings: "mdui-icon-settings--outlined",
  shield: "mdui-icon-shield--outlined",
  stop: "mdui-icon-stop",
  storage: "mdui-icon-storage--outlined",
  timer: "mdui-icon-timer--outlined",
  tools: "mdui-icon-build--outlined",
  warning: "mdui-icon-warning-amber",
  weather: "mdui-icon-wb-sunny--outlined",
  widgets: "mdui-icon-widgets--outlined",
};

interface IconProps {
  readonly name: IconName;
  readonly className?: string;
}

export function Icon({ name, className = "" }: IconProps) {
  return createElement(iconElements[name], {
    class: `tc-icon ${className}`.trim(),
    "aria-hidden": "true",
  });
}
