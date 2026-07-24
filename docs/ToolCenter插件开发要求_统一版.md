# ToolCenter 插件开发要求（统一版）

## 文档信息

| 项目 | 内容 |
|---|---|
| 文档编号 | TC-PLUGIN-UNIFIED-001 |
| 版本 | 1.0 |
| 状态 | 正式开发交接版 |
| 更新日期 | 2026-07-24 |
| 适用宿主 | ToolCenter 0.1.x |
| 适用范围 | 随 ToolCenter 源码构建的受信任第一方插件 |
| 开发模式 | 一个 ToolCenter 宿主、一个插件一个开发对话 |

本文件将 ToolCenter 的插件规范、正式插件中心接入流程、Widget 与音频要求、测试门禁、正式版更新及公开仓库安全要求整理为一份统一交付文档。

当文档与实现不一致时，事实来源优先级为：

1. `packages/plugin-contract/src/`
2. `packages/plugin-runtime/src/`
3. `apps/desktop/src/runtime/host.ts`
4. `apps/desktop/src/services/` 与 Widget Host 实现
5. `apps/desktop/src-tauri/src/services/` 与 `commands/`
6. `tooling/validate-plugin/src/index.ts`
7. 本文件

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

### 2.3 开始前必须检查

- Node.js、pnpm、Cargo 和 Rust 版本
- 当前 Git 分支和工作区状态
- 插件目录名、包名和插件 ID 是否唯一
- 目标功能需要的入口、权限和宿主能力
- 当前宿主是否已经开放所需能力
- 是否会修改启动器核心或公共契约
- 是否存在其他对话正在修改相同文件

开发对话开始时先报告：

- 环境是否满足要求
- 准备修改的文件
- 入口和权限
- 是否需要宿主级变更
- 简短实施计划

环境和范围确认后，应直接推进插件功能，不要只停留在计划阶段。

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
│  └─ styles.css
├─ tests/
├─ plugin.manifest.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```

只保留当前插件实际需要的入口文件。

### 4.3 命名与依赖

- 目录名必须使用 kebab-case。
- 包名必须以 `@tool-center/plugin-` 开头。
- 插件 ID 建议使用 `toolcenter.<stable-id>`。
- 第一方插件必须设置 `"private": true`。
- TypeScript 继承 `../../tsconfig.base.json`。
- Page/Widget 使用与宿主兼容的 React 19，不得打包第二份 React。
- 不得提交 `node_modules`、`dist`、缓存、日志、运行数据或密钥。
- 不得为简单功能引入大型框架或重复宿主依赖。

## 5. Manifest 要求

`plugin.manifest.ts` 必须默认导出 `definePlugin(...)`，并保持静态、无副作用。

必须包含：

- 全局唯一且永久稳定的 `id`
- 用户可读的 `name`
- 一句话 `description`
- 语义化 `version`
- `category`
- `minHostVersion`
- 动态加载的 `entrypoints`
- 与实现一致的 `contributes`
- 去重后的最小 `permissions`

规则：

- ID 只使用小写字母、数字、点号和短横线分段。
- ID 发布后不得更改；更换 ID 按新插件处理。
- 当前版本号不使用 `+build` 后缀。
- 每个 contribution ID 在插件内唯一。
- `entrypoints` 必须使用动态 `import()`。
- `contributes` 与入口导出的 ID、标题、路由及 Widget 信息一致。
- Page、Widget、Action 入口必须独立分包，不得相互强制加载。
- Manifest 顶层不得调用网络、权限、存储、事件、定时器、文件或系统能力。
- 声明权限不会自动开放宿主尚未实现的服务。

当插件同时提供多个入口时，数组顺序属于用户体验设计。宿主通常优先打开第一项 Page，没有 Page 时执行第一项 Action。

## 6. 入口要求

### 6.1 Action

适合一次性操作。

必须：

- 校验所有 `unknown` 外部输入
- 返回 `ActionResult`
- 可预期失败返回 `success: false` 和明确说明
- 长期状态写入 `context.storage`
- 不使用模块全局变量保存业务状态
- 执行结束后允许宿主完整停用和清理

### 6.2 Page

适合完整交互、设置、历史记录和错误恢复。

必须：

- 通过入口模块导出 Page 定义
- 页面组件默认导出并接收 `PluginPageProps`
- 提供加载、空状态、成功、错误和恢复路径
- 在 effect cleanup 中释放自行注册的资源
- 避免组件卸载后继续更新状态
- 不创建全局路由、独立窗口或第二套应用框架

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

位置、显示器、尺寸、锁定、桌面层级和恢复由 Widget Manager 管理。Widget Host 按“显示器 × 显示层级”复用透明 WebView。

### 6.4 Service

当前 Service 仍属于契约预留能力，不得作为当前插件不可替代的核心功能。

如经批准使用：

- `defaultEnabled` 必须为 `false`
- `start()`、`stop()` 和 `status()` 行为明确
- `stop()` 必须幂等
- 不创建重复常驻线程或隐藏窗口
- 后台运行必须声明对应权限并提供关闭入口

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
- 高风险能力在 Rust 层再次校验
- 不把前端状态或本地记录当作安全边界

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
| 后台和窗口 | `hotkeys.register`、`background.run`、`window.detached` |
| 外部操作 | `shell.open-safe`、`administrator.request` |

权限出现在类型中不代表对应服务已经实现。

## 9. Windows 系统设备插件要求

### 9.1 音频

使用 `PluginContext.audio` 时必须：

- 枚举、读取默认设备和订阅变化使用 `audio.read`
- 修改默认设备单独使用 `audio.control`
- 把设备 ID 视为不透明字符串
- 不解析、拼接或依赖设备 ID 内部格式
- 使用原生设备变化通知，不自行轮询
- 收到变化事件后重新读取状态，不把事件当完整快照
- 释放 `subscribeDeviceChanges()` 返回的 `Release`
- 处理“组件已卸载、异步订阅刚完成”的竞态
- 处理设备在操作期间断开或失效
- Windows 兼容层失败时显示可恢复错误

默认角色包括：

- `console`
- `multimedia`
- `communications`

未指定角色或传入空角色列表时，宿主会同时设置三个角色。执行真实切换会改变系统设置，测试前必须提醒用户并获得确认。

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

浏览器 Memory Host 默认返回能力不可用，不会模拟 HDR 切换成功。真实 HDR 切换会改变 Windows 显示设置并可能造成短暂黑屏，测试前必须提醒用户并获得单独确认。

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
- 不自行创建长期 `setInterval`
- 周期工作注册到共享 Scheduler
- 不创建不必要的后台线程、常驻任务或隐藏窗口

Scheduler 要求：

- 周期不得低于 250 ms
- 页面或 Widget 不可见时默认暂停非必要工作
- 确需隐藏运行时必须声明 `background.run`
- 连续失败后接受宿主停止调度

插件异常必须被错误边界隔离，不得导致 ToolCenter 退出。

## 11. 数据、日志与错误处理

### 11.1 存储

- 只能通过 `context.storage`
- 数据自动按插件 ID 隔离
- key 使用稳定、可读命名
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
- 未处理异常交给宿主错误边界和诊断系统
- 禁用或卸载后不得残留失败实例

## 12. 界面与视觉要求

插件必须：

- 使用共享 UI Kit 和 Design Tokens
- 使用现有正式图标和素材
- 使用插件作用域 CSS
- 提供加载、空、成功、失败、禁用和权限拒绝状态
- 适配 960×640 及以上主窗口
- 分别适配声明的 Widget 尺寸
- 长内容允许纵向滚动
- 核心操作可使用键盘完成
- 保留清晰焦点样式
- 状态不能只依赖颜色表达
- 使用 `aria-live` 等方式反馈动态状态

禁止：

- 覆盖 `:root` 或宿主 Design Tokens
- 使用未经审核的全局选择器
- 复制宿主导航、标题栏和设置界面
- 擅自建立新的品牌配色或视觉体系
- 使用 Emoji、ASCII 或临时手绘 SVG 代替正式图标
- 假设主窗口固定宽度

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

Widget 还必须验证：

- 多实例互不串扰
- 三档尺寸均可操作
- 隐藏后暂停非必要工作
- 锁定后不会误拖动
- 位置与显示状态可恢复
- 透明区域不会大范围阻挡桌面点击
- portal 菜单与弹层可点击
- 插件禁用后无残留窗口内容

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

## 17. 正式版更新规则

项目只维护一套正式源码和一个正式交付目录：

```text
正式版/
└─ ToolCenter.exe
```

不得创建 `ToolCenter-vX.Y.Z/` 一类代码或程序副本。历史版本通过 Git 提交和标签管理。

只有用户明确确认后才可以运行：

```powershell
.\toolcenter.cmd release-build
```

该命令会执行完整检查、构建并覆盖 `正式版/ToolCenter.exe`。已打包 EXE 不会热加载外部 TypeScript 源码，插件修改后必须重新构建。

未经确认不得：

- 覆盖正式程序
- 修改核心配置
- 创建安装包
- 创建 GitHub Release
- 上传正式 EXE

## 18. GitHub、开源与隐私安全

ToolCenter 源码仓库为公开仓库。提交前必须检查：

- API Key、Token、密码、Cookie、验证码和私钥
- `.env` 与本地配置
- 账号、学校、用户信息和个人绝对路径
- 日志、数据库、缓存和运行数据
- `node_modules`、`dist`、`target` 和临时文件
- 正式 EXE 和安装包
- 参考截图、设计交接包和 ZIP
- 第三方素材、字体、图标及许可证

未经用户明确授权，不得执行：

- `git add -A`
- `git commit`
- `git push`
- `gh repo` 操作
- GitHub Release
- 修改仓库可见性
- 上传构建产物

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
[ ] 真实系统能力已在 Windows 上验证（如适用）
[ ] HDR 插件未把 WCG/Advanced Color 误报为 HDR，且写入后重新读取状态（如适用）
[ ] CSS 有插件作用域并使用共享 Design Tokens
[ ] 960×640 和所有声明的 Widget 尺寸均可操作
[ ] README 已记录入口、权限、存储、测试和限制
[ ] 单插件类型检查与测试通过
[ ] plugin:validate、typecheck、lint、test 通过
[ ] .\toolcenter.cmd verify 通过
[ ] 已通过 .\toolcenter.cmd plugin-dev 在正式桌面壳中验收
[ ] 不含密钥、个人路径、隐私和未授权素材
[ ] 未经确认没有覆盖正式版、提交、推送或发布
```

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

先检查 Node.js、pnpm、Rust、Cargo、Tauri、Git 状态、插件 ID、宿主能力和现有插件结构。先向我报告环境结论、修改文件、入口、权限、是否需要宿主级变更及简短计划，然后在不涉及宿主级变更时直接开始开发。

本插件不是独立应用。不得创建新的 Tauri、Electron、独立 Web 应用、窗口、托盘、EXE、安装包或重复启动器。不得直接导入 @tauri-apps/*、apps/desktop 内部源码、其他插件源码或原始 Rust command。插件只能通过 @tool-center/plugin-contract 和 PluginContext 使用宿主能力。

默认只修改 plugins/<kebab-case-name>/、当前插件测试与 README，以及注册表生成工具自动更新的文件。如果必须修改 apps/desktop、src-tauri、plugin-contract、plugin-runtime、根依赖、构建配置、公共权限或其他插件，先说明原因、范围、风险、兼容性和回滚方法，等待我确认。

Manifest 必须静态无副作用，contributes 与入口一致，所有入口使用动态 import()，权限最小化。必须处理加载、空状态、权限拒绝、业务失败、异常和恢复。所有订阅、监听、Scheduler、Widget 实例和后台资源必须可以完整释放。

界面必须使用 ToolCenter 共享 UI Kit、Design Tokens 和正式图标。CSS 必须有插件作用域，不得覆盖 :root 或注入未审核的全局样式。适配 960×640 和所有声明的 Widget 尺寸，满足键盘、焦点、对比度和动态状态反馈要求。

Widget 必须支持多实例，以 instanceId 隔离业务数据；visible=false 时暂停非必要工作；位置、尺寸、显示器、锁定和层级交给宿主管理；portal 弹层标记 data-toolcenter-widget-region。

开发联调统一在项目根目录运行：
.\toolcenter.cmd plugin-dev

必须在真实 ToolCenter Tauri 桌面应用中验证插件管理、全部工具、搜索、页面或 Widget。浏览器页面、静态截图、Vitest 或内存桥不能代替原生能力验收。

完成前运行：
corepack pnpm --filter @tool-center/plugin-<name> typecheck
corepack pnpm --filter @tool-center/plugin-<name> test
.\toolcenter.cmd verify

涉及音频、文件、系统设置、进程、快捷键或其他真实系统能力时，必须在 Windows 上测试。任何会改变系统设置的操作，执行前提醒我并获得确认。

完成后汇报功能、修改文件、权限、测试、桌面验收、限制、宿主变更和安全风险。不要自行覆盖正式版，不要自行 git add -A、commit、push、创建 Release 或上传 EXE。

只有我明确确认后，才可以运行：
.\toolcenter.cmd release-build

现在先完成环境、项目结构和契约检查，再给出简短计划并开始开发。
```
