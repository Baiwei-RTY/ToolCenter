import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { PluginDefinition } from "@tool-center/plugin-contract";

export interface DiscoveredPlugin {
  readonly directory: string;
  readonly manifestPath: string;
  readonly packagePath: string;
}

export async function discoverPlugins(workspaceRoot: string): Promise<readonly DiscoveredPlugin[]> {
  const pluginsRoot = path.join(workspaceRoot, "plugins");
  const entries = await readdir(pluginsRoot, { withFileTypes: true }).catch(() => []);
  const plugins: DiscoveredPlugin[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directory = path.join(pluginsRoot, entry.name);
    const manifestPath = path.join(directory, "plugin.manifest.ts");
    const packagePath = path.join(directory, "package.json");
    if ((await exists(manifestPath)) && (await exists(packagePath))) {
      plugins.push({ directory, manifestPath, packagePath });
    }
  }

  return plugins;
}

export async function loadManifest(manifestPath: string): Promise<PluginDefinition> {
  const url = pathToFileURL(manifestPath);
  url.searchParams.set("generatedAt", String(Date.now()));
  const module = (await import(url.href)) as { readonly default?: PluginDefinition };
  if (module.default === undefined) {
    throw new Error(`${manifestPath} must export the plugin manifest as default.`);
  }
  return module.default;
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

async function exists(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

