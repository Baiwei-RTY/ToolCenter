import type { PluginRuntimeSnapshot } from "@tool-center/plugin-contract";
import { useEffect, useState } from "react";

import { pluginRuntime } from "../runtime/host";

export function useRuntimeSnapshots(): readonly PluginRuntimeSnapshot[] {
  const [snapshots, setSnapshots] = useState<readonly PluginRuntimeSnapshot[]>(() =>
    pluginRuntime.snapshots(),
  );

  useEffect(
    () => pluginRuntime.subscribe(() => setSnapshots(pluginRuntime.snapshots())),
    [],
  );
  return snapshots;
}

