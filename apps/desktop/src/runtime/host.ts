import {
  createPluginContextFactory,
  createTauriBridge,
  isTauriHost,
  MemoryHostBridge,
  PluginRuntime,
  SharedEventBus,
  SharedScheduler,
} from "@tool-center/plugin-runtime";

import { pluginRegistry } from "../plugin-registry.generated";
import { requestConfirmation } from "../services/confirmations";

export const hostBridge = isTauriHost() ? createTauriBridge() : new MemoryHostBridge();
export const sharedScheduler = new SharedScheduler();
export const sharedEventBus = new SharedEventBus();

const contextFactory = createPluginContextFactory({
  bridge: hostBridge,
  scheduler: sharedScheduler,
  eventBus: sharedEventBus,
  permissionPrompt: async ({ pluginId, permission, reason }) => {
    const accepted = await requestConfirmation({
      title: "权限请求",
      message: `${pluginId} 需要使用“${permission}”权限。`,
      detail: reason,
      confirmLabel: "允许",
      cancelLabel: "拒绝",
      tone: "permission",
    });
    return accepted ? "granted" : "denied";
  },
  confirm: async ({ title, message, dangerous }) =>
    requestConfirmation({
      title,
      message,
      confirmLabel: dangerous ? title : "确认",
      cancelLabel: "取消",
      tone: dangerous ? "danger" : "normal",
    }),
  notify: (notification) =>
    window.dispatchEvent(
      new CustomEvent("toolcenter:notification", { detail: notification }),
    ),
});

export const pluginRuntime = new PluginRuntime(pluginRegistry, contextFactory);
