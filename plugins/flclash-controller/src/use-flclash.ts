import type {
  PermissionDecision,
  PluginContext,
  ProxyClientStatus,
  ProxyGroupSummary,
} from "@tool-center/plugin-contract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  proxyGroupStorageKey,
  resolveProxyGroupSelection,
  selectProxyAndReload,
  setProxyAndReload,
} from "./flclash-model";

type LoadPhase =
  | "idle"
  | "checking"
  | "loading"
  | "ready"
  | "unavailable"
  | "empty"
  | "error";

interface FlClashState {
  readonly phase: LoadPhase;
  readonly readPermission: PermissionDecision | null;
  readonly status: ProxyClientStatus;
  readonly groups: readonly ProxyGroupSummary[];
  readonly selectedGroupName: string | null;
  readonly staleSelection: boolean;
  readonly busy: boolean;
  readonly errorMessage: string | null;
  readonly successMessage: string | null;
}

export interface FlClashController extends FlClashState {
  readonly selectedGroup: ProxyGroupSummary | null;
  readonly checkReadPermission: () => Promise<void>;
  readonly requestReadPermission: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly selectGroup: (groupName: string) => Promise<void>;
  readonly selectNode: (proxyName: string) => Promise<void>;
  readonly toggleProxy: () => Promise<void>;
}

const initialStatus: ProxyClientStatus = {
  controllerAvailable: false,
  version: null,
  mode: null,
  mixedPort: null,
  proxyEnabled: false,
};

export function useFlClash(
  context: PluginContext,
  instanceId: string,
  visible: boolean,
): FlClashController {
  const storageKey = proxyGroupStorageKey(instanceId);
  const mountedRef = useRef(true);
  const refreshingRef = useRef(false);
  const operationRef = useRef(false);
  const requestEpochRef = useRef(0);
  const [state, setState] = useState<FlClashState>({
    phase: visible ? "checking" : "idle",
    readPermission: null,
    status: initialStatus,
    groups: [],
    selectedGroupName: null,
    staleSelection: false,
    busy: false,
    errorMessage: null,
    successMessage: null,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(
    async (silent = false): Promise<void> => {
      if (!visible || refreshingRef.current || operationRef.current) return;
      const requestEpoch = ++requestEpochRef.current;
      refreshingRef.current = true;
      if (!silent) {
        setState((current) => ({
          ...current,
          phase: "loading",
          errorMessage: null,
          successMessage: null,
        }));
      }
      try {
        const status = await context.proxyClient.getStatus();
        if (!mountedRef.current || requestEpoch !== requestEpochRef.current) return;
        if (!status.controllerAvailable) {
          setState((current) => ({
            ...current,
            phase: "unavailable",
            status,
            groups: [],
            selectedGroupName: null,
            staleSelection: false,
            errorMessage: null,
          }));
          return;
        }

        const [groups, storedGroupName] = await Promise.all([
          context.proxyClient.listGroups(),
          context.storage.read<string>(storageKey),
        ]);
        if (!mountedRef.current || requestEpoch !== requestEpochRef.current) return;
        const selection = resolveProxyGroupSelection(groups, storedGroupName, status.mode);
        if (selection.stale && selection.selectedGroupName !== null) {
          await context.storage.write(storageKey, selection.selectedGroupName);
        }
        setState((current) => ({
          ...current,
          phase: groups.length === 0 ? "empty" : "ready",
          status,
          groups,
          selectedGroupName: selection.selectedGroupName,
          staleSelection: false,
          errorMessage: null,
          successMessage: null,
        }));
      } catch (error) {
        if (requestEpoch !== requestEpochRef.current) return;
        const message = errorMessage(error);
        await context.logger.error("读取 FlClash 状态失败", { message });
        if (mountedRef.current) {
          setState((current) => ({
            ...current,
            phase: silent && current.phase !== "loading" ? current.phase : "error",
            errorMessage: message,
          }));
        }
      } finally {
        refreshingRef.current = false;
      }
    },
    [context, storageKey, visible],
  );

  const checkReadPermission = useCallback(async (): Promise<void> => {
    if (!visible) return;
    setState((current) => ({
      ...current,
      phase: "checking",
      errorMessage: null,
      successMessage: null,
    }));
    try {
      const decision = await context.permissions.status("proxy.read");
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        readPermission: decision,
        phase: decision === "granted" ? "loading" : "checking",
      }));
    } catch (error) {
      if (mountedRef.current) {
        setState((current) => ({
          ...current,
          phase: "error",
          errorMessage: errorMessage(error),
        }));
      }
    }
  }, [context, visible]);

  useEffect(() => {
    if (visible) void checkReadPermission();
  }, [checkReadPermission, visible]);

  useEffect(() => {
    if (visible && state.readPermission === "granted") void loadData();
  }, [loadData, state.readPermission, visible]);

  useEffect(() => {
    if (!visible || state.readPermission !== "granted") return;
    try {
      const release = context.scheduler.register({
        id: "flclash-status-refresh",
        intervalMs: 5_000,
        runWhenHidden: false,
        priority: "low",
        callback: () => loadData(true),
      });
      return () => {
        void release();
      };
    } catch (error) {
      const message = errorMessage(error);
      queueMicrotask(() => {
        if (mountedRef.current) {
          setState((current) => ({ ...current, errorMessage: message }));
        }
      });
      void context.logger.error("启动 FlClash 状态刷新失败", { message });
      return;
    }
  }, [context, loadData, state.readPermission, visible]);

  const requestReadPermission = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, phase: "checking", errorMessage: null }));
    try {
      const decision = await context.permissions.request(
        "proxy.read",
        "用于读取定制版 FlClash 的连接状态、代理组和当前节点。只访问本机 127.0.0.1:19090。",
      );
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        readPermission: decision,
        phase: decision === "granted" ? "loading" : "checking",
      }));
    } catch (error) {
      if (mountedRef.current) {
        setState((current) => ({
          ...current,
          phase: "error",
          errorMessage: errorMessage(error),
        }));
      }
    }
  }, [context]);

  const requestControlPermission = useCallback(
    async (reason: string): Promise<void> => {
      let permission = await context.permissions.status("proxy.control");
      if (permission === "prompt") {
        permission = await context.permissions.request("proxy.control", reason);
      }
      if (permission !== "granted") {
        throw new Error("未获得代理控制权限，请在插件权限设置中允许后重试。");
      }
    },
    [context],
  );

  const selectGroup = useCallback(
    async (groupName: string): Promise<void> => {
      if (!state.groups.some((group) => group.name === groupName)) return;
      try {
        await context.storage.write(storageKey, groupName);
        if (mountedRef.current) {
          setState((current) => ({
            ...current,
            selectedGroupName: groupName,
            staleSelection: false,
            errorMessage: null,
            successMessage: null,
          }));
        }
      } catch (error) {
        if (mountedRef.current) {
          setState((current) => ({ ...current, errorMessage: errorMessage(error) }));
        }
      }
    },
    [context, state.groups, storageKey],
  );

  const selectedGroup =
    state.groups.find((group) => group.name === state.selectedGroupName) ?? null;

  const selectNode = useCallback(
    async (proxyName: string): Promise<void> => {
      if (
        selectedGroup === null ||
        state.busy ||
        operationRef.current ||
        !selectedGroup.all.includes(proxyName)
      ) {
        return;
      }
      setState((current) => ({
        ...current,
        busy: true,
        errorMessage: null,
        successMessage: null,
      }));
      operationRef.current = true;
      requestEpochRef.current += 1;
      try {
        await requestControlPermission(
          `用于将代理组“${selectedGroup.name}”切换到“${proxyName}”。操作前宿主会再次验证节点属于该组。`,
        );
        const result = await selectProxyAndReload(
          context.proxyClient,
          selectedGroup.name,
          proxyName,
        );
        if (!mountedRef.current) return;
        setState((current) => ({
          ...current,
          groups: result.groups,
          selectedGroupName: result.selectedGroup.name,
          busy: false,
          successMessage: `已切换到 ${proxyName}`,
        }));
        context.ui.notify({
          title: "代理节点已切换",
          message: `${selectedGroup.name} → ${proxyName}`,
          level: "success",
        });
      } catch (error) {
        const message = errorMessage(error);
        await context.logger.error("切换 FlClash 代理节点失败", { message });
        if (mountedRef.current) {
          setState((current) => ({ ...current, busy: false, errorMessage: message }));
        }
      } finally {
        operationRef.current = false;
      }
    },
    [context, requestControlPermission, selectedGroup, state.busy],
  );

  const toggleProxy = useCallback(async (): Promise<void> => {
    if (!state.status.controllerAvailable || state.busy || operationRef.current) {
      return;
    }
    const status = state.status;
    const enabled = !status.proxyEnabled;
    setState((current) => ({
      ...current,
      busy: true,
      errorMessage: null,
      successMessage: null,
    }));
    operationRef.current = true;
    requestEpochRef.current += 1;
    try {
      await requestControlPermission(
        `用于${enabled ? "启动" : "停止"} FlClash 主代理开关。宿主只会发送专用快捷键 Ctrl+Alt+Shift+F12，并核验本地代理端口状态。`,
      );
      const refreshed = await setProxyAndReload(context.proxyClient, enabled);
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        status: refreshed,
        busy: false,
        successMessage: enabled ? "FlClash 代理已启动" : "FlClash 代理已停止",
      }));
      context.ui.notify({
        title: enabled ? "FlClash 代理已启动" : "FlClash 代理已停止",
        message: `主开关状态已通过本地端口 ${refreshed.mixedPort ?? "状态"} 核验。`,
        level: "success",
      });
    } catch (error) {
      const message = errorMessage(error);
      await context.logger.error("切换 FlClash 主代理开关失败", { message });
      if (mountedRef.current) {
        setState((current) => ({ ...current, busy: false, errorMessage: message }));
      }
    } finally {
      operationRef.current = false;
    }
  }, [context, requestControlPermission, state.busy, state.status]);

  return useMemo(
    () => ({
      ...state,
      status: state.status,
      selectedGroup,
      checkReadPermission,
      requestReadPermission,
      refresh: () => loadData(false),
      selectGroup,
      selectNode,
      toggleProxy,
    }),
    [
      checkReadPermission,
      loadData,
      requestReadPermission,
      selectGroup,
      selectedGroup,
      selectNode,
      state,
      toggleProxy,
    ],
  );
}

function errorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "userMessage" in error &&
    typeof error.userMessage === "string"
  ) {
    return error.userMessage;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
