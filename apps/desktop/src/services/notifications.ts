import type { UiNotification } from "@tool-center/plugin-contract";

export interface LauncherNotification extends UiNotification {
  readonly pluginId?: string;
}

export function notify(notification: LauncherNotification): void {
  window.dispatchEvent(new CustomEvent("toolcenter:notification", { detail: notification }));
}

