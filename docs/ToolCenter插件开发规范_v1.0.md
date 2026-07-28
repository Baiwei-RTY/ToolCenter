# ToolCenter 插件开发规范

> 历史基线：本文件保留用于追溯 ToolCenter 0.1.x 初始规范。当前开发请使用 [ToolCenter 插件开发规范（统一正式版）](ToolCenter插件开发要求_统一版.md)；两者冲突时，以统一正式版和当前代码契约为准。

## 文档信息

| 项目 | 内容 |
|---|---|
| 文档编号 | TC-PLUGIN-SPEC-001 |
| 版本 | 1.0（实现确认版） |
| 状态 | 正式版，与 ToolCenter 0.1.x 当前实现对齐 |
| 发布日期 | 2026-07-19 |
| 适用宿主 | ToolCenter 0.1.x |
| 适用插件 | 随 ToolCenter 源码构建的第一方内置插件 |
| 维护位置 | `docs/ToolCenter插件开发规范_v1.0.md` |

### 修订记录

| 版本 | 日期 | 说明 |
|---|---|---|
| 1.0 | 2026-07-19 | 确立内置插件结构、独立对话工作流、接口边界、开发规则和验收门禁 |
| 1.0 补充版 | 2026-07-19 | 接入桌面 Widget Host、多实例运行时与 Windows 音频设备服务 |
| 1.0 实现确认版 | 2026-07-19 | 按启动器本体开发结果校准 Widget 契约、音频事件、运行边界和硬件验收要求 |
| 1.0 正式开发基线 | 2026-07-22 | 固定唯一正式版目录，并规定插件直接接入真实 ToolCenter 桌面壳的开发流程 |

## 1. 目的和适用范围

本规范规定 ToolCenter 内置插件的目录结构、Manifest、入口、生命周期、权限、界面、测试和集成要求。所有插件开发对话、代码评审和阶段验收均以本规范为准。

ToolCenter 0.1.x 的 Page 和 Action 与主窗口运行在同一 WebView JavaScript 环境中；Widget 运行在宿主管理的共享 Widget Host WebView 中。当前依靠 `PluginContext`、静态校验、测试和代码评审控制边界，不具备运行不可信代码所需的强安全沙箱。因此：

- 只允许开发和加载项目内受信任的第一方插件；
- 不得加载来源不明的第三方插件；
- 在沙箱、签名和权限强制校验完成前，不得据此开放公共插件市场。

## 2. 规范用语和事实来源

本规范使用以下用语：

- 必须：强制要求，违反后不得合并或交付；
- 应该：默认执行，偏离时必须在插件 README 中记录原因；
- 可以：按插件需求选择。

插件契约和宿主能力的代码事实来源依次为：

1. `packages/plugin-contract/src/`；
2. `packages/plugin-runtime/src/`；
3. `apps/desktop/src/runtime/host.ts`；
4. `apps/desktop/src/services/widgets.ts` 和 `apps/desktop/src/components/WidgetHostSurface.tsx`；
5. `apps/desktop/src-tauri/src/services/` 和 `apps/desktop/src-tauri/src/commands/`；
6. `tooling/validate-plugin/src/index.ts`；
7. 本规范。

文档与代码不一致时，不得自行猜测。开发者应记录差异并先修正文档或实现，再继续插件开发。

## 3. 产品和开发模型

### 3.1 一个宿主，多个插件

ToolCenter 只有一个桌面应用。插件是宿主内部的懒加载模块，不是单独的软件。

```text
ToolCenter 桌面应用
├─ apps/desktop                 启动器界面和 Tauri 宿主
├─ packages/plugin-contract    插件公共契约
├─ packages/plugin-runtime     插件运行时
└─ plugins                     第一方内置插件
   ├─ plugin-a
   ├─ plugin-b
   └─ plugin-c
```

每个插件目录可以拥有自己的 `package.json`，该文件只用于 pnpm workspace 的依赖和构建隔离。插件不得生成独立应用、独立安装包或独立可执行文件。用户最终只运行 `toolcenter-desktop.exe`。

### 3.2 一个插件，一个开发对话

每个插件可以在单独的 Codex 对话中开发。所有对话必须打开同一个 ToolCenter 项目，并为插件分配唯一目录和唯一 ID。

插件对话默认可以修改：

- `plugins/<当前插件>/`；
- 由 `registry:generate` 自动更新的插件注册表；
- 当前插件直接相关的测试和说明文档。

没有得到用户明确批准时，不得修改：

- `apps/desktop` 中的启动器核心；
- `packages/plugin-contract` 和 `packages/plugin-runtime`；
- 其他插件；
- 根依赖、构建配置、Tauri 配置和发布配置。

如果缺少宿主能力，开发对话必须先报告所缺接口、建议修改位置、影响范围和风险。批准前不得用私有调用或临时旁路绕过宿主。

### 3.3 禁止独立应用化

插件不得：

- 新建 Tauri、Electron 或其他桌面应用；
- 新建插件专属主窗口、托盘程序或 `.exe`；
- 复制 ToolCenter 标题栏、侧栏、设置或运行时；
- 要求用户分别启动插件和 ToolCenter；
- 通过独立端口长期运行插件 Web 应用。

插件必须导出本规范定义的入口，由静态注册表和 Plugin Runtime 加载。

### 3.4 多对话并行规则

不同对话必须使用不同插件目录和不同插件 ID。需要同时写入同一项目时，必须使用独立 Git 分支或 worktree；没有版本控制隔离时，应顺序开发，避免注册表、锁文件和公共包发生冲突。

## 4. 当前宿主能力

### 4.1 可用服务

| `PluginContext` 服务 | 状态 | 使用说明 |
|---|---|---|
| `ui.notify` | 可用 | 显示 ToolCenter 界面内通知 |
| `ui.confirm` | 可用 | 显示统一确认对话框；危险操作设置 `dangerous: true` |
| `storage` | 可用 | 按插件 ID 隔离的 JSON 存储 |
| `scheduler` | 可用 | 共享调度器，最短周期 250 ms，自动纳入资源清理 |
| `events` | 可用 | 进程内事件总线，订阅自动纳入资源清理 |
| `system.getSummary` | 可用 | 返回平台、架构和宿主版本 |
| `permissions` | 可用 | 查询、请求和记录权限决定 |
| `logger` | 可用 | 写入 debug、info、warn、error 日志 |
| `audio` | 可用（Windows） | 枚举输入/输出设备、读取默认端点、原生订阅设备变化和切换默认端点；由 Rust 强制校验音频权限 |
| `display` | 可用（Windows） | 枚举活动显示器、读取 HDR 支持与开关状态、切换指定显示器 HDR；由 Rust 强制校验显示器权限 |

### 4.2 尚未开放的服务

以下接口已有类型定义，但当前调用会抛出“当前宿主版本不可用”错误：

- `database`；
- `clipboard`；
- `files`；
- `dialogs`；
- `notifications`（系统级通知）；
- `hotkeys`；
- `tasks`。

`commands` 只能调用宿主明确注册的命令。当前没有面向插件开放的命令处理器，不得将其作为插件必要依赖。

声明权限不会自动开放尚未实现的服务。

### 4.3 入口支持情况

| 入口 | 当前状态 | 本阶段要求 |
|---|---|---|
| Action | 已接入 | 适合一次性操作，可以作为核心入口 |
| Page | 已接入 | 适合完整交互工具，优先用于第一个插件 |
| Widget | 已接入 | 适合桌面常驻的快速查看和快速操作；复杂设置与错误恢复应同时提供 Page |
| Service | 契约预留 | 宿主尚无完整启动和控制入口，不得作为必要功能 |

### 4.4 已确认的运行边界

启动器本体已经完成发布构建和 Windows 独立应用验收。插件开发必须按以下边界判断测试结果：

| 能力 | 当前实现 | 插件开发结论 |
|---|---|---|
| Widget 多实例 | 每个实例具有稳定 `instanceId` 和独立运行时资源账本 | 不得使用模块全局变量保存实例专属状态 |
| Widget Host | 按“显示器 × 显示层级”共享透明 WebView，并由原生窗口区域控制点击穿透 | 不得自行创建窗口或假设一个实例对应一个 WebView |
| Widget 持久化 | 宿主保存尺寸、可见性、锁定状态、显示器、显示层级和归一化位置 | 插件只保存自身业务数据，不重复保存宿主布局数据 |
| 多显示器与 DPI | 宿主负责显示器识别、缩放更新、缺失显示器迁移和位置恢复 | 插件必须在容器内响应式布局，不读取屏幕坐标决定内容尺寸 |
| 音频读取 | Windows Core Audio 原生枚举、默认端点读取和通知回调已接入 | 插件只能通过 `PluginContext.audio` 使用，不得自行调用系统接口 |
| 音频控制 | 默认端点设置能力已隔离在 Rust 兼容层 | 首个使用该能力的插件仍须在目标 Windows 机器上完成真实切换验收 |
| HDR 显示器 | DisplayConfig 活动目标、HDR 状态和指定目标切换已接入 | 插件只能通过 `PluginContext.display` 使用，不得复用 Widget 显示器 ID 或直接调用 Windows API |
| 浏览器开发模式 | 使用内存桥；音频列表为空、默认设备为 `null`，Display 服务明确返回不可用，Widget 使用模拟主显示器 | 只能用于界面和纯逻辑开发，不能作为原生能力验收证据 |

当前宿主仍只允许受信任的第一方内置插件。发布构建通过只证明宿主和插件可以一起编译，不替代插件自己的真实设备、多实例和资源清理验收。

## 5. 插件创建和目录结构

### 5.1 创建命令

在项目根目录执行：

```powershell
corepack pnpm plugin:create
```

脚手架要求输入：

- 目录名：kebab-case，例如 `text-counter`；
- 插件 ID：例如 `toolcenter.text-counter`；
- 显示名称；
- 初始入口：`action`、`page`、`widget` 或 `service`。

可以按产品形态选择 `page`、`action` 或 `widget`。Widget 插件应该同时评估是否需要 Page 承载权限说明、完整设置和错误恢复。

### 5.2 标准目录

```text
plugins/<plugin-name>/
├─ src/
│  ├─ actions.ts          # 按需存在
│  ├─ pages.ts            # 按需存在
│  ├─ ExamplePage.tsx     # 按需存在
│  └─ styles.css          # 按需存在
├─ tests/
├─ plugin.manifest.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```

### 5.3 包要求

- 目录名必须使用 kebab-case；
- 包名必须以 `@tool-center/plugin-` 开头；
- 第一方插件必须设置 `"private": true`；
- TypeScript 必须继承 `../../tsconfig.base.json`；
- 插件不得提交 `node_modules`、`dist`、缓存、日志、密钥和用户数据；
- Page 或 Widget 插件必须使用与宿主兼容的 React 19，不得打包第二份 React。

Page/Widget 的 React 声明：

```json
{
  "peerDependencies": {
    "react": "^19.2.7"
  },
  "devDependencies": {
    "@types/react": "19.2.17",
    "react": "19.2.7"
  }
}
```

## 6. Manifest

### 6.1 基本结构

`plugin.manifest.ts` 是构建时读取的静态清单，必须默认导出 `definePlugin(...)`。

```ts
import { definePlugin } from "@tool-center/plugin-contract";

export default definePlugin({
  id: "toolcenter.text-counter",
  name: "文本统计",
  description: "统计文本的字符数、字数和行数。",
  version: "0.1.0",
  category: "productivity",
  minHostVersion: "0.1.0",
  entrypoints: {
    page: () => import("./src/pages"),
    actions: () => import("./src/actions"),
  },
  contributes: {
    pages: [{ id: "main", title: "文本统计", route: "/main" }],
    actions: [
      {
        id: "count-last-text",
        title: "统计上次文本",
        description: "读取插件保存的文本并重新统计。",
      },
    ],
  },
  permissions: [],
});
```

### 6.2 字段规则

| 字段 | 规则 |
|---|---|
| `id` | 全局唯一并永久稳定；使用小写字母、数字、点号或短横线分段 |
| `name` | 面向用户的简短名称 |
| `description` | 一句话说明功能，不写宣传语 |
| `version` | 语义化版本；当前不支持 `+build` 后缀 |
| `category` | 建议使用 `productivity`、`file`、`system`、`media`、`development`、`other` |
| `minHostVersion` | 插件要求的最低宿主版本，当前通常为 `0.1.0` |
| `entrypoints` | 必须使用动态 `import()` |
| `contributes` | 宿主在加载业务代码前读取的静态入口摘要 |
| `permissions` | 已去重的最小权限列表 |

插件 ID 会用于权限和存储命名空间。发布后不得修改；更换 ID 应按新插件处理，并单独设计数据迁移。

当前宿主只校验 `minHostVersion` 格式，尚未自动阻止不兼容插件加载。开发者仍须准确填写，并在 README 中记录兼容范围。

当插件同时提供 Page 和 Action 时，“全部工具”默认打开 `contributes.pages` 的第一项；没有 Page 时执行 `contributes.actions` 的第一项。数组顺序属于用户体验设计，不得依赖偶然排序。

### 6.3 静态清单限制

Manifest 顶层不得执行：

- `fetch`、`invoke` 或权限请求；
- `addEventListener`；
- `setTimeout`、`setInterval`；
- 文件读取、存储写入或其他副作用；
- 页面、动作和服务的同步导入。

`contributes` 声明必须与入口实现一致。插件内所有 contribution ID 必须唯一，标题和路由不得出现两套定义。

## 7. 入口实现

### 7.1 Action

Action 用于一次性操作。宿主在执行时加载入口，并在 `run()` 结束后停用和清理该入口。

```ts
import type { ActionsEntrypointModule } from "@tool-center/plugin-contract";

export const actions: ActionsEntrypointModule["actions"] = [
  {
    id: "count-last-text",
    title: "统计上次文本",
    async run(context, input) {
      // input 是 unknown，使用前必须验证。
      const text = (await context.storage.read<string>("last-text")) ?? "";
      const characters = [...text].length;
      await context.logger.info("Text counted", { characters });
      return {
        success: true,
        message: `共 ${characters} 个字符`,
        data: { characters },
      };
    },
  },
];
```

Action 必须：

- 返回 `ActionResult`；
- 校验所有外部输入；
- 对可预期的业务失败返回 `success: false` 和明确说明；
- 将长期状态写入 `context.storage`，不得依赖模块全局变量；
- 允许异常向宿主传播，由宿主记录失败并完成清理。

### 7.2 Page

Page 用于持续交互。进入插件路由时加载，离开页面时停用。

```ts
import type { PageEntrypointModule } from "@tool-center/plugin-contract";
import { lazy } from "react";

export const pages: PageEntrypointModule["pages"] = [
  {
    id: "main",
    route: "/main",
    title: "文本统计",
    component: lazy(() => import("./TextCounterPage")),
  },
];
```

页面组件必须默认导出，并接收 `PluginPageProps` 中的 `context`。

```tsx
import type { PluginPageProps } from "@tool-center/plugin-contract";
import { useState } from "react";

import "./styles.css";

export default function TextCounterPage({ context }: PluginPageProps) {
  const [text, setText] = useState("");

  return (
    <section className="plugin-text-counter">
      <h1>文本统计</h1>
      <label>
        文本
        <textarea value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <p aria-live="polite">字符数：{[...text].length}</p>
      <button
        type="button"
        onClick={() => void context.storage.write("last-text", text)}
      >
        保存
      </button>
    </section>
  );
}
```

Page 必须：

- 提供加载、空状态、成功和错误反馈；
- 在 React effect cleanup 中释放自行注册的资源；
- 避免在组件卸载后继续更新状态；
- 不得创建全局路由、独立窗口或第二套应用框架。

### 7.3 Widget

Widget 已接入桌面宿主，可以承载适合快速查看和快速操作的核心功能。复杂设置、权限说明、历史记录和错误恢复应该由 Page 承载。Widget 窗口、位置、层级和实例必须由 ToolCenter 管理，插件不得自行创建窗口。

当前公开类型固定为：

```ts
type WidgetSize = "small" | "medium" | "wide";
type WidgetDisplayMode = "desktop" | "always-on-top";

interface WidgetProps {
  readonly context: PluginContext;
  readonly widget: {
    readonly instanceId: string;
    readonly visible: boolean;
    readonly size: WidgetSize;
    readonly locked: boolean;
  };
}
```

`WidgetDisplayMode` 由宿主管理器使用，不会作为 `WidgetProps` 传入插件。显示器 ID、窗口坐标、像素尺寸和缩放系数同样属于宿主内部状态；插件不得依赖这些未公开字段。

Manifest 必须完整声明静态 Widget 摘要：

```ts
contributes: {
  widgets: [
    {
      id: "audio-switcher",
      title: "音频设备切换",
      supportedSizes: ["small", "medium", "wide"],
      defaultSize: "medium",
      defaultVisible: false,
      minimumSize: { width: 320, height: 180 },
    },
  ],
},
entrypoints: {
  widget: () => import("./src/widgets"),
},
```

Widget 入口定义必须与 Manifest 一致：

```ts
import type { WidgetEntrypointModule } from "@tool-center/plugin-contract";
import { lazy } from "react";

export const widgets: WidgetEntrypointModule["widgets"] = [
  {
    id: "audio-switcher",
    title: "音频设备切换",
    supportedSizes: ["small", "medium", "wide"],
    defaultSize: "medium",
    defaultVisible: false,
    minimumSize: { width: 320, height: 180 },
    component: lazy(() => import("./AudioSwitcherWidget")),
  },
];
```

组件接收稳定实例信息：

```tsx
import type { WidgetProps } from "@tool-center/plugin-contract";

export default function AudioSwitcherWidget({
  context,
  widget: { instanceId, size, visible, locked },
}: WidgetProps) {
  // 使用 instanceId 组成实例专属存储 key；不可见时暂停非必要刷新。
  return <section data-size={size} data-locked={locked}>{instanceId}</section>;
}
```

Widget 规则：

- `supportedSizes` 至少包含一项，并且必须包含 `defaultSize`；
- `minimumSize` 的宽高必须为正有限数；
- 同一个 Widget 可以创建多个实例，不得以 `pluginId + widgetId` 假设全局唯一；
- 实例专属配置应使用 `instanceId` 组成存储 key；
- 不得使用模块全局变量或单例保存实例专属业务状态，因为同一 WebView 中可能同时挂载多个实例；
- `visible=false` 时必须停止不必要的渲染、定时任务和设备订阅；
- 尺寸变化时必须在容器内自适应，不得修改宿主窗口；
- `minimumSize` 只声明安全渲染下限，不代表插件可以指定任意桌面窗口像素尺寸；实际布局仍以 `size` 和当前容器为准；
- 位置、显示器、尺寸、锁定、桌面层级和恢复逻辑由 Widget Manager 管理；
- 使用 portal 展开菜单或弹层时，弹层根元素必须添加 `data-toolcenter-widget-region`，以便共享宿主把该区域纳入原生点击区域；
- 单个 Widget 抛错只会进入该实例的错误边界，插件仍应在组件内处理可预期业务错误。

当前宿主按“每个显示器 × 显示层级”复用 Widget Host，同一组中的多个实例共享一个 WebView、React Root 和 Plugin Runtime，不会为每个实例创建 WebView。插件禁用时宿主隐藏其持久化实例并卸载运行资源；重新启用后恢复仍然有效的实例。

### 7.4 Windows 音频服务

`PluginContext.audio` 仅在 Windows 10/11 宿主中可用，接口如下：

```ts
context.audio.listDevices(kind?);
context.audio.getDefaultDevice(kind, role?);
context.audio.subscribeDeviceChanges(listener);
context.audio.setDefaultDevice(deviceId, roles?);
```

相关类型：

```ts
type AudioDeviceKind = "input" | "output";
type AudioDeviceState = "active" | "disabled" | "unplugged" | "not-present";
type AudioDefaultRole = "console" | "multimedia" | "communications";

interface AudioDeviceSummary {
  readonly id: string;
  readonly name: string;
  readonly kind: AudioDeviceKind;
  readonly state: AudioDeviceState;
  readonly defaultRoles: readonly AudioDefaultRole[];
}

type AudioDeviceChangeKind =
  | "added"
  | "removed"
  | "state-changed"
  | "default-changed"
  | "property-changed";

interface AudioDeviceChange {
  readonly kind: AudioDeviceChangeKind;
  readonly deviceId?: string;
  readonly deviceKind?: AudioDeviceKind;
  readonly state?: AudioDeviceState;
  readonly role?: AudioDefaultRole;
}
```

使用规则：

- 设备 ID 是不透明字符串，只能原样传回宿主，不得解析、拼接或持久依赖其内部格式；
- 枚举、读取默认设备和订阅变化需要 `audio.read`；
- 修改默认设备需要独立的 `audio.control`，Rust 命令层会再次校验；
- `getDefaultDevice()` 未指定角色时读取 `multimedia`；
- `setDefaultDevice()` 未指定角色或传入空列表时同时设置三个 Windows 默认角色；
- 设备变化使用 Windows 原生通知，不得自行轮询；
- 变化事件中的字段均可能缺省，事件只应作为“重新读取设备状态”的失效通知，不得把单次事件当作完整设备快照；
- `subscribeDeviceChanges()` 返回异步 `Release`，不再需要时应主动调用；入口卸载时资源账本也会兜底释放前端监听；
- 失效或拔出的单个设备不得导致整份设备列表失败。

React 组件订阅时必须处理“组件已经卸载，但异步订阅刚刚完成”的竞态：

```tsx
import type { Release } from "@tool-center/plugin-contract";
import { useEffect } from "react";

useEffect(() => {
  let disposed = false;
  let release: Release | undefined;

  void context.audio
    .subscribeDeviceChanges(() => {
      if (!disposed) void reloadDevices();
    })
    .then((nextRelease) => {
      if (disposed) {
        void nextRelease();
      } else {
        release = nextRelease;
      }
    })
    .catch((error: unknown) => {
      if (!disposed) reportRecoverableError(error);
    });

  return () => {
    disposed = true;
    void release?.();
  };
}, [context]);
```

示例中的 `reloadDevices()` 和 `reportRecoverableError()` 由插件实现。重新读取时必须考虑设备在通知到达后再次变化，不得假设原设备 ID 仍然有效。

Windows 没有公开且受支持的“修改系统默认音频端点”API。宿主将未公开的 `IPolicyConfig::SetDefaultEndpoint` 隔离在 Rust 兼容层中；插件只能调用公共 `audio.setDefaultDevice()`，不得依赖、复制或直接访问该接口。Windows 更新后如兼容层不可用，插件必须显示可恢复错误，不得回退到 PowerShell、外部 EXE 或第三方命令行工具。

### 7.5 Windows 显示器 HDR 服务

`PluginContext.display` 提供：

```ts
interface DisplaySummary {
  readonly id: string;
  readonly name: string;
  readonly sourceName: string;
  readonly primary: boolean;
  readonly hdrSupported: boolean;
  readonly hdrEnabled: boolean;
}

interface DisplayService {
  listDisplays(): Promise<readonly DisplaySummary[]>;
  setHdrEnabled(displayId: string, enabled: boolean): Promise<void>;
}
```

使用规则：

- 枚举活动显示器和读取 HDR 状态使用 `display.read`；
- 开启或关闭 HDR 单独使用 `display.control`，Rust 命令层会再次校验；
- `DisplaySummary.id` 是独立于 Widget Manager 显示器 ID 的不透明标识，只能原样回传；
- 写入前必须以最新列表确认用户选择，目标失效后不得自动控制另一台显示器；
- 写入完成后重新调用 `listDisplays()`，以真实 Windows 状态更新界面；
- 不把 Advanced Color、WCG 或自动颜色管理直接当成 HDR；
- 不使用 PowerShell、注册表、外部 EXE、快捷键模拟、插件内 Windows API 或原始 Rust command；
- 首版没有显示器变化订阅，不得创建常驻轮询；只在入口显示、用户手动刷新和切换完成后读取。

浏览器 Memory Host 不模拟 HDR 成功。真实切换可能短暂黑屏并改变系统设置，测试前必须提醒用户并获得单独确认。

### 7.6 Service

Service 必须满足：

- `defaultEnabled` 固定为 `false`；
- Manifest 中 `background.defaultEnabled` 固定为 `false`；
- 实现 `start()`、`stop()` 和 `status()`；
- `stop()` 可重复调用并立即停止资源；
- 模块导入时不得自动启动。

当前宿主尚无完整的用户启动入口，Service 不得成为本阶段插件的必要功能。

## 8. 生命周期和资源管理

入口模块可以导出 `lifecycle`：

```ts
import type { PluginLifecycle } from "@tool-center/plugin-contract";

export const lifecycle: PluginLifecycle = {
  async activate(context) {
    await context.logger.debug("Plugin entrypoint activated");
  },
  async deactivate() {
    // 停止业务活动。
  },
  async dispose() {
    // 释放插件自行管理的资源。
  },
};
```

宿主按以下顺序停用入口：

```text
deactivate
→ dispose
→ 清理 PluginContext 资源账本
→ 移除运行实例
```

资源规则：

- 重复任务必须使用 `context.scheduler.register()`，不得使用 `setInterval()`；
- 调度周期不得低于 250 ms；
- 调度回调连续失败 3 次后，宿主停止继续执行；
- 页面不可见时调度器默认暂停；确需隐藏运行时必须声明 `background.run`；
- Widget 的每个 `instanceId` 都是独立运行实例和独立资源账本；卸载一个实例不得释放其他实例的资源；
- Widget 隐藏时根据 `visible=false` 主动暂停非必要工作，删除、插件禁用或宿主关闭时必须完整卸载；
- 事件订阅使用 `context.events.subscribe()`，事件名必须带插件命名空间；
- 音频设备订阅使用 `context.audio.subscribeDeviceChanges()`，并在组件 effect cleanup 中调用返回的 `Release`；
- 单次 timer、AbortController、Observer 和 DOM 监听由插件自行释放；
- `deactivate()`、`dispose()` 和 Service 的 `stop()` 必须幂等。

事件命名示例：

```ts
const eventName = `${context.pluginId}:data-changed`;
```

## 9. 权限和安全

### 9.1 权限原则

- 只声明当前版本实际使用的权限；
- 在执行对应操作前请求权限，并写明具体用途；
- 用户拒绝后安全退出或降级，不得反复弹窗；
- 当前未开放的服务即使声明权限也不能调用；
- 高风险权限接入前必须单独完成安全评审；
- 权限记录不得被视为强安全沙箱。

音频权限必须分开申请：

- `audio.read`：读取音频输出、麦克风、默认端点并订阅设备变化；
- `audio.control`：修改 Windows 默认输出或默认麦克风；
- 只展示设备的 Widget 不得因为声明了 `audio.read` 就自动获得 `audio.control`；
- 权限处于 `prompt` 或 `denied` 时，Rust 受保护命令一律拒绝执行。

显示器权限同样必须分开申请：

- `display.read`：枚举活动显示器并读取名称、主显示器标记和 HDR 状态；
- `display.control`：开启或关闭指定显示器的 Windows HDR；
- 只读取状态的插件不得因为声明了 `display.read` 就自动获得 `display.control`；
- 显示器标识在每次写入前由 Rust 根据当前活动路径重新验证。

请求示例：

```ts
const decision = await context.permissions.request(
  "system.read-basic",
  "读取平台和系统架构，用于选择兼容的处理方式。",
);

if (decision !== "granted") {
  return { success: false, message: "未获得系统信息权限。" };
}
```

### 9.2 禁止事项

插件不得：

- 导入 `@tauri-apps/*` 或直接调用 Tauri 命令；
- 直接访问文件系统、系统进程或设备；
- 使用 `fetch` 绕过尚未开放的 `network.request`；
- 使用 `eval`、动态 `Function` 或执行未经验证的外部代码；
- 读取或记录密码、Token、Cookie、验证码和不必要的个人信息；
- 通过私有 API 绕过权限、存储或资源清理机制。

已知权限清单见附录 A。

## 10. 数据、日志和错误处理

### 10.1 存储

- 只能使用 `context.storage`；
- 值必须可 JSON 序列化；
- key 长度为 1～128，只能包含 ASCII 字母、数字、点号、短横线和下划线；
- key 应包含用途或结构版本，例如 `settings.v1`；
- 存储结构变更时必须提供迁移逻辑或启用新版本 key；
- 不得保存密钥、账号凭据或无关个人数据。

### 10.2 日志

- `debug`/`info` 记录正常流程；
- `warn` 记录可恢复异常；
- `error` 记录功能失败；
- `details` 只保留排查需要的结构化摘要；
- 用户可见说明放在 `ActionResult.message` 或 `ui.notify`；
- 不得把完整用户内容、文件正文和凭据写入日志。

### 10.3 错误处理

- 不得静默吞掉异常；
- 可恢复错误应给出恢复方法；
- 页面必须处理业务异步错误，不能只依赖宿主错误边界；
- 清理失败需要写入日志并允许宿主继续回收其余资源。

## 11. 界面规范

当前没有可供插件导入的公共 UI 组件包。插件不得导入 `apps/desktop` 内部组件，应使用语义化 HTML、作用域 CSS 和宿主 Design Tokens。

```css
.plugin-text-counter {
  display: grid;
  gap: var(--space-4);
  color: var(--color-text-primary);
}

.plugin-text-counter textarea {
  min-height: 160px;
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: inherit;
}
```

界面必须满足：

- 根 class 使用 `plugin-<目录名>` 前缀；
- 不使用全局 `*`、`html`、`body`、`:root`、`button`、`input` 选择器；
- 不覆盖宿主 Token、标题栏、侧栏、弹窗和其他插件样式；
- 颜色、间距、圆角和动效使用宿主 Token；
- 表单控件有可见 label，图标按钮有 `aria-label`；
- 状态不只依靠颜色表达；
- 键盘可以完成核心操作，焦点样式不得移除；
- 适配 960×640 及以上窗口，长内容允许纵向滚动；
- Widget 分别验证其声明的 `small`、`medium`、`wide` 尺寸，内容不得依赖主窗口宽度；
- Widget 展开菜单不得超出宿主声明的交互区域；portal 弹层按 7.3 节标记原生点击区域；
- 不用 Emoji、ASCII 字符或手绘 SVG 代替正式图标。公共图标包开放前使用清晰的文本按钮。

## 12. 依赖和代码边界

插件允许依赖：

- `@tool-center/plugin-contract`；
- React（Page/Widget）；
- 经评审同意、用途明确且体积合理的纯前端库。

插件不得：

- 导入 `apps/desktop` 内部源码；
- 导入其他插件的内部源码；
- 手动修改 `plugin-registry.generated.ts`；
- 复制 Plugin Runtime；
- 为简单功能引入大型框架或重复依赖。

跨插件公共代码应提取到 `packages/`，该操作属于宿主级变更，必须先获得批准。

## 13. 开发、集成和交付流程

### 13.1 开发流程

```text
明确需求和入口
→ 创建插件目录
→ 完成 Manifest 和权限声明
→ 实现功能、错误处理和资源释放
→ 补充测试和 README
→ 生成注册表
→ 执行自动门禁
→ 在 ToolCenter 桌面应用中验收
```

### 13.2 注册表集成

执行：

```powershell
corepack pnpm registry:generate
```

生成器扫描 `plugins/*/plugin.manifest.ts` 并更新启动器注册表。开发者不得手动编辑生成结果。当前没有独立插件安装器；插件随 ToolCenter 构建进入桌面应用。

### 13.3 直接使用正式插件中心开发

在项目根目录执行：

```powershell
.\toolcenter.cmd plugin-dev
```

命令只在当前进程中补全开发工具路径，然后按顺序执行插件规则校验、注册表生成并启动真实的 ToolCenter Tauri 桌面壳，不修改 Windows 系统 PATH。开发中的插件会以第一方内置插件身份直接出现在插件中心、搜索、页面或 Widget 入口中；不得为此另建浏览器演示站、独立 Tauri 应用或独立可执行文件。

这是与正式版相同源码、插件契约、Rust 权限层和共享 UI 的开发模式。已打包的 `正式版/ToolCenter.exe` 不支持热加载外部 TypeScript 源码；完成插件后必须重新构建，才能写入正式程序：

```powershell
.\toolcenter.cmd release-build
```

正式构建固定覆盖 `正式版/ToolCenter.exe`，不创建新的版本目录。历史回退依靠 Git 提交或标签。

### 13.4 README 交接要求

每个插件的 README 必须记录：

- 插件用途和不做什么；
- 插件 ID、版本、入口和兼容宿主；
- 权限及申请理由；
- 存储 key 和数据结构版本；
- 运行、测试和验收方法；
- 已知限制和待办事项；
- 本轮修改文件和测试结果。

README 是下一次插件开发对话的交接入口，开发完成后必须同步更新。

## 14. 测试和自动门禁

### 14.1 最低测试范围

插件至少需要：

- Manifest 加载和字段测试；
- 核心纯函数测试；
- Action 成功、业务失败和异常路径测试；
- Page 核心交互、空状态和错误状态测试；
- Widget 多实例、尺寸切换、隐藏、锁定、错误边界和卸载资源测试；
- 使用音频服务时的读取/控制权限拒绝、设备失效、事件取消订阅和切换失败测试；
- 使用显示器服务时的读取/控制权限拒绝、目标失效、HDR 不支持、状态不确定、拓扑变化和写入后状态核对测试；
- 使用持久化时的数据兼容或迁移测试；
- 使用调度器或事件时的资源释放测试。

浏览器或 Vitest 中的内存桥测试必须使用可控假数据验证界面和纯逻辑，不得把空设备列表、`null` 默认端点或模拟显示器视为 Windows 原生能力测试结果。

### 14.2 单插件检查

```powershell
corepack pnpm --filter @tool-center/plugin-<name> typecheck
corepack pnpm --filter @tool-center/plugin-<name> test
```

### 14.3 项目集成检查

```powershell
corepack pnpm registry:generate
corepack pnpm plugin:validate
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build:web
```

阶段验收或准备发布前还必须运行：

```powershell
corepack pnpm build
```

生成并覆盖唯一正式版时执行：

```powershell
.\toolcenter.cmd release-build
```

经过批准并新增 Rust 宿主能力时，还要运行：

```powershell
corepack pnpm rust:fmt
corepack pnpm rust:clippy
corepack pnpm rust:test
```

### 14.4 校验器覆盖范围

当前自动校验包括：

- 插件 ID 唯一性；
- 包名前缀和 `private`；
- contribution 与懒加载入口关系；
- contribution ID 和权限重复；
- 直接 Tauri 调用；
- 导入启动器或其他插件源码；
- `setInterval`；
- Manifest 顶层副作用；
- CSS 全局选择器和根 Token 覆盖。

校验器没有覆盖的条款仍须通过代码评审确认。

## 15. 验收和完成定义

插件必须同时满足以下条件：

1. 插件管理页面正确显示名称、版本、描述、权限和 contribution；
2. 插件可以启用、禁用和重新加载；
3. Action 或 Page 可以从“全部工具”和全局搜索打开；
4. 页面离开、插件停用和异常后没有残留资源；
5. 权限拒绝后功能可以安全退出或降级；
6. 960×640 窗口下没有横向溢出、遮挡和不可操作控件；
7. 控制台没有未处理错误，诊断页没有持续失败实例；
8. Manifest、实现、测试和 README 内容一致；
9. 自动门禁和完整桌面构建通过；
10. 已在 ToolCenter 独立桌面应用中完成实际操作验收；
11. 交付内容不含密钥、Token、个人路径和用户隐私数据；
12. 依赖未来宿主能力的内容已记录，且不影响当前核心功能。

Widget 插件还必须在 ToolCenter 独立桌面应用中验证：多个实例可独立创建和删除；每个实例的业务数据互不串扰；位置与显示状态可恢复；插件禁用后没有残留宿主内容；所有已声明尺寸均可操作；锁定后不会误拖动；桌面透明空白区域不会大范围阻挡点击；portal 菜单和弹层仍可点击。

涉及音频硬件时，还必须在目标 Windows 机器上验证：输入与输出设备枚举；当前默认端点；`audio.read` 和 `audio.control` 分别被拒绝时的降级行为；所需默认角色的真实切换；USB、蓝牙或其他目标设备的插拔事件；当前设备在操作期间失效时的恢复路径。真实切换测试会改变系统设置，执行前必须提醒用户并获得确认；不得只以浏览器测试、COM 对象创建成功或接口调用未抛错代替。

涉及显示器 HDR 时，还必须在目标 Windows 机器上验证：单屏和多屏枚举；同型号显示器区分；HDR 与非 HDR 混合；`display.read` 和 `display.control` 权限拒绝；指定目标开启和关闭；其他显示器不受影响；结果与 Windows HDR 设置一致；拔出目标、拓扑变化、远程会话和驱动拒绝。真实 HDR 切换执行前必须再次获得用户确认；不得以浏览器模拟或只读枚举代替。

以上条件全部通过后，插件才可以标记为完成。

## 16. 规范变更

以下改动需要同步更新本规范并记录新版本：

- Plugin Contract 字段、入口或生命周期变化；
- `PluginContext` 服务增加、删除或行为变化；
- 权限名称或强制校验方式变化；
- 插件目录、注册表或构建流程变化；
- 公共 UI Kit、图标包或样式边界变化；
- 第三方插件安全模型变化。

普通插件功能变化只更新插件 README，不修改全局规范。

## 附录 A：已知权限

| 类别 | 权限 |
|---|---|
| 剪贴板 | `clipboard.read`、`clipboard.write` |
| 文件 | `files.select`、`files.read-selected`、`files.write-selected`、`files.read-directory`、`files.write-directory` |
| 音频 | `audio.read`、`audio.control` |
| 显示器 | `display.read`、`display.control` |
| 系统 | `system.read-basic`、`system.monitor`、`system.process-read`、`system.process-control` |
| 网络和通知 | `network.request`、`notifications.show` |
| 后台和窗口 | `hotkeys.register`、`background.run`、`window.detached` |
| 外部操作 | `shell.open-safe`、`administrator.request` |

`administrator.request`、进程控制和目录级读写属于高风险权限。接入这些能力前，必须进行单独安全评审。

## 附录 B：新插件对话启动模板

复制以下内容到新对话并替换尖括号部分：

```text
你正在 ToolCenter 项目根目录中开发一个第一方内置插件。

插件名称：<显示名称>
插件目录：plugins/<kebab-case-name>
插件 ID：toolcenter.<stable-id>
插件目标：<一句话说明功能>

开始前阅读：
1. AGENTS.md
2. docs/ToolCenter插件开发规范_v1.0.md
3. packages/plugin-contract/src/
4. 当前插件 README 和 Manifest（如果已经存在）

本次只开发这个插件。插件不是独立应用，不得创建新的 Tauri、Electron、独立窗口、独立 exe、托盘程序或重复启动器。插件必须通过 @tool-center/plugin-contract 和 PluginContext 接入，并随现有 ToolCenter 构建。

默认只修改 plugins/<kebab-case-name>/ 和由 registry:generate 自动更新的注册表。如果必须修改启动器核心、Plugin Contract、Plugin Runtime、根依赖或构建配置，先说明原因、范围、风险和回滚方式，等待确认后再修改。

先检查环境和现有项目结构，给出简短实施计划，再开始开发。开发联调统一运行 .\toolcenter.cmd plugin-dev，使插件直接进入真实 ToolCenter 插件中心。完成后运行插件校验、类型检查、测试和构建，并在 ToolCenter 独立桌面应用中验收。同步更新插件 README，记录权限、存储、运行方法、测试结果和已知限制。
```

## 附录 C：插件提交检查清单

```text
[ ] 插件目录、包名和 ID 符合命名规则
[ ] 插件没有独立应用、窗口或可执行文件
[ ] Manifest 无副作用，entrypoints 使用动态 import()
[ ] contributes 与实际入口一致且 ID 不重复
[ ] 只声明当前使用的权限
[ ] 未使用尚未开放的宿主服务
[ ] 没有直接 Tauri、文件系统、网络或其他越界调用
[ ] Action/Page/Widget 的失败、空状态和权限拒绝路径已处理
[ ] Widget 多实例、尺寸、隐藏、锁定、位置恢复和卸载清理已验证（如适用）
[ ] 音频读取与控制权限、默认角色和设备变化订阅已验证（如适用）
[ ] HDR 显示器权限、不透明目标、状态区分和写入后核对已验证（如适用）
[ ] 调度器、事件、timer 和监听器可以完整释放
[ ] CSS 有插件作用域，界面适配 960×640
[ ] README 已记录入口、权限、存储、测试和限制
[ ] plugin:validate、typecheck、lint、test、build 均通过
[ ] 已在 ToolCenter 桌面应用中完成验收
[ ] 不含密钥、Token、个人路径和用户隐私数据
```
