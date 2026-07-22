import type { AudioDeviceSummary, PermissionDecision, PluginContext, Release } from "@tool-center/plugin-contract";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  classifyAudioFailure,
  loadAudioOutputSnapshot,
  setAllDefaultOutputRoles,
  type AudioFailureKind,
  type DefaultDevices,
} from "./audio-device-model";

type LoadPhase = "checking" | "loading" | "ready" | "empty" | "error";

interface AudioOutputState {
  readonly phase: LoadPhase;
  readonly readPermission: PermissionDecision | null;
  readonly devices: readonly AudioDeviceSummary[];
  readonly defaults: DefaultDevices;
  readonly failureKind: AudioFailureKind | null;
  readonly errorMessage: string | null;
  readonly actionError: string | null;
  readonly switchingDeviceId: string | null;
  readonly lastSwitchedDeviceId: string | null;
}

const emptyDefaults: DefaultDevices = {
  console: null,
  multimedia: null,
  communications: null,
};

export interface AudioOutputController extends AudioOutputState {
  readonly requestReadPermission: () => Promise<void>;
  readonly checkReadPermission: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly switchTo: (device: AudioDeviceSummary) => Promise<void>;
}

export function useAudioOutput(context: PluginContext): AudioOutputController {
  const [state, setState] = useState<AudioOutputState>({
    phase: "checking",
    readPermission: null,
    devices: [],
    defaults: emptyDefaults,
    failureKind: null,
    errorMessage: null,
    actionError: null,
    switchingDeviceId: null,
    lastSwitchedDeviceId: null,
  });

  const loadDevices = useCallback(
    async (showLoading: boolean): Promise<void> => {
      if (showLoading) {
        setState((current) => ({
          ...current,
          phase: "loading",
          failureKind: null,
          errorMessage: null,
        }));
      }

      try {
        const snapshot = await loadAudioOutputSnapshot(context.audio);
        setState((current) => ({
          ...current,
          phase: snapshot.devices.length === 0 ? "empty" : "ready",
          devices: snapshot.devices,
          defaults: snapshot.defaults,
          failureKind: null,
          errorMessage: null,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await context.logger.error("读取音频输出设备失败", { message });
        setState((current) => ({
          ...current,
          phase: "error",
          failureKind: classifyAudioFailure(error),
          errorMessage: message,
        }));
      }
    },
    [context],
  );

  const checkReadPermission = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, phase: "checking", actionError: null }));
    try {
      const decision = await context.permissions.status("audio.read");
      setState((current) => ({ ...current, readPermission: decision }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((current) => ({
        ...current,
        phase: "error",
        failureKind: classifyAudioFailure(error),
        errorMessage: message,
      }));
    }
  }, [context]);

  useEffect(() => {
    void checkReadPermission();
  }, [checkReadPermission]);

  useEffect(() => {
    if (state.readPermission !== "granted") return;

    let cancelled = false;
    let release: Release | undefined;
    void loadDevices(true);
    void context.audio
      .subscribeDeviceChanges(() => {
        if (!cancelled) void loadDevices(false);
      })
      .then((nextRelease) => {
        if (cancelled) {
          void nextRelease();
        } else {
          release = nextRelease;
        }
      })
      .catch((error: unknown) =>
        context.logger.warn("订阅音频设备变化失败", {
          message: error instanceof Error ? error.message : String(error),
        }),
      );

    return () => {
      cancelled = true;
      if (release) void release();
    };
  }, [context, loadDevices, state.readPermission]);

  const requestReadPermission = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, phase: "checking", actionError: null }));
    try {
      const decision = await context.permissions.request(
        "audio.read",
        "用于显示可用的 Windows 音频输出设备和当前默认输出。不会读取麦克风。",
      );
      setState((current) => ({
        ...current,
        readPermission: decision,
        phase: decision === "granted" ? "loading" : "checking",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((current) => ({ ...current, phase: "error", errorMessage: message }));
    }
  }, [context]);

  const switchTo = useCallback(
    async (device: AudioDeviceSummary): Promise<void> => {
      if (device.kind !== "output" || device.state !== "active") return;
      setState((current) => ({
        ...current,
        switchingDeviceId: device.id,
        lastSwitchedDeviceId: null,
        actionError: null,
      }));

      try {
        let controlPermission = await context.permissions.status("audio.control");
        if (controlPermission === "prompt") {
          controlPermission = await context.permissions.request(
            "audio.control",
            "用于把选中的设备设为 Windows 的常规、媒体和通信默认音频输出。",
          );
        }
        if (controlPermission !== "granted") {
          throw new Error("未获得音频控制权限，请在插件权限设置中允许后重试。");
        }

        await setAllDefaultOutputRoles(context.audio, device.id);
        await loadDevices(false);
        setState((current) => ({
          ...current,
          switchingDeviceId: null,
          lastSwitchedDeviceId: device.id,
          actionError: null,
        }));
        context.ui.notify({
          title: "音频输出已切换",
          message: `${device.name} 已设为常规、媒体和通信默认输出。`,
          level: "success",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await context.logger.error("切换音频输出设备失败", { deviceId: device.id, message });
        setState((current) => ({
          ...current,
          switchingDeviceId: null,
          actionError: message,
        }));
      }
    },
    [context, loadDevices],
  );

  return useMemo(
    () => ({
      ...state,
      requestReadPermission,
      checkReadPermission,
      refresh: () => loadDevices(true),
      switchTo,
    }),
    [checkReadPermission, loadDevices, requestReadPermission, state, switchTo],
  );
}
