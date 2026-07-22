import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

import { pluginRuntime } from "../../runtime/host";
import { notify } from "../../services/notifications";
import { useAppStore } from "../../stores/app-store";
import type { SearchItem } from "./search-index";

export function useExecuteSearchItem(): (item: SearchItem) => Promise<void> {
  const router = useRouter();
  const addRecent = useAppStore((state) => state.addRecent);

  return useCallback(
    async (item: SearchItem) => {
      try {
        if (item.kind === "action" && item.pluginId && item.actionId) {
          const result = await pluginRuntime.runAction(item.pluginId, item.actionId);
          addRecent({
            id: item.id,
            title: item.title,
            kind: "action",
            pluginId: item.pluginId,
          });
          notify({
            title: result.success ? "操作完成" : "操作未完成",
            message: result.message,
            level: result.success ? "success" : "warning",
            pluginId: item.pluginId,
          });
          return;
        }

        let route = item.route;
        if (item.kind === "plugin" && item.pluginId) {
          const definition = pluginRuntime.definition(item.pluginId);
          const page = definition.contributes.pages?.[0];
          const action = definition.contributes.actions?.[0];
          if (page) {
            route = `/plugin/${encodeURIComponent(item.pluginId)}/${encodeURIComponent(page.id)}`;
          } else if (action) {
            await pluginRuntime.runAction(item.pluginId, action.id);
          }
        }

        if (route) {
          await router.history.push(route);
        }
        addRecent({
          id: item.id,
          title: item.title,
          kind: item.kind === "setting" ? "setting" : item.kind === "page" ? "page" : "plugin",
          ...(item.pluginId ? { pluginId: item.pluginId } : {}),
        });
      } catch (error) {
        notify({
          title: "操作失败",
          message: error instanceof Error ? error.message : String(error),
          level: "error",
          ...(item.pluginId ? { pluginId: item.pluginId } : {}),
        });
      }
    },
    [addRecent, router],
  );
}

