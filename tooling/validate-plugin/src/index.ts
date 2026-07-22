import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { discoverPlugins, loadManifest } from "../../shared/plugins";

interface ValidationFailure {
  readonly plugin: string;
  readonly message: string;
  readonly file?: string;
}

const workspaceRoot = process.cwd();
const plugins = await discoverPlugins(workspaceRoot);
const failures: ValidationFailure[] = [];
const manifestIds = new Map<string, string>();

for (const plugin of plugins) {
  const packageJson = JSON.parse(await readFile(plugin.packagePath, "utf8")) as {
    readonly name?: string;
    readonly private?: boolean;
  };

  let manifest;
  try {
    manifest = await loadManifest(plugin.manifestPath);
  } catch (error) {
    failures.push({
      plugin: path.basename(plugin.directory),
      file: plugin.manifestPath,
      message: error instanceof Error ? error.message : String(error),
    });
    continue;
  }

  const previousDirectory = manifestIds.get(manifest.id);
  if (previousDirectory !== undefined) {
    failures.push({
      plugin: manifest.id,
      message: `Plugin id is already used by ${previousDirectory}.`,
    });
  }
  manifestIds.set(manifest.id, plugin.directory);

  if (!packageJson.name?.startsWith("@tool-center/plugin-")) {
    failures.push({ plugin: manifest.id, message: "Package name must start with @tool-center/plugin-." });
  }
  if (packageJson.private !== true) {
    failures.push({ plugin: manifest.id, message: "First-party plugin packages must be private." });
  }

  validateContributions(manifest, failures);
  if (new Set(manifest.permissions).size !== manifest.permissions.length) {
    failures.push({ plugin: manifest.id, message: "Permission declarations must not contain duplicates." });
  }

  for (const sourceFile of await collectSourceFiles(plugin.directory)) {
    const contents = await readFile(sourceFile, "utf8");
    const relativeFile = path.relative(workspaceRoot, sourceFile);
    const rules: readonly [RegExp, string][] = [
      [/(?:from\s*|import\s*\()\s*["']@tauri-apps\//, "Plugins cannot import @tauri-apps directly."],
      [/(?:from\s*|import\s*\()["'][^"']*apps\/desktop/, "Plugins cannot import launcher internals."],
      [/(?:from\s*|import\s*\()["'][^"']*plugins\//, "Plugins cannot import another plugin's internal source."],
      [/\bsetInterval\s*\(/, "Long-running setInterval calls are forbidden; use context.scheduler."],
    ];
    if (sourceFile.endsWith("plugin.manifest.ts")) {
      rules.push([
        /\b(?:fetch|addEventListener|setTimeout|setInterval|invoke)\s*\(/,
        "Plugin manifests must not execute top-level side effects.",
      ]);
    }

    for (const [pattern, message] of rules) {
      if (pattern.test(contents)) {
        failures.push({ plugin: manifest.id, file: relativeFile, message });
      }
    }

    if (sourceFile.endsWith(".css") && /(^|})\s*(?:\*|html|body|button|input|:root)\s*\{/m.test(contents)) {
      failures.push({
        plugin: manifest.id,
        file: relativeFile,
        message: "Plugin styles cannot target global elements or redefine root tokens.",
      });
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(
      `[${failure.plugin}] ${failure.message}${failure.file ? ` (${failure.file})` : ""}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log(`Validated ${plugins.length} plugin(s).`);
}

function validateContributions(
  manifest: Awaited<ReturnType<typeof loadManifest>>,
  target: ValidationFailure[],
): void {
  const pairs = [
    ["actions", manifest.contributes.actions, manifest.entrypoints.actions],
    ["widgets", manifest.contributes.widgets, manifest.entrypoints.widget],
    ["pages", manifest.contributes.pages, manifest.entrypoints.page],
    ["services", manifest.contributes.services, manifest.entrypoints.service],
  ] as const;

  for (const [name, contributions, entrypoint] of pairs) {
    if ((contributions?.length ?? 0) > 0 && entrypoint === undefined) {
      target.push({
        plugin: manifest.id,
        message: `${name} contributions require a matching lazy entrypoint.`,
      });
    }
  }

  const ids = Object.values(manifest.contributes)
    .flatMap((items) => items ?? [])
    .map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    target.push({ plugin: manifest.id, message: "Contribution ids must be unique within a plugin." });
  }
}

async function collectSourceFiles(directory: string): Promise<readonly string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)));
    } else if (/\.(?:ts|tsx|css)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

