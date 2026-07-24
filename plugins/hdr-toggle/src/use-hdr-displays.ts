import type {
  DisplaySummary,
  PermissionDecision,
  PluginContext,
} from "@tool-center/plugin-contract";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  displaySelectionStorageKey,
  resolveDisplaySelection,
  setHdrAndReload,
  sortDisplays,
} from "./hdr-display-model";

type LoadPhase = "idle" | "checking" | "loading" | "ready" | "empty" | "error";

interface HdrDisplayState {
  readonly phase: LoadPhase;
  readonly readPermission: PermissionDecision | null;
  readonly displays: readonly DisplaySummary[];
  readonly selectedId: string | null;
  readonly staleSelection: boolean;
  readonly busy: boolean;
  readonly errorMessage: string | null;
  readonly successMessage: string | null;
}

export interface HdrDisplayController extends HdrDisplayState {
  readonly selected: DisplaySummary | null;
  readonly checkReadPermission: () => Promise<void>;
  readonly requestReadPermission: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly selectDisplay: (displayId: string) => Promise<void>;
  readonly toggleHdr: () => Promise<void>;
}

export function useHdrDisplays(
  context: PluginContext,
  instanceId: string,
  visible: boolean,
): HdrDisplayController {
  const storageKey = displaySelectionStorageKey(instanceId);
  const [state, setState] = useState<HdrDisplayState>({
    phase: visible ? "checking" : "idle",
    readPermission: null,
    displays: [],
    selectedId: null,
    staleSelection: false,
    busy: false,
    errorMessage: null,
    successMessage: null,
  });

  const loadDisplays = useCallback(async (): Promise<void> => {
    if (!visible) return;
    setState((current) => ({
      ...current,
      phase: "loading",
      errorMessage: null,
      successMessage: null,
    }));
    try {
      const [displays, storedId] = await Promise.all([
        context.display.listDisplays(),
        context.storage.read<string>(storageKey),
      ]);
      const ordered = sortDisplays(displays);
      const selection = resolveDisplaySelection(ordered, storedId);
      setState((current) => ({
        ...current,
        phase: ordered.length === 0 ? "empty" : "ready",
        displays: ordered,
        selectedId: selection.selectedId,
        staleSelection: selection.stale,
        errorMessage: selection.stale
          ? "之前选择的显示器当前不可用，请重新选择目标屏幕。"
          : null,
      }));
    } catch (error) {
      const message = errorMessage(error);
      await context.logger.error("读取 HDR 显示器失败", { message });
      setState((current) => ({
        ...current,
        phase: "error",
        errorMessage: message,
      }));
    }
  }, [context, storageKey, visible]);

  const checkReadPermission = useCallback(async (): Promise<void> => {
    if (!visible) return;
    setState((current) => ({
      ...current,
      phase: "checking",
      errorMessage: null,
      successMessage: null,
    }));
    try {
      const decision = await context.permissions.status("display.read");
      setState((current) => ({
        ...current,
        readPermission: decision,
        phase: decision === "granted" ? "loading" : "checking",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        phase: "error",
        errorMessage: errorMessage(error),
      }));
    }
  }, [context, visible]);

  useEffect(() => {
    if (visible) void checkReadPermission();
  }, [checkReadPermission, visible]);

  useEffect(() => {
    if (visible && state.readPermission === "granted") void loadDisplays();
  }, [loadDisplays, state.readPermission, visible]);

  const requestReadPermission = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, phase: "checking", errorMessage: null }));
    try {
      const decision = await context.permissions.request(
        "display.read",
        "用于列出当前活动显示器，并读取每台显示器的 Windows HDR 支持和开关状态。",
      );
      setState((current) => ({
        ...current,
        readPermission: decision,
        phase: decision === "granted" ? "loading" : "checking",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        phase: "error",
        errorMessage: errorMessage(error),
      }));
    }
  }, [context]);

  const selectDisplay = useCallback(
    async (displayId: string): Promise<void> => {
      if (!state.displays.some((display) => display.id === displayId)) return;
      try {
        await context.storage.write(storageKey, displayId);
        setState((current) => ({
          ...current,
          selectedId: displayId,
          staleSelection: false,
          errorMessage: null,
          successMessage: null,
        }));
      } catch (error) {
        setState((current) => ({ ...current, errorMessage: errorMessage(error) }));
      }
    },
    [context, state.displays, storageKey],
  );

  const selected =
    state.displays.find((display) => display.id === state.selectedId) ?? null;

  const toggleHdr = useCallback(async (): Promise<void> => {
    if (selected === null || !selected.hdrSupported || state.busy) return;
    const nextEnabled = !selected.hdrEnabled;
    setState((current) => ({
      ...current,
      busy: true,
      errorMessage: null,
      successMessage: null,
    }));
    try {
      let permission = await context.permissions.status("display.control");
      if (permission === "prompt") {
        permission = await context.permissions.request(
          "display.control",
          `用于${nextEnabled ? "开启" : "关闭"}“${selected.name}”的 Windows HDR。只会修改当前选择的显示器。`,
        );
      }
      if (permission !== "granted") {
        throw new Error("未获得 HDR 控制权限，请在插件权限设置中允许后重试。");
      }

      const result = await setHdrAndReload(context.display, selected.id, nextEnabled);
      setState((current) => ({
        ...current,
        displays: result.displays,
        selectedId: result.selected.id,
        busy: false,
        successMessage: nextEnabled ? "HDR 已开启" : "HDR 已关闭",
      }));
      context.ui.notify({
        title: nextEnabled ? "HDR 已开启" : "HDR 已关闭",
        message: `${selected.name} 的 Windows HDR 已${nextEnabled ? "开启" : "关闭"}。`,
        level: "success",
      });
    } catch (error) {
      const message = errorMessage(error);
      await context.logger.error("切换显示器 HDR 失败", { message });
      setState((current) => ({
        ...current,
        busy: false,
        errorMessage: message,
      }));
    }
  }, [context, selected, state.busy]);

  return useMemo(
    () => ({
      ...state,
      selected,
      checkReadPermission,
      requestReadPermission,
      refresh: loadDisplays,
      selectDisplay,
      toggleHdr,
    }),
    [
      checkReadPermission,
      loadDisplays,
      requestReadPermission,
      selectDisplay,
      selected,
      state,
      toggleHdr,
    ],
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "userMessage" in error &&
    typeof error.userMessage === "string"
  ) {
    return error.userMessage;
  }
  return String(error);
}
