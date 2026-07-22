import type {
  AudioDefaultRole,
  AudioDeviceState,
  AudioDeviceSummary,
  AudioService,
} from "@tool-center/plugin-contract";

export const allDefaultRoles = [
  "console",
  "multimedia",
  "communications",
] as const satisfies readonly AudioDefaultRole[];

export type DefaultDevices = Readonly<Record<AudioDefaultRole, AudioDeviceSummary | null>>;

export interface AudioOutputSnapshot {
  readonly devices: readonly AudioDeviceSummary[];
  readonly defaults: DefaultDevices;
}

export async function loadAudioOutputSnapshot(audio: AudioService): Promise<AudioOutputSnapshot> {
  const [devices, consoleDevice, multimediaDevice, communicationsDevice] = await Promise.all([
    audio.listDevices("output"),
    audio.getDefaultDevice("output", "console"),
    audio.getDefaultDevice("output", "multimedia"),
    audio.getDefaultDevice("output", "communications"),
  ]);
  const defaults: DefaultDevices = {
    console: consoleDevice,
    multimedia: multimediaDevice,
    communications: communicationsDevice,
  };
  return { devices: normalizeOutputDevices(devices, defaults), defaults };
}

export function setAllDefaultOutputRoles(audio: AudioService, deviceId: string): Promise<void> {
  return audio.setDefaultDevice(deviceId, allDefaultRoles);
}

export function normalizeOutputDevices(
  devices: readonly AudioDeviceSummary[],
  defaults: DefaultDevices,
): readonly AudioDeviceSummary[] {
  const defaultIds = new Set(
    allDefaultRoles.map((role) => defaults[role]?.id).filter((id): id is string => id !== undefined),
  );

  return devices
    .filter((device) => device.kind === "output")
    .toSorted((left, right) => {
      const leftDefault = defaultIds.has(left.id) ? 0 : 1;
      const rightDefault = defaultIds.has(right.id) ? 0 : 1;
      if (leftDefault !== rightDefault) return leftDefault - rightDefault;

      const leftState = stateOrder(left.state);
      const rightState = stateOrder(right.state);
      if (leftState !== rightState) return leftState - rightState;
      return left.name.localeCompare(right.name, "zh-CN");
    });
}

export function primaryDefault(defaults: DefaultDevices): AudioDeviceSummary | null {
  return defaults.console ?? defaults.multimedia ?? defaults.communications;
}

export function isDefaultForEveryRole(deviceId: string, defaults: DefaultDevices): boolean {
  return allDefaultRoles.every((role) => defaults[role]?.id === deviceId);
}

export function deviceStateLabel(state: AudioDeviceState): string {
  switch (state) {
    case "active":
      return "可用";
    case "disabled":
      return "已禁用";
    case "unplugged":
      return "已拔出";
    case "not-present":
      return "未连接";
  }
}

export function roleLabel(role: AudioDefaultRole): string {
  switch (role) {
    case "console":
      return "常规";
    case "multimedia":
      return "媒体";
    case "communications":
      return "通信";
  }
}

export type AudioFailureKind = "unsupported" | "unavailable" | "generic";

export function classifyAudioFailure(error: unknown): AudioFailureKind {
  const message = error instanceof Error ? error.message : String(error);
  if (/not supported|unsupported|不支持/i.test(message)) return "unsupported";
  if (/not available|unavailable|宿主不可用/i.test(message)) return "unavailable";
  return "generic";
}

function stateOrder(state: AudioDeviceState): number {
  switch (state) {
    case "active":
      return 0;
    case "unplugged":
      return 1;
    case "disabled":
      return 2;
    case "not-present":
      return 3;
  }
}
