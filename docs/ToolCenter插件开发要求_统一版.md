# ToolCenter 插件开发规范（统一正式版）

## 文档信息

| 项目 | 内容 |
|---|---|
| 文档编号 | TC-PLUGIN-UNIFIED-001 |
| 版本 | 2.1 |
| 状态 | 当前唯一正式插件开发规范 |
| 更新日期 | 2026-08-12 |
| 适用宿主 | ToolCenter 0.1.0 及后续兼容版本 |
| 适用范围 | 随 ToolCenter 源码构建的受信任第一方插件 |
| 开发模式 | 一个 ToolCenter 宿主、一个插件一个开发对话 |
| 维护位置 | `docs/ToolCenter插件开发要求_统一版.md` |

本文件汇总此前已经确定的全部插件开发要求，包括原始架构规范、独立对话开发模式、正式插件中心接入流程、Widget Host、Windows 音频、HDR 和受限本机代理能力、视觉交接 v1.0.2、性能与资源预算、测试门禁、GitHub 推送、正式版构建和公开仓库安全规则。

本文件是当前唯一主规范。以下文件保留为历史依据、专项说明或可复制提示词；内容冲突时以本文件和当前代码为准：

- `docs/ToolCenter插件开发规范_v1.0.md`
- `docs/ToolCenter插件GitHub推送规则.md`
- `docs/ToolCenter插件直接接入正式插件中心_对话提示词.md`
- `docs/ToolCenter_HDR显示器宿主能力需求.md`
- `ToolCenter-视觉交接-v1.0.2/`

### 修订记录

| 版本 | 日期 | 说明 |
|---|---|---|
| 1.0 | 2026-07-24 | 汇总插件结构、入口、权限、Widget、音频、HDR、测试和正式版接入要求 |
| 2.0 | 2026-07-26 | 合并全部既有要求，补充视觉 v1.0.2、性能预算、GitHub 完整流程、插件发布边界和当前实现事实 |
| 2.1 | 2026-08-12 | 新增受限本机代理客户端服务、`proxy.read` / `proxy.control` 权限及系统代理安全边界 |

当文档与实现不一致时，事实来源优先级为：

1. `packages/plugin-contract/src/`
2. `packages/plugin-runtime/src/`
3. `apps/desktop/src/runtime/host.ts`
4. `apps/desktop/src/services/` 与 Widget Host 实现
5. `apps/desktop/src-tauri/src/services/` 与 `commands/`
6. `tooling/validate-plugin/src/index.ts`
7. `apps/desktop/src/styles/tokens.css` 与当前可用共享组件
8. `ToolCenter-视觉交接-v1.0.2/` 中的 Token、SVG、组件和 Widget 说明
9. 本文件

不得根据过期文档猜测接口。发现差异后，应先记录并修正文档或实现。

## 1. 核心原则

所有插件开发必须遵守以下原则：

1. ToolCenter 只有一个桌面应用，插件不是独立软件。
2. 插件必须位于 `plugins/<plugin-name>/`。
3. 插件只能通过 `@tool-center/plugin-contract` 和 `PluginContext` 使用宿主能力。
4. Page、Widget、Action 和 Service 必须按入口懒加载。
5. 插件权限采用最小声明，前端提示后仍须由 Rust 再次验证。
6. 插件异常不得导致 ToolCenter 退出。
7. 所有订阅、任务、监听和资源必须能够完整释放。
8. 插件必须使用 ToolCenter 的共享 UI Kit、Design Tokens 和视觉规范。
9. 开发和验收必须进入真实 ToolCenter Tauri 桌面应用。
10. 正式程序只包含随源码构建并通过校验的受信任第一方插件。
11. 未打开的插件不得执行入口业务代码，复杂依赖必须继续二次懒加载。
12. 插件不得新增独立 WebView、隐藏窗口、后台进程或重复系统监听。
13. 一个插件由一个负责对话开发和发布；其他对话不得代替它擅自提交或发布。
14. 高风险系统写入、GitHub 推送、正式构建和 Release 都必须在执行前单独获得用户确认。
15. 先完成当前版本的核心可用功能，未来能力只保留必要接口，不提前堆叠实现。

当前运行模型不具备执行未知第三方代码所需的强安全沙箱，因此不得加载来源不明的插件，也不得据此开放公共插件市场。

## 2. 开发环境与开始前检查

### 2.1 基础环境

- Windows 10/11 x64
- Node.js 24 LTS
- pnpm 11
- Rust stable MSVC
- Microsoft Visual C++ Build Tools
- Windows SDK
- Microsoft Edge WebView2 Runtime

### 2.2 开始前必须阅读

1. `AGENTS.md`
2. `README.md`
3. 本文件
4. `packages/plugin-contract/src/`
5. `packages/plugin-runtime/src/`
6. `plugins/` 中已有插件
7. 当前插件的 Manifest、README 和测试（如果已经存在）
8. `ToolCenter-视觉交接-v1.0.2/DEVELOPER-HANDOFF.md`
9. 与当前入口有关的 Token、图标、Page 或 Widget 专项说明

### 2.3 开始前必须检查

- Node.js、pnpm、Cargo 和 Rust 版本
- 当前 Git 分支和工作区状态
- 插件目录名、包名和插件 ID 是否唯一
- 目标功能需要的入口、权限和宿主能力
- 当前宿主是否已经开放所需能力
- 是否会修改启动器核心或公共契约
- 是否存在其他对话正在修改相同文件
- 当前插件是否已有负责开发、提交或发布的对话
- 是否涉及真实 Windows 设置写入、管理员权限、外部文件或个人数据
- 视觉资源、第三方许可证和正式图标是否齐全

开发对话开始时先报告：

- 环境是否满足要求
- 准备修改的文件
- 入口和权限
- 是否需要宿主级变更
- 简短实施计划

环境和范围确认后，应直接推进插件功能，不要只停留在计划阶段。

环境检查不得擅自修改 Windows 系统 PATH、安装软件或升级全局工具。发现缺失依赖时，先说明影响、安装范围、风险和回滚方法，再等待用户确认。

## 3. 项目模型与修改范围

### 3.1 一个宿主，多个插件

```text
ToolCenter
├─ apps/desktop
├─ packages/plugin-contract
├─ packages/plugin-runtime
└─ plugins
   ├─ plugin-a
   └─ plugin-b
```

插件的 `package.json` 只用于 workspace 依赖、类型检查和测试隔离，不代表插件是独立应用。

Page 与 Action 运行在 ToolCenter 主窗口的主 WebView 中；Widget 运行在宿主按“显示器 × 显示层级”复用的共享透明 Widget Host 中。插件不得为单个入口新增 WebView，也不得假设一个 Widget 实例对应一个窗口。

### 3.2 默认允许修改

- `plugins/<当前插件>/`
- 当前插件直接相关的测试
- 当前插件 README
- 由 `registry:generate` 自动更新的注册表

### 3.3 必须先说明并获得确认的修改

- `apps/desktop/`
- `apps/desktop/src-tauri/`
- `packages/plugin-contract/`
- `packages/plugin-runtime/`
- 根 `package.json`、`Cargo.toml`、锁文件和构建配置
- 公共权限、UI Kit、Design Tokens
- 其他插件
- 正式版程序
- Git 提交、推送、Release 或仓库设置

说明必须包含原因、文件范围、对现有插件的影响、风险和回滚方法。

### 3.4 明确禁止

- 创建独立 Tauri、Electron 或其他桌面应用
- 创建插件专属主窗口、托盘程序、EXE 或安装包
- 复制 ToolCenter 标题栏、侧栏、设置或运行时
- 要求用户分别启动插件和 ToolCenter
- 长期运行独立浏览器开发站点
- 直接导入 `@tauri-apps/*`
- 直接导入 `apps/desktop` 内部源码
- 直接调用原始 Rust command
- 导入其他插件的内部源码
- 手动修改 `plugin-registry.generated.ts`
- 动态加载项目外的未知源码
- 用临时旁路绕过缺失的宿主能力

### 3.5 多对话并行

不同插件必须使用不同目录和不同 ID。多个对话需要同时写入项目时，应使用独立 Git 分支或 worktree；没有隔离时应顺序开发，避免注册表、锁文件和公共包冲突。

一个插件只指定一个负责对话。该对话负责插件目录、测试、README、分支、PR 和后续插件发布；启动器对话只负责经确认的通用宿主能力与 ToolCenter 本体发布。若两个对话都需要修改公共契约、注册表或锁文件，必须先协调提交顺序，不能互相覆盖未提交改动。

## 4. 插件目录与包要求

### 4.1 创建插件

在项目根目录运行：

```powershell
corepack pnpm plugin:create
```

### 4.2 推荐目录

```text
plugins/<plugin-name>/
├─ src/
│  ├─ actions.ts
│  ├─ pages.ts
│  ├─ widgets.ts
│  ├─ services.ts
│  ├─ components/
│  ├─ hooks/
│  ├─ assets/
│  └─ styles.css
├─ tests/
├─ plugin.manifest.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```

只保留当前插件实际需要的入口文件。

Action、Page、Widget 和 Service 可以组合成 Hybrid 插件，但各入口必须独立导出和独立分包。插件不得在自身目录建立 Tauri/Rust 应用或插件专属原生后端；确需新的 Windows 能力时，应把最小、通用、可复用的服务加入宿主 Rust 层，并先获得用户确认。

### 4.3 命名与依赖

- 目录名必须使用 kebab-case。
- 包名必须以 `@tool-center/plugin-` 开头。
- 插件 ID 建议使用 `toolcenter.<stable-id>`。
- 第一方插件必须设置 `"private": true`。
- TypeScript 继承 `../../tsconfig.base.json`。
- Page/Widget 使用与宿主兼容的 React 19，不得打包第二份 React。
- 不得提交 `node_modules`、`dist`、缓存、日志、运行数据或密钥。
- 不得为简单功能引入大型框架或重复宿主依赖。
- 不得把宿主已有依赖再次打包进插件；新增依赖前检查体积、许可证、维护状态和替代方案。
- Action 不需要界面时不得引入 React。
- Page 和 Widget 的大型编辑器、图表、媒体处理器或语法引擎必须在插件入口内部继续懒加载。

## 5. Manifest 要求

`plugin.manifest.ts` 必须默认导出 `definePlugin(...)`，并保持静态、无副作用。

必须包含：

- 全局唯一且永久稳定的 `id`
- 用户可读的 `name`
- 一句话 `description`
- 语义化 `version`
- `category`
- 可选的共享图标 ID `icon`
- `minHostVersion`
- 动态加载的 `entrypoints`
- 与实现一致的 `contributes`
- 去重后的最小 `permissions`

规则：

- ID 只使用小写字母、数字、点号和短横线分段。
- ID 发布后不得更改；更换 ID 按新插件处理。
- 当前版本号不使用 `+build` 后缀。
- `version` 和 `minHostVersion` 必须是语义化版本。
- 每个 contribution ID 在插件内唯一。
- `entrypoints` 必须使用动态 `import()`。
- `contributes` 与入口导出的 ID、标题、路由及 Widget 信息一致。
- Page、Widget、Action 入口必须独立分包，不得相互强制加载。
- Manifest 顶层不得调用网络、权限、存储、事件、定时器、文件或系统能力。
- 声明权限不会自动开放宿主尚未实现的服务。
- 如声明 `background`，`defaultEnabled` 必须固定为 `false`。
- 图标只能使用宿主认可的共享图标 ID，或插件目录内经过许可证确认的静态 SVG。
- 当前宿主只校验 `minHostVersion` 格式，尚未自动阻止所有不兼容插件加载；开发者仍须准确填写，并在 README 中记录兼容范围。

当插件同时提供多个入口时，数组顺序属于用户体验设计。宿主通常优先打开第一项 Page，没有 Page 时执行第一项 Action。

## 6. 入口要求

| 入口 | 适用场景 | 当前状态 | 核心边界 |
|---|---|---|---|
| Action | 一次性快捷操作 | 已接入 | 调用时加载，结束后不留资源 |
| Page | 完整流程、设置、历史与恢复 | 已接入 | 位于主窗口内容区，离开后默认卸载 |
| Widget | 桌面摘要与快速操作 | 已接入 | 由共享 Widget Host 管理，不自行创建窗口 |
| Service | 持续监听或后台任务 | 契约预留 | 当前不能作为插件必要功能，默认关闭 |
| Hybrid | 组合上述入口 | 已支持组合 | 各入口独立分包，打开一个入口不得强制加载其他入口 |

入口选择以最小形态为原则：能用 Action 完成的功能不强制建立 Page；Widget 只放摘要和快捷操作；复杂设置、权限解释、历史记录和完整错误恢复放在 Page；持续监听优先复用宿主事件或通用 Rust 服务。

### 6.1 Action

适合一次性操作。

必须：

- 校验所有 `unknown` 外部输入
- 返回 `ActionResult`
- 可预期失败返回 `success: false` 和明确说明
- 长期状态写入 `context.storage`
- 不使用模块全局变量保存业务状态
- 执行结束后允许宿主完整停用和清理
- 超过 100 ms 的工作异步执行，不阻塞界面线程
- 超过约 500 ms 的可感知工作提供忙碌、进度或任务状态
- 文件、图像、媒体或 CPU 密集型工作不能放在 React 渲染线程
- 高风险操作先使用统一确认界面；系统写入测试还需获得用户单独确认

### 6.2 Page

适合完整交互、设置、历史记录和错误恢复。

必须：

- 通过入口模块导出 Page 定义
- 页面组件默认导出并接收 `PluginPageProps`
- 提供加载、空状态、成功、错误和恢复路径
- 在 effect cleanup 中释放自行注册的资源
- 避免组件卸载后继续更新状态
- 不创建全局路由、独立窗口或第二套应用框架
- 页面离开后默认卸载，不永久缓存大量 DOM
- 页面内大型编辑器、图表、媒体预览和处理器再次懒加载
- 超过 100 项的长列表优先使用虚拟化、分页或增量加载
- 重型计算转移到经批准的宿主任务或按需 Worker，任务结束后释放
- 未保存的重要内容提供离开保护
- 页面最多保留一个主要滚动容器，避免嵌套滚动和横向溢出

### 6.3 Widget

适合桌面快速查看和快速操作。复杂设置、权限说明和错误恢复应该同时提供 Page。

必须：

- 支持尺寸使用 `small`、`medium`、`wide`
- `supportedSizes` 至少包含一项
- `defaultSize` 必须属于 `supportedSizes`
- `minimumSize` 宽高必须为正有限数
- 每个实例使用稳定 `instanceId`
- 实例专属存储 key 包含 `instanceId`
- 不使用模块全局变量保存实例状态
- `visible=false` 时暂停非必要渲染、调度和订阅
- `locked=true` 时避免误拖动和误操作
- 在容器内响应式布局，不修改宿主窗口
- 不自行保存位置、显示器、尺寸、锁定和层级
- 不假设一个 Widget 实例对应一个 WebView
- portal 菜单或弹层根元素添加 `data-toolcenter-widget-region`
- 单实例异常不得影响其他 Widget 或启动器
- 不可见时停止 `requestAnimationFrame`、动画和非必要设备订阅
- 优先使用宿主事件，不得用轮询替代已有音频或系统通知
- Widget 只显示摘要和快捷操作，大型图表、完整列表和复杂设置跳转 Page

位置、显示器、尺寸、锁定、桌面层级和恢复由 Widget Manager 管理。Widget Host 按“显示器 × 显示层级”复用透明 WebView。

正式视觉尺寸固定为：

| 尺寸 | 逻辑尺寸 | 内容安全区 |
|---|---:|---|
| `small` | 260×160 | `x=16..244`、`y=40..144` |
| `medium` | 360×220 | `x=16..344`、`y=40..204` |
| `wide` | 520×220 | `x=16..504`、`y=40..204` |

Widget 标题和拖动区固定为 40 px；标题区左右内边距 12 px，正文左右内边距 16 px，正文顶部间距 12 px，底部安全间距 16 px。拖动只能从标题区发起，不能与正文按钮、列表或菜单冲突。

每档尺寸至少处理以下 13 种状态：`default`、`hover`、`locked`、`unlocked`、`dragging`、`loading`、`empty`、`permission`、`error`、`unavailable`、`menu`、`desktop-layer`、`always-on-top`。

- `default` 与 `unlocked` 可以共用视觉实现，但语义必须区分。
- `locked` 状态固定显示锁定标识和可操作的“解锁”按钮，隐藏拖动手柄和更多菜单。
- “解锁”按钮必须支持 Hover 和键盘 Focus，锁图标本身不能作为唯一点击区。
- Menu、Tooltip 和弹层可以超出 Widget 逻辑边界，阴影最多外扩 24 px；弹层限制在当前显示器工作区内，并与屏幕边缘至少保留 12 px。
- `desktop-layer` 与 `always-on-top` 不能只用颜色区分，必须同时使用文字、图标、边框或菜单选中状态。

### 6.4 Service

当前 Service 仍属于契约预留能力，不得作为当前插件不可替代的核心功能。

如经批准使用：

- `defaultEnabled` 必须为 `false`
- `start()`、`stop()` 和 `status()` 行为明确
- `stop()` 必须幂等
- 不创建重复常驻线程或隐藏窗口
- 后台运行必须声明对应权限并提供关闭入口
- 不允许用隐藏 Page、隐藏 Widget 或前端常驻页面冒充后台服务
- 同类系统监听必须复用宿主公共服务，不允许每个插件建立一套轮询或原生监听
- 停止后不得残留线程、句柄、订阅、快捷键、任务或运行状态

## 7. 当前宿主能力

### 7.1 已开放

| 服务 | 用途 |
|---|---|
| `ui.notify` | ToolCenter 内通知 |
| `ui.confirm` | 统一确认对话框 |
| `storage` | 插件 ID 隔离的 JSON 存储 |
| `scheduler` | 共享周期调度 |
| `events` | 进程内事件总线 |
| `system.getSummary` | 平台、架构和宿主版本 |
| `permissions` | 权限状态、申请和记录 |
| `logger` | debug、info、warn、error 日志 |
| `audio` | Windows 音频设备读取、订阅和默认端点切换 |
| `display` | Windows 活动显示器读取、HDR 状态和指定显示器 HDR 切换 |
| `credentials` | 按插件隔离的 Windows 安全凭据写入、存在性检查和删除；不提供明文读取 |
| `network` | 受 `network.request` 保护的只读 HTTPS JSON 请求，可由 Rust 注入安全凭据 |
| `proxyClient` | 固定访问 FlClash ToolCenter 定制版的本机 `127.0.0.1:19090`，读取代理组、切换组内节点，并通过专用快捷键控制 FlClash 主代理开关 |

### 7.2 尚未开放

以下类型可能已存在，但当前宿主不可用，不得作为插件必要依赖：

- `database`
- `clipboard`
- `files`
- `dialogs`
- 系统级 `notifications`
- `hotkeys`
- `tasks`
- 未注册的 `commands`

需要这些能力时，先提出宿主扩展方案并等待确认，不得绕过 Plugin Context。

## 8. 权限与安全

### 8.1 权限流程

```text
说明用途
→ 查询权限状态
→ 用户决定
→ 通过 PluginContext 调用
→ Rust 再次验证
→ 成功或安全降级
```

必须：

- 只声明当前功能真正使用的权限
- 在调用前说明用途
- 正确处理 `prompt`、`granted`、`denied`
- 权限拒绝后显示可恢复状态
- 用户拒绝后不循环或反复弹窗，重新申请必须由明确用户操作触发
- 高风险能力在 Rust 层再次校验
- 不把前端状态或本地记录当作安全边界
- 危险确认使用 `ui.confirm({ dangerous: true })`，但确认对话不能代替 Rust 权限校验

禁止：

- 直接文件系统、网络、进程或系统调用
- 拼接任意命令传给宿主
- 使用 PowerShell、外部 EXE 或命令行工具绕过宿主
- 在日志、存储或错误信息中写入凭据和隐私数据
- 申请与功能无关的宽泛权限

### 8.2 已知权限

| 类别 | 权限 |
|---|---|
| 剪贴板 | `clipboard.read`、`clipboard.write` |
| 文件 | `files.select`、`files.read-selected`、`files.write-selected`、`files.read-directory`、`files.write-directory` |
| 音频 | `audio.read`、`audio.control` |
| 显示器 | `display.read`、`display.control` |
| 系统 | `system.read-basic`、`system.monitor`、`system.process-read`、`system.process-control` |
| 网络和通知 | `network.request`、`notifications.show` |
| 本机代理 | `proxy.read`、`proxy.control` |
| 后台和窗口 | `hotkeys.register`、`background.run`、`window.detached` |
| 外部操作 | `shell.open-safe`、`administrator.request` |

权限出现在类型中不代表对应服务已经实现。

### 8.3 网络与安全凭据

使用 `PluginContext.network` 和 `PluginContext.credentials` 时必须：

- 网络读取声明并申请 `network.request`，Rust 命令层会再次验证
- 只调用 `network.getJson()`，不得直接使用 `fetch` 或绕过宿主
- API Key、Token 等只通过 `credentials.set()` 写入，插件前端不得持久化或记录明文
- 插件只能用 `credentials.has()` 检查存在性，用 `credentials.remove()` 删除，不存在明文回读接口
- 网络请求只传逻辑 `credentialKey`，由 Rust 在发送时注入授权头
- 正确处理凭据不存在、权限拒绝、超时、非成功 HTTP 状态、响应过大和无效 JSON
- 不把凭据放入 URL、查询参数、错误信息、通知、日志、测试夹具或 Git 文件
- 浏览器 Memory Host 不执行真实网络请求；端到端数据验收必须使用真实 ToolCenter Tauri 桌面壳

### 8.4 受限本机代理客户端

使用 `PluginContext.proxyClient` 时必须：

- 状态、版本、端口、代理组和当前节点读取使用 `proxy.read`
- 节点选择和 FlClash 主代理开关单独使用 `proxy.control`
- 插件不得传入、保存或拼接控制器地址；宿主固定只访问 FlClash ToolCenter 定制版的 `http://127.0.0.1:19090`
- 不得把 `proxyClient` 当作通用本机 HTTP、任意 Mihomo 控制器或远程代理管理能力
- 切换节点前重新读取代理组，并验证目标是可见 `Selector` 组且节点属于该组
- 节点写入后重新读取代理组，主开关操作后重新读取 TCP 监听状态，不能把请求或快捷键发送成功当作状态成功
- 主开关只允许发送固定 `Ctrl+Alt+Shift+F12`，界面必须提示用户在 FlClash 的全局快捷键中将“启动”绑定为同一组合键
- 快捷键发送失败、FlClash 权限级别更高或监听状态未改变时必须返回可恢复错误，不得伪报成功
- 不得读取或修改 Windows 系统代理；主开关必须明确描述为 FlClash 代理的“启动/停止”
- 不读取、修改或导出 FlClash 配置文件、订阅、控制密钥、账号或其他隐私数据
- 不自动开启 FlClash 外部控制；连接不可用时提供明确的人工开启说明
- 周期刷新必须使用共享 Scheduler，入口隐藏或卸载时释放；不得自行创建 `setInterval`
- 浏览器 Memory Host 只返回不可用状态，不模拟真实节点或 FlClash 主开关切换成功

真实 FlClash 主开关切换会影响当前网络流量。产品界面中由用户主动点击并授予 `proxy.control` 后可以执行；Codex 或自动化进行写入验收前，仍须记录原状态、说明影响并获得用户单独确认，完成后恢复原状态。自动化单元测试不得发送真实快捷键。

## 9. Windows 系统设备插件要求

### 9.1 音频

使用 `PluginContext.audio` 时必须：

- 枚举、读取默认设备和订阅变化使用 `audio.read`
- 修改默认设备单独使用 `audio.control`
- 同时正确处理 `input` 和 `output`，只实现其中一种时在 README 明确范围
- 把设备 ID 视为不透明字符串
- 不解析、拼接或依赖设备 ID 内部格式
- 使用原生设备变化通知，不自行轮询
- 收到变化事件后重新读取状态，不把事件当完整快照
- 释放 `subscribeDeviceChanges()` 返回的 `Release`
- 处理“组件已卸载、异步订阅刚完成”的竞态
- 处理设备在操作期间断开或失效
- 单个设备失效不能导致整份设备列表失败
- 变化事件字段可能缺省，只能作为重新读取状态的失效通知
- Windows 兼容层失败时显示可恢复错误
- 不回退到 PowerShell、外部 EXE、第三方命令行或插件内 Windows API

默认角色包括：

- `console`
- `multimedia`
- `communications`

`getDefaultDevice()` 未指定角色时读取 `multimedia`。`setDefaultDevice()` 未指定角色或传入空角色列表时，宿主会同时设置三个角色。

产品界面中，用户主动选择设备并已授予 `audio.control` 后可以立即切换，不要求重复弹确认框；但 Codex 或自动化执行真实切换测试会改变系统设置，测试前仍必须提醒用户、记录原状态并获得单独确认。

音频枚举、切换、设置和界面业务必须留在音频插件中；启动器公共层只提供通用 Audio Service、权限和共享状态组件。

浏览器、Vitest 或 COM 对象创建成功不能代替真实 Windows 音频切换验收。

### 9.2 显示器 HDR

使用 `PluginContext.display` 时必须：

- 枚举活动显示器和读取 HDR 状态使用 `display.read`
- 开启或关闭 HDR 单独使用 `display.control`
- 把 `DisplaySummary.id` 视为宿主管理的不透明字符串，不解析、拼接或推断其格式
- 操作前重新获取列表并确认用户选择，不能把失效目标自动替换成另一台显示器
- 使用 `sourceName` 或宿主展示名称帮助用户区分同型号显示器
- 切换后调用 `listDisplays()` 重新读取真实状态
- 正确处理 `display.target-unavailable`、`display.hdr-unsupported`、`display.hdr-state-unknown`、`display.topology-changed` 和权限拒绝
- 不把 Advanced Color、WCG 或自动颜色管理直接当成 HDR
- 不自行使用 PowerShell、注册表、外部 EXE、快捷键模拟、Windows API 或通用原始命令
- 不为状态刷新创建常驻轮询；Widget 重新显示、用户手动刷新或切换完成时再读取

产品界面中，用户主动操作并已授予 `display.control` 后可以直接切换；Codex 或自动化执行真实 HDR 测试时，仍须记录原状态、说明可能短暂黑屏并获得用户单独确认。

浏览器 Memory Host 默认返回能力不可用，不会模拟 HDR 切换成功。显示器业务必须留在对应插件中，启动器公共层只提供通用 Display Service、权限和状态容器。

## 10. 生命周期与资源管理

入口可以实现：

- `activate`
- `suspend`
- `resume`
- `deactivate`
- `dispose`

必须：

- 生命周期方法允许重复调用或安全跳过
- 所有释放函数幂等
- 页面退出、Widget 删除、插件禁用、重载和异常后完整清理
- 所有事件、音频、快捷键、Observer、DOM 监听和 AbortController 可释放
- `suspend()` 停止非必要刷新、动画和设备读取，`resume()` 只恢复当前入口真正需要的工作
- `deactivate()` 停止业务活动，`dispose()` 释放插件自行持有的对象引用
- 不自行创建长期 `setInterval`
- 周期工作注册到共享 Scheduler
- 不创建不必要的后台线程、常驻任务或隐藏窗口
- 不可见入口不得继续运行 `requestAnimationFrame`
- 事件名必须带插件命名空间，例如 `${context.pluginId}:data-changed`
- 处理异步订阅时必须覆盖“组件已卸载但订阅刚完成”的竞态

Scheduler 要求：

- 周期不得低于 250 ms
- 页面或 Widget 不可见时默认暂停非必要工作
- 确需隐藏运行时必须声明 `background.run`
- 调度回调连续失败 3 次后接受宿主停止调度

插件异常必须被错误边界隔离，不得导致 ToolCenter 退出。

## 11. 数据、日志与错误处理

### 11.1 存储

- 只能通过 `context.storage`
- 数据自动按插件 ID 隔离
- key 长度为 1～128，只使用 ASCII 字母、数字、点号、短横线和下划线
- key 使用稳定、可读并带结构版本的命名，例如 `settings.v1`
- 数据结构变化时记录版本并提供兼容或迁移
- Widget 实例数据包含 `instanceId`
- 不保存密码、Token、Cookie、设备凭据或无必要隐私

### 11.2 日志

- 通过 `context.logger`
- 错误日志保留必要上下文
- 不记录密钥、完整用户内容和无关个人信息
- 不使用日志替代用户可见错误反馈

### 11.3 错误处理

- 业务失败显示明确原因和恢复操作
- 权限拒绝与系统错误分开处理
- 可恢复错误不得让整个插件失效
- 保留宿主结构化错误码，不根据英文错误文本猜测错误类型
- 用户提示不暴露原始设备 ID、系统路径、命令参数或内部调用栈
- 未处理异常交给宿主错误边界和诊断系统
- 禁用或卸载后不得残留失败实例

## 12. 界面与视觉要求

### 12.1 正式视觉来源

实现顺序和事实来源：

1. `ToolCenter-视觉交接-v1.0.2/DEVELOPER-HANDOFF.md`
2. `01-Design-Tokens/tokens-light.json`
3. `01-Design-Tokens/Token说明.md`
4. `03-Icons/` 中的正式 SVG 与许可证
5. `04-Components/`、`05-Page-Templates/`、`06-Widget-Templates/`
6. 当前宿主 `apps/desktop/src/styles/tokens.css`
7. 对应 `@2x.png` 视觉预览

PNG 只用于对照，不能裁图、取色、作为页面背景或替代代码布局。设计平台源文件不可用时，以 JSON、SVG、Markdown 说明和同名 PNG 预览为准。

### 12.2 UI Kit 与代码边界

插件必须使用宿主视觉语言、Design Tokens 和现有正式资源。当前共享组件实现仍位于 `apps/desktop/src/components/`，不是对插件公开的可导入包，因此：

- 插件不得直接导入 `apps/desktop` 内部 UI 组件。
- 宿主已经通过公共包开放组件时，优先使用公共组件。
- 尚未开放的组件使用语义化 HTML、插件作用域 CSS 和宿主公开 Token 实现。
- 需要跨插件共享的新组件时，提出公共 UI 包变更方案并等待确认，不得复制宿主内部源码。
- 视觉 Token 或组件缺失时记录宿主缺口，不得在插件内另建品牌体系。

### 12.3 视觉基线

- 风格：Material 3 桌面化扁平界面。
- 基准画布：1440×900。
- 插件页最小尺寸：960×640；标准参考尺寸：1280×800。
- 4 px 布局网格，普通层级主要使用色阶、边框和留白。
- 默认边框 1 px；Focus 轮廓 2 px，偏移 2 px。
- 大阴影只用于 Menu、Dialog、Toast 等 Overlay。
- Windows 字体：`Segoe UI Variable, Microsoft YaHei UI, sans-serif`。
- 设计稿 MiSans 只作视觉参考，不要求逐像素匹配字体度量。
- 标题和操作文字不得意外换行；卡片标题单行省略。
- 正文可因 Windows 字体比设计稿多或少一行，文本块边缘允许约 ±4 px 字体度量差异。
- `compact` 只改变控件和行高，不改变字号、点击热区或信息层级。

当前主题以浅色为正式基准，深色 Token 为预留能力。插件不得自行宣称深色主题已完整支持；只有全部状态和对比度实际验收后才能标记完成。

### 12.4 Token

插件必须：

- 使用宿主实际公开的 CSS 变量，不从截图估算或硬编码整套颜色、间距、圆角和阴影。
- 主色前景使用对应 `onPrimary`，危险色前景使用对应 `onError`。
- `onPrimaryContainer` 只与 `primaryContainer` 配对，不能与 `onPrimary` 混用。
- 发现设计 JSON 与宿主 CSS 变量不一致时，报告并修复宿主 Token，不能在单插件内私自补一套 `:root`。
- `textMuted #79747E` 只用于时间、辅助说明和次要标签，不用于重要操作、小尺寸错误说明或正文。

`textMuted` 是用户确认保留的已知对比度边界，因此不得宣称整套界面完全满足 WCAG AA。

### 12.5 图标与素材

- 使用 `ToolCenter-视觉交接-v1.0.2/03-Icons/` 下对应的 24×24 SVG。
- SVG 使用 `currentColor`，通过 CSS `color` 和语义 Token 改色；禁止 CSS filter。
- 常用图标显示尺寸为 16、20、24、32 px。
- 不使用 Emoji、ASCII、Unicode 字符、临时手绘 SVG 或从 PNG 裁出的位图代替正式图标。
- 图标状态不能只依赖颜色，必须配合文字、容器或形状变化。
- Material Symbols 图标按 Apache License 2.0 使用，必须保留现有 LICENSE 和 NOTICE。
- 插件新增第三方素材前必须确认许可证、记录来源和处理方式。

### 12.6 组件与状态

交互控件至少覆盖：`default`、`hover`、`pressed`、`focus`、`disabled`、`loading`、`error`、`selected`。

页面和 Widget 按功能覆盖：

- `loading`
- `empty`
- `success`
- `error`
- `permission`
- `unsupported` 或 `unavailable`
- `disabled`
- 可恢复操作

同一个控件使用状态属性实现，不复制多套布局代码。高风险操作使用危险确认弹窗，权限申请使用独立权限说明区。

### 12.7 样式隔离

- 根 class 使用 `plugin-<目录名>` 前缀。
- 使用插件作用域 CSS；可以使用 CSS Modules，但不强制改变现有插件风格。
- 禁止全局 `*`、`html`、`body`、`:root`、`button`、`input` 选择器。
- 禁止修改全局字体、滚动条、主题、标题栏、侧栏和其他插件样式。
- 禁止覆盖宿主 Design Tokens 或注入远程 CSS。
- 不复制宿主导航、标题栏、设置页、Toast 或 Dialog。
- 不假设主窗口宽度固定，长内容允许纵向滚动。

### 12.8 无障碍与动效

- 最小点击区域为 36×36 px。
- Tab 顺序遵循视觉顺序，核心操作可以只使用键盘完成。
- Hover 与 Focus 必须区分，不能移除焦点环。
- 状态使用图标、文字和形状冗余，不只依赖颜色。
- 动态状态使用 `aria-live`、`role="status"` 或 `role="alert"`。
- 图标按钮提供 `aria-label`，表单控件有可见 label。
- 检查长中文、英文混排、溢出、省略和换行。
- 支持 100%、125%、150%、175%、200% Windows DPI/缩放验收。
- Reduced Motion 模式取消非必要位移、缩放和持续动画，保留直接状态反馈。
- 动画优先使用 `transform`、`opacity` 和短时 CSS transition。
- 禁止持续流动背景、粒子层、背景视频、高频阴影动画、大面积持续模糊和不可见时仍运行的动画。

正式素材不足时，使用清晰文本或已有共享资源，并在 README 记录缺失项，不自行扩展品牌设计。

## 13. 直接接入正式插件中心

### 13.1 开发命令

在项目根目录运行：

```powershell
.\toolcenter.cmd plugin-dev
```

该命令会：

1. 校验全部插件
2. 生成插件注册表
3. 启动真实 ToolCenter Tauri 桌面应用
4. 将插件接入插件管理、全部工具、搜索、Page 或 Widget
5. 使用真实 Plugin Runtime、Rust 权限层和共享 UI
6. 支持开发期间热更新

入口脚本只整理当前进程的 Node、pnpm 和 Cargo 路径，不修改 Windows 系统 PATH。

### 13.2 不可替代的实际验收

以下方式可以辅助界面和纯逻辑开发，但不能代替正式桌面验收：

- 普通浏览器页面
- 独立 Web 演示站
- 单独插件应用
- 静态截图
- 只有 Vitest 模拟
- 只有浏览器内存桥

### 13.3 集成路径

```text
创建插件目录
→ 编写 Manifest
→ 声明入口与权限
→ 实现功能和错误处理
→ 补充测试与 README
→ plugin:dev
→ 正式插件中心实际验收
→ verify
→ 用户确认
→ release-build
```

### 13.4 注册表与正式程序

插件注册表由以下命令生成：

```powershell
corepack pnpm registry:generate
```

生成器扫描 `plugins/*/plugin.manifest.ts` 并更新 `apps/desktop/src/plugin-registry.generated.ts`。开发者不得手动编辑生成结果，也不得在 Shell 首屏同步导入所有插件入口。

已经打包的 `发布版/ToolCenter.exe` 不会热加载工作区外的 TypeScript 源码。开发时使用 `plugin-dev`；插件完成、合并并获得用户确认后，才用 `release-build` 写入默认发布程序。

### 13.5 一个插件一个负责对话

- 插件开发、README、测试和插件发布由同一个负责对话完成。
- 插件对话使用 `codex/plugin-<plugin-name>` 分支或独立 worktree。
- 启动器对话只处理经确认的通用宿主能力和 ToolCenter 本体发布。
- 插件对话不得因为“之后要发布”提前上传 EXE、安装包或独立插件应用。
- 需要宿主能力时，宿主能力和依赖它的插件必须在同一个 ToolCenter PR 中保持可构建状态；提交可以按职责拆分。

## 14. 测试与自动门禁

### 14.1 单插件检查

```powershell
corepack pnpm --filter @tool-center/plugin-<name> typecheck
corepack pnpm --filter @tool-center/plugin-<name> test
```

### 14.2 项目检查

```powershell
corepack pnpm registry:generate
corepack pnpm plugin:validate
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build:web
```

### 14.3 完整门禁

```powershell
.\toolcenter.cmd verify
```

完整门禁包含：

- 注册表生成
- 插件规则校验
- TypeScript 类型检查
- ESLint 与 Stylelint
- Vitest
- Rust fmt
- Rust Clippy
- Cargo test

### 14.4 最低测试范围

- Manifest 加载与字段
- 核心纯函数
- Action 成功、业务失败和异常
- Page 加载、空、成功、错误和权限拒绝
- Widget 多实例、尺寸、隐藏、锁定和卸载
- 存储兼容或迁移
- Scheduler、事件和订阅释放
- 系统能力允许、拒绝、失效和恢复
- 插件禁用、重载和异常隔离

### 14.5 性能与加载门禁

以下体积为初始工程目标，不是自动失败阈值；超出时必须测量、说明原因并评估拆包：

| 入口 | 建议业务代码目标 | 运行要求 |
|---|---:|---|
| Action | 尽量小于 100 KB | 执行后无持续资源 |
| Widget | 尽量小于 200 KB | 不可见时无持续 UI 刷新，默认最多一个调度任务 |
| Page | 首次入口尽量小于 500 KB | 大型依赖二次懒加载，离开后默认卸载 |
| Service | 不以包大小代替测量 | 默认关闭，空闲 CPU 接近零，停止后无残留 |

必须检查：

- 冷启动只加载 Shell 和静态注册表，不加载全部插件页面。
- 安装但未打开的插件不执行入口代码。
- Widget 不可见、主窗口隐藏或页面离开后没有无意义刷新。
- 不存在持续 60 FPS 动画、每插件一套轮询或重复系统监听。
- 连续启用、禁用或重载同一插件 20 次后，内存和资源数量不持续增长。
- 空闲 10 分钟后没有异常 CPU 唤醒、重复日志或后台任务堆积。
- 重型任务完成后 Worker、Sidecar、文件句柄和订阅及时退出。

### 14.6 真实 Windows 能力验收

浏览器、Vitest、静态截图、接口未抛错或只读枚举都不能代替系统能力验收。

涉及 HDR、默认音频设备、文件写入、进程控制、快捷键、管理员权限或其他系统设置时：

1. 说明将改变的系统状态、目标对象和可能影响。
2. 记录操作前状态。
3. 获得用户单独确认。
4. 只操作用户确认的目标。
5. 写入后重新读取真实系统状态。
6. 测试完成后恢复原状态。
7. 在 README 和 PR 中记录测试环境、结果与未覆盖场景。

不得在远程会话、目标不明确、权限状态不清楚或无法恢复原状态时强行测试。

## 15. 完成与验收标准

插件只有同时满足以下条件才算完成：

1. 插件管理正确显示名称、版本、描述、权限和入口。
2. 插件可以启用、禁用和重新加载。
3. Page、Action 或 Widget 可以从正式插件中心打开。
4. 权限允许、拒绝和恢复路径正常。
5. 空状态、错误状态和恢复操作完整。
6. 插件异常不导致 ToolCenter 退出。
7. 页面退出、插件禁用和卸载后没有残留资源。
8. Manifest、实现、测试和 README 一致。
9. 单插件检查和完整门禁通过。
10. 已在 ToolCenter 独立桌面应用中实际操作验收。
11. 不含密钥、Token、个人路径或隐私数据。
12. 缺失宿主能力和已知限制已记录。
13. 未打开、隐藏和卸载状态下没有持续无意义工作。
14. 正式 Token、SVG、状态图和第三方许可证使用正确。
15. 100%～200% DPI、键盘路径和 Reduced Motion 已检查。

Widget 还必须验证：

- 多实例互不串扰
- 三档尺寸均可操作
- 隐藏后暂停非必要工作
- 锁定后不会误拖动
- 位置与显示状态可恢复
- 透明区域不会大范围阻挡桌面点击
- portal 菜单与弹层可点击
- 插件禁用后无残留窗口内容
- 40 px 标题拖动区不会抢占正文交互
- 锁定状态具有固定解锁入口
- 桌面层和始终置顶状态不只依赖颜色
- Small 260×160、Medium 360×220、Wide 520×220 与安全区一致

系统能力还必须在目标 Windows 机器上进行真实测试，不能以浏览器模拟代替。涉及音频默认设备、HDR 或其他系统设置的真实切换，执行前必须再次获得用户确认。

## 16. README 与交接要求

每个插件 README 必须记录：

- 功能目标和明确不做的内容
- 插件 ID、版本和兼容宿主
- Page、Widget、Action、Service 入口
- 权限及申请理由
- 存储 key 和数据版本
- 运行、测试和验收方法
- 资源释放策略
- 性能和懒加载策略
- 视觉资源、图标与第三方许可证
- 实际测试的 Windows、硬件和显示器/音频环境（如适用）
- 已知限制和待办事项
- 本轮修改文件和测试结果

开发结束时向用户汇报：

- 已完成功能
- 修改文件
- 使用权限
- 测试结果
- 桌面应用验收结果
- 已知限制
- 是否修改宿主或公共契约
- 安全和发布风险
- Git 分支、提交、PR 或 Release 状态（仅在用户授权执行后）

## 17. 发布版更新规则

项目只维护一套正式源码和一个固定的默认发布目录：

```text
发布版/
├─ ToolCenter.exe
├─ ToolCenter.exe.sha256
├─ 版本信息.json
└─ 使用说明.md
```

不得创建 `ToolCenter-vX.Y.Z/` 一类代码或程序副本。历史版本通过 Git 提交和标签管理。原 `正式版/` 已于 2026-08-11 完成迁移并清理，不得重新创建。

只有用户明确确认后才可以运行：

```powershell
.\toolcenter.cmd release-build
```

该命令会执行完整检查、构建并覆盖 `发布版/` 中的同名交付文件。已打包 EXE 不会热加载外部 TypeScript 源码，插件修改后必须重新构建。

PR 合并不等于正式发布。推荐顺序：

```text
合并源码
→ 在 main 上重新验证
→ release-build
→ 校验正式 EXE 哈希
→ 实际启动验收
→ 用户再次确认
→ 创建或更新 GitHub Release
```

源码历史使用 Git 提交与标签回滚，不能复制新版本文件夹。正式二进制不进入源码 PR，只能在用户确认后作为 GitHub Release 附件发布。

未经确认不得：

- 覆盖正式程序
- 修改核心配置
- 创建安装包
- 创建 GitHub Release
- 上传正式 EXE

## 18. GitHub、开源与隐私安全

### 18.1 仓库与分支

- ToolCenter 是公开 Monorepo，默认分支为 `main`。
- 所有第一方插件进入同一个 ToolCenter 仓库，不因“独立对话开发”建立独立应用仓库。
- 一个插件使用一个分支，推荐 `codex/plugin-<plugin-name>`。
- 不直接向 `main` 推送，默认先创建 Draft PR。
- 插件的提交、推送和后续发布由负责该插件的对话执行；其他对话不得抢先发布。

### 18.2 提交范围与拆分

普通插件通常提交：

```text
plugins/<plugin-name>/
apps/desktop/src/plugin-registry.generated.ts
pnpm-lock.yaml（仅在确实变化时）
相关规范或 README
```

需要新的宿主能力时，同一 PR 还应包含：

- `packages/plugin-contract/`
- `packages/plugin-runtime/`
- `apps/desktop/` 或 `apps/desktop/src-tauri/`
- Rust 权限与命令层
- 对应测试、架构、迁移和规范说明

推荐按职责拆分提交：

```text
feat(host): add <capability> service for plugins
feat(plugin): add <plugin-name> plugin
docs: document <plugin-name> integration
```

不得只提交插件代码而遗漏其依赖的宿主能力，也不得为单个插件开放通用 Shell、PowerShell、任意 Rust command 或宽泛系统接口。

### 18.3 精确暂存

禁止：

```powershell
git add -A
git add .
```

必须按范围精确暂存，并检查：

```powershell
git diff --cached --stat
git diff --cached
git diff --cached --check
```

发现无关改动时，从本次暂存中排除；不得删除、覆盖或回退其他对话留下的文件。

### 18.4 公开仓库安全检查

推送前必须检查：

- API Key、Token、密码、Cookie、验证码、证书和私钥
- `.env`、本地配置和账号凭据
- 姓名、学校、账号、设备信息和个人绝对路径
- 日志、数据库、缓存、运行数据和崩溃转储
- `node_modules`、`dist`、`target`、`coverage` 和临时文件
- 正式 EXE、安装包和压缩包
- 参考截图、设计交接包和不应公开的 ZIP
- 未经授权的图片、字体、图标、代码和许可证不兼容依赖

GitHub CLI 输出中的认证 Token 即使已遮罩，也不得复制进代码、文档、Issue、PR 或日志。敏感配置改用环境变量并加入 `.gitignore`。

源码 PR 不上传：

```text
发布版/ToolCenter.exe
发布版/ToolCenter.exe.sha256
发布版/版本信息.json
```

`发布版/使用说明.md` 可以作为文档提交。EXE、安装包和压缩包只能在正式验收及用户确认后通过 GitHub Release 发布。

### 18.5 推送、PR 与合并

未经用户明确授权，不得执行：

- `git commit`
- `git push`
- 创建、标记可审查或合并 PR
- `gh repo` 或仓库设置操作
- 创建或更新 GitHub Release
- 修改仓库可见性
- 上传构建产物

PR 描述至少记录：

- 插件名称、ID、版本、入口和功能
- 权限与申请原因
- 宿主、公共契约或 Rust 变更
- 测试命令和结果
- 真实桌面与硬件验收结果
- 性能和资源清理结果
- 已知限制和未覆盖场景
- 第三方素材、依赖和许可证
- 安全扫描结果
- 正式版是否重新构建

只有插件校验、完整门禁、GitHub Actions、桌面验收、安全检查和用户确认全部满足后才能合并。禁止普通流程使用强制推送。

### 18.6 高风险插件发布

涉及 HDR、音频、文件、进程、快捷键、管理员权限或系统设置时，PR 必须记录：

- 实际改变的系统状态
- 测试前原状态和测试后恢复结果
- 目标 Windows、硬件、驱动或显示器环境
- 未覆盖的设备、远程会话和异常场景

接口调用成功不能代替实际状态核对。

### 18.7 回滚

- 优先使用 `git revert`，禁止把 `git reset --hard` 当作普通回滚方案。
- 插件回滚同步移除注册表、依赖和文档。
- 公共宿主能力只有确认没有其他插件依赖后才能回滚。
- Release 问题回退到上一 Git 标签并重新构建，不复制版本目录。
- 删除 Release、标签、分支或远程资产属于破坏性操作，必须再次获得用户确认。

使用第三方图标、字体、代码或依赖时，必须确认许可证、保留 NOTICE，并在插件 README 或项目第三方声明中记录来源。

## 19. 最终检查清单

```text
[ ] 插件目录为 plugins/<kebab-case-name>
[ ] 包名以 @tool-center/plugin- 开头并设置 private
[ ] 插件 ID 唯一、稳定且符合格式
[ ] Manifest 静态无副作用
[ ] contributes 与动态入口完全一致
[ ] Page、Widget、Action 独立分包
[ ] 只声明当前使用的最小权限
[ ] 没有直接 Tauri、Rust command 或启动器内部导入
[ ] 没有绕过 PluginContext 使用系统能力
[ ] 所有输入、权限拒绝、错误和恢复路径已处理
[ ] 所有订阅、任务、timer、监听和资源可以释放
[ ] Widget 多实例、尺寸、隐藏、锁定和恢复已验证（如适用）
[ ] Widget 使用 260×160、360×220、520×220 正式尺寸及 40px 标题拖动区（如适用）
[ ] Widget 的 13 种正式状态和锁定快捷解锁入口已覆盖（如适用）
[ ] 真实系统能力已在 Windows 上验证（如适用）
[ ] HDR 插件未把 WCG/Advanced Color 误报为 HDR，且写入后重新读取状态（如适用）
[ ] 音频插件区分读取和控制权限，释放设备订阅并核对三个默认角色（如适用）
[ ] 本机代理插件只访问固定回环地址，区分读取和控制权限，验证组内节点及系统代理归属（如适用）
[ ] CSS 有插件作用域并使用宿主公开 Design Tokens
[ ] 没有导入宿主内部 UI 组件、覆盖 :root 或创建第二套视觉体系
[ ] 使用视觉交接 v1.0.2 正式 SVG，不从 PNG 裁图
[ ] 960×640、100%～200% DPI 和所有声明的 Widget 尺寸均可操作
[ ] 键盘、焦点、aria-live、Reduced Motion 和非颜色状态表达已验证
[ ] 未打开、隐藏、卸载和空闲状态无无意义刷新或资源增长
[ ] 大型依赖二次懒加载，长列表和重型计算未阻塞 UI
[ ] README 已记录入口、权限、存储、测试和限制
[ ] 单插件类型检查与测试通过
[ ] plugin:validate、typecheck、lint、test 通过
[ ] .\toolcenter.cmd verify 通过
[ ] 已通过 .\toolcenter.cmd plugin-dev 在正式桌面壳中验收
[ ] 不含密钥、个人路径、隐私和未授权素材
[ ] 第三方依赖、图标、字体和素材的 LICENSE/NOTICE 已保留
[ ] Git 仅精确暂存当前范围，未使用 git add -A 或 git add .
[ ] PR 已记录权限、测试、硬件验收、限制、许可证和安全检查
[ ] 未经确认没有覆盖正式版、提交、推送或发布
```

## 20. 规范维护与变更

后续继续维护当前文件，不创建 `插件开发规范_v2.1/` 一类文件夹或并行主规范。历史变化通过 Git 提交和本文件修订记录追踪。

以下变化必须同步更新本文件、README 和相关架构文档：

- Plugin Contract 的 Manifest、入口、生命周期或公共类型变化
- `PluginContext` 服务增加、删除或行为变化
- 权限名称、用途或 Rust 强制校验变化
- Widget Host、实例模型、尺寸、显示层级或资源清理变化
- 注册表、开发命令、构建、正式版或 GitHub 发布流程变化
- 公共 UI Kit、Design Tokens、图标、视觉交接或无障碍基线变化
- 第一方插件信任模型、签名、沙箱或第三方插件策略变化

普通插件自身的功能、存储或界面变化只更新该插件 README、测试和版本号；不需要为每次插件迭代修改全局规范。

## 附录：可直接复制给插件开发对话的提示词

```text
你正在 ToolCenter 项目根目录中开发一个受信任的第一方内置插件。

插件显示名称：<插件名称>
插件目录：plugins/<kebab-case-name>
插件 ID：toolcenter.<stable-id>
插件目标：<一句话说明功能>
入口类型：<Page / Widget / Action，可多选>
预计权限：<按实际功能最小化声明>

开始前完整阅读：
1. AGENTS.md
2. README.md
3. docs/ToolCenter插件开发要求_统一版.md
4. packages/plugin-contract/src/
5. packages/plugin-runtime/src/
6. 当前插件 README、Manifest 和测试（如果存在）
7. ToolCenter-视觉交接-v1.0.2/DEVELOPER-HANDOFF.md
8. 与本插件入口对应的 Token、图标、Page 或 Widget 说明

先检查 Node.js、pnpm、Rust、Cargo、Tauri、Git 状态、插件 ID、宿主能力和现有插件结构。先向我报告环境结论、修改文件、入口、权限、是否需要宿主级变更及简短计划，然后在不涉及宿主级变更时直接开始开发。

本插件不是独立应用。不得创建新的 Tauri、Electron、独立 Web 应用、窗口、托盘、EXE、安装包或重复启动器。不得直接导入 @tauri-apps/*、apps/desktop 内部源码、其他插件源码或原始 Rust command。插件只能通过 @tool-center/plugin-contract 和 PluginContext 使用宿主能力。

默认只修改 plugins/<kebab-case-name>/、当前插件测试与 README，以及注册表生成工具自动更新的文件。如果必须修改 apps/desktop、src-tauri、plugin-contract、plugin-runtime、根依赖、构建配置、公共权限或其他插件，先说明原因、范围、风险、兼容性和回滚方法，等待我确认。

Manifest 必须静态无副作用，contributes 与入口一致，所有入口使用动态 import()，权限最小化。必须处理加载、空状态、权限拒绝、业务失败、异常和恢复。所有订阅、监听、Scheduler、Widget 实例和后台资源必须可以完整释放。

界面必须使用 ToolCenter 宿主视觉规范、公开 Design Tokens 和正式图标。当前 apps/desktop 内部 UI 组件不能直接导入；公共组件未开放时使用语义化 HTML 和作用域 CSS。不得覆盖 :root、注入全局样式、从 PNG 裁图或新建第二套视觉体系。适配 960×640、100%～200% DPI 和所有声明的 Widget 尺寸，满足键盘、焦点、Reduced Motion、非颜色状态表达和动态状态反馈要求。

Widget 必须支持多实例，以 instanceId 隔离业务数据；visible=false 时暂停非必要工作；位置、尺寸、显示器、锁定和层级交给宿主管理；portal 弹层标记 data-toolcenter-widget-region。正式尺寸为 small 260×160、medium 360×220、wide 520×220，标题拖动区 40px，并覆盖 default、hover、locked、unlocked、dragging、loading、empty、permission、error、unavailable、menu、desktop-layer、always-on-top 状态。

插件必须保持懒加载。未打开时不得执行业务代码；大型编辑器、图表和媒体处理器二次懒加载；隐藏和卸载后不得继续动画、轮询、调度或监听。不要把重型计算放在 React 渲染线程。

开发联调统一在项目根目录运行：
.\toolcenter.cmd plugin-dev

必须在真实 ToolCenter Tauri 桌面应用中验证插件管理、全部工具、搜索、页面或 Widget。浏览器页面、静态截图、Vitest 或内存桥不能代替原生能力验收。

完成前运行：
corepack pnpm --filter @tool-center/plugin-<name> typecheck
corepack pnpm --filter @tool-center/plugin-<name> test
.\toolcenter.cmd verify

涉及音频、HDR、文件、系统设置、进程、快捷键或其他真实系统能力时，必须在 Windows 上测试。任何会改变系统设置的操作，执行前说明目标和影响、记录原状态、提醒我并获得单独确认；写入后重新读取真实状态并恢复原状态。

你是该插件唯一负责对话，负责后续插件分支、PR 和发布，但所有 GitHub 写操作仍需我明确确认。完成后汇报功能、修改文件、权限、测试、桌面验收、性能、限制、宿主变更、许可证和安全风险。不要自行覆盖正式版，不要使用 git add -A 或 git add .，不要自行 commit、push、合并 PR、创建 Release 或上传 EXE。

只有我明确确认后，才可以运行：
.\toolcenter.cmd release-build

现在先完成环境、项目结构和契约检查，再给出简短计划并开始开发。
```
