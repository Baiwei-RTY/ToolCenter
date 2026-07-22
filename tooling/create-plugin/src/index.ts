import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

type PluginType = "action" | "widget" | "page" | "service";

const prompt = createInterface({ input: stdin, output: stdout });
const name = (await prompt.question("Plugin directory name (kebab-case): ")).trim();
const id = (await prompt.question("Stable plugin id (for example toolcenter.example): ")).trim();
const displayName = (await prompt.question("Display name: ")).trim();
const requestedType = (await prompt.question("Type (action/widget/page/service): ")).trim();
prompt.close();

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
  throw new Error("Plugin directory name must use kebab-case.");
}
if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(id)) {
  throw new Error("Plugin id must be lowercase and dot- or dash-separated.");
}
if (!["action", "widget", "page", "service"].includes(requestedType)) {
  throw new Error("Plugin type must be action, widget, page, or service.");
}

const type = requestedType as PluginType;
const pluginRoot = path.join(process.cwd(), "plugins", name);
await mkdir(path.join(pluginRoot, "src"), { recursive: false });
await mkdir(path.join(pluginRoot, "tests"));

await writeFile(
  path.join(pluginRoot, "package.json"),
  `${JSON.stringify(
    {
      name: `@tool-center/plugin-${name}`,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: { typecheck: "tsc -p tsconfig.json", test: "vitest run" },
      dependencies: { "@tool-center/plugin-contract": "workspace:*" },
    },
    null,
    2,
  )}\n`,
  "utf8",
);
await writeFile(
  path.join(pluginRoot, "tsconfig.json"),
  `${JSON.stringify(
    { extends: "../../tsconfig.base.json", compilerOptions: { types: ["vitest/globals"] }, include: ["src", "tests", "plugin.manifest.ts"] },
    null,
    2,
  )}\n`,
  "utf8",
);
await writeFile(path.join(pluginRoot, "plugin.manifest.ts"), manifestTemplate(id, displayName, type), "utf8");
await writeFile(path.join(pluginRoot, "src", `${type}s.ts`), entrypointTemplate(type), "utf8");
await writeFile(
  path.join(pluginRoot, "README.md"),
  `# ${displayName}\n\nType: ${type}\n\nDeclare permissions in \`plugin.manifest.ts\` and use only Plugin Context services.\n`,
  "utf8",
);

console.log(`Created plugins/${name}. Run pnpm registry:generate and pnpm plugin:validate.`);

function manifestTemplate(pluginId: string, pluginName: string, pluginType: PluginType): string {
  const manifestKey = pluginType === "widget" ? "widgets" : `${pluginType}s`;
  const entrypointKey = pluginType === "action" ? "actions" : pluginType;
  return `import { definePlugin } from "@tool-center/plugin-contract";

export default definePlugin({
  id: ${JSON.stringify(pluginId)},
  name: ${JSON.stringify(pluginName)},
  description: "Describe this plugin.",
  version: "0.1.0",
  category: "other",
  minHostVersion: "0.1.0",
  entrypoints: {
    ${entrypointKey}: () => import("./src/${pluginType}s"),
  },
  contributes: {
    ${manifestKey}: [],
  },
  permissions: [],
});
`;
}

function entrypointTemplate(pluginType: PluginType): string {
  if (pluginType === "action") {
    return `import type { ActionsEntrypointModule } from "@tool-center/plugin-contract";

export const actions: ActionsEntrypointModule["actions"] = [];
`;
  }
  if (pluginType === "widget") {
    return `import type { WidgetEntrypointModule } from "@tool-center/plugin-contract";

export const widgets: WidgetEntrypointModule["widgets"] = [];
`;
  }
  if (pluginType === "page") {
    return `import type { PageEntrypointModule } from "@tool-center/plugin-contract";

export const pages: PageEntrypointModule["pages"] = [];
`;
  }
  return `import type { ServiceEntrypointModule } from "@tool-center/plugin-contract";

export const services: ServiceEntrypointModule["services"] = [];
`;
}

