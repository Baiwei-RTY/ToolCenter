import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

interface RootPackage {
  version: string;
}

const workspaceRoot = process.cwd();
const sourceExecutable = path.join(
  workspaceRoot,
  "target",
  "release",
  "toolcenter-desktop.exe",
);
const releaseDirectory = path.join(workspaceRoot, "正式版");
const releaseExecutable = path.join(releaseDirectory, "ToolCenter.exe");

const rootPackage = JSON.parse(
  await readFile(path.join(workspaceRoot, "package.json"), "utf8"),
) as RootPackage;

await stat(sourceExecutable);
await mkdir(releaseDirectory, { recursive: true });
await copyFile(sourceExecutable, releaseExecutable);

const executable = await readFile(releaseExecutable);
const sha256 = createHash("sha256").update(executable).digest("hex");
await writeFile(
  path.join(releaseDirectory, "ToolCenter.exe.sha256"),
  `${sha256}  ToolCenter.exe\n`,
  "utf8",
);
await writeFile(
  path.join(releaseDirectory, "版本信息.json"),
  `${JSON.stringify(
    {
      productName: "ToolCenter",
      version: rootPackage.version,
      channel: "formal-development",
      platform: "windows-x64",
      executable: "ToolCenter.exe",
      sha256,
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Updated formal release: ${path.relative(workspaceRoot, releaseExecutable)}`);
