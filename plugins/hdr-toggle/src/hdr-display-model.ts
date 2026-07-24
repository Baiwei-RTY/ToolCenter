import type { DisplayService, DisplaySummary } from "@tool-center/plugin-contract";

export interface DisplaySelection {
  readonly selectedId: string | null;
  readonly stale: boolean;
}

export interface HdrUpdateResult {
  readonly displays: readonly DisplaySummary[];
  readonly selected: DisplaySummary;
}

export function displaySelectionStorageKey(instanceId: string): string {
  return `widget-${instanceId}-display-id`;
}

export function sortDisplays(displays: readonly DisplaySummary[]): readonly DisplaySummary[] {
  return displays.toSorted((left, right) => {
    if (left.primary !== right.primary) return left.primary ? -1 : 1;
    const sourceOrder = left.sourceName.localeCompare(right.sourceName, "zh-CN", {
      numeric: true,
    });
    return sourceOrder === 0 ? left.name.localeCompare(right.name, "zh-CN") : sourceOrder;
  });
}

export function resolveDisplaySelection(
  displays: readonly DisplaySummary[],
  storedId: string | null,
): DisplaySelection {
  if (storedId !== null) {
    return displays.some((display) => display.id === storedId)
      ? { selectedId: storedId, stale: false }
      : { selectedId: null, stale: true };
  }
  return {
    selectedId: displays.find((display) => display.primary)?.id ?? displays[0]?.id ?? null,
    stale: false,
  };
}

export async function setHdrAndReload(
  displayService: DisplayService,
  displayId: string,
  enabled: boolean,
): Promise<HdrUpdateResult> {
  await displayService.setHdrEnabled(displayId, enabled);
  const displays = sortDisplays(await displayService.listDisplays());
  const selected = displays.find((display) => display.id === displayId);
  if (selected === undefined) {
    throw new Error("所选显示器已断开，请刷新列表后重新选择。");
  }
  if (selected.hdrEnabled !== enabled) {
    throw new Error("Windows 返回的 HDR 状态与请求不一致，请刷新后重试。");
  }
  return { displays, selected };
}

export function hdrStatusLabel(display: DisplaySummary): string {
  if (!display.hdrSupported) return "不支持 HDR";
  return display.hdrEnabled ? "HDR 已开启" : "HDR 已关闭";
}

export function displaySourceLabel(display: DisplaySummary): string {
  return `${display.primary ? "主显示器 · " : ""}${display.sourceName.replace(/^\\\\\.\\/, "")}`;
}
