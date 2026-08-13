import type {
  ProxyClientService,
  ProxyClientStatus,
  ProxyGroupSummary,
  ProxyNodeSummary,
} from "@tool-center/plugin-contract";

export interface ProxyGroupSelection {
  readonly selectedGroupName: string | null;
  readonly stale: boolean;
}

export interface ProxySelectionResult {
  readonly groups: readonly ProxyGroupSummary[];
  readonly selectedGroup: ProxyGroupSummary;
}

export function proxyGroupStorageKey(instanceId: string): string {
  return `widget-${instanceId}-proxy-group-v2`;
}

export function resolveProxyGroupSelection(
  groups: readonly ProxyGroupSummary[],
  storedGroupName: string | null,
  mode: string | null,
): ProxyGroupSelection {
  const preferredGroupName = preferredProxyGroupName(groups, mode);
  if (storedGroupName !== null) {
    return groups.some((group) => group.name === storedGroupName)
      ? { selectedGroupName: storedGroupName, stale: false }
      : { selectedGroupName: preferredGroupName, stale: true };
  }
  return { selectedGroupName: preferredGroupName, stale: false };
}

function preferredProxyGroupName(
  groups: readonly ProxyGroupSummary[],
  mode: string | null,
): string | null {
  if (mode?.toLowerCase() === "global") {
    return groups.find((group) => group.name.toUpperCase() === "GLOBAL")?.name ??
      groups[0]?.name ??
      null;
  }
  return groups.find((group) => group.name.toUpperCase() !== "GLOBAL")?.name ??
    groups[0]?.name ??
    null;
}

export function proxyStateLabel(status: ProxyClientStatus): string {
  return status.proxyEnabled ? "代理正在运行" : "代理已停止";
}

export function proxyNodeOptionLabel(node: ProxyNodeSummary): string {
  const latency = (() => {
    switch (node.latencyStatus) {
      case "available":
        return node.delayMs === null ? "未测速" : `${Math.round(node.delayMs)} ms`;
      case "unavailable":
        return "不可用";
      case "automatic":
        return "自动";
      case "direct":
        return "直连";
      default:
        return "未测速";
    }
  })();
  return `${node.name} · ${latency}`;
}

export async function selectProxyAndReload(
  service: ProxyClientService,
  groupName: string,
  proxyName: string,
): Promise<ProxySelectionResult> {
  await service.selectProxy(groupName, proxyName);
  const groups = await service.listGroups();
  const selectedGroup = groups.find((group) => group.name === groupName);
  if (selectedGroup === undefined) {
    throw new Error("代理组在切换后不可用，请刷新后重试。");
  }
  if (selectedGroup.selected !== proxyName) {
    throw new Error("FlClash 返回的节点状态与请求不一致，请刷新后重试。");
  }
  return { groups, selectedGroup };
}

export async function setProxyAndReload(
  service: ProxyClientService,
  enabled: boolean,
): Promise<ProxyClientStatus> {
  await service.setProxyEnabled(enabled);
  const status = await service.getStatus();
  if (status.proxyEnabled !== enabled) {
    throw new Error("FlClash 返回的主开关状态与请求不一致，请刷新后重试。");
  }
  return status;
}
