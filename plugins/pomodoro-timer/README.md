# 番茄钟

一个运行在 ToolCenter 共享 Widget Host 中的轻量番茄钟，用于在桌面进行可恢复的专注与休息计时。

## 功能范围

- 默认提供 25 分钟专注和 5 分钟休息；
- 专注与休息时长都可以由用户手动设置为 1～180 分钟的整数；
- 修改时长后重置当前阶段，但不会自动开始；
- 支持开始、暂停、继续、重置和手动切换专注/休息阶段；
- 专注完成后记录完成轮数，并等待用户主动开始休息；
- 休息完成后等待用户主动开始下一轮专注；
- 使用绝对结束时间计算剩余时间，电脑睡眠或 ToolCenter 重启后不会从旧显示值继续倒数；
- 支持 Small 260×160、Medium 360×220、Wide 520×220 三档 Widget；
- 每个 Widget 实例独立保存时长、阶段、运行状态和完成轮数；
- 提供加载、读取失败、保存失败、暂停和完成状态；
- 支持键盘、可见焦点、`aria-live` 完成提示和 Reduced Motion。

## 明确不做

- 不提供 Windows 系统通知、提示音、全局快捷键、系统托盘或开机自启；
- ToolCenter 完全退出时不会在后台执行代码，也无法在完成时弹出提醒；
- Widget 被隐藏或宿主暂停时不保持前端调度；重新显示后会根据保存的绝对结束时间校正状态；
- 不自动开始下一阶段，避免在用户离开时继续产生无人确认的计时；
- 不提供任务清单、统计报表、云同步、账号或跨设备同步；
- 不创建独立窗口、WebView、Tauri 应用、后台进程或长期 `setInterval`。

## 插件信息

| 项目 | 内容 |
|---|---|
| 插件 ID | `toolcenter.pomodoro-timer` |
| 包名 | `@tool-center/plugin-pomodoro-timer` |
| 版本 | `0.1.0` |
| 最低宿主版本 | `0.1.0` |
| 入口 | Widget：`pomodoro-timer` |
| 默认尺寸 | Medium |
| 权限 | 无 |

Manifest 与 Widget 入口分别通过动态 `import()` 和 React `lazy()` 加载。未创建或未显示 Widget 时不会加载业务组件。

## 使用方法

1. 在 ToolCenter 的“桌面小组件”页面添加“番茄钟”实例。
2. 使用“专注”和“休息”按钮选择当前阶段。
3. 点击“时长”，分别输入专注和休息分钟数后保存。
4. 点击“开始专注”或“开始休息”启动倒计时。
5. 运行期间可以暂停；暂停后可以继续、重置、切换阶段或修改时长。
6. 当前阶段完成后，Widget 显示完成状态，由用户主动开始下一阶段。

## 数据与隐私

插件只通过 `context.storage` 保存本地 JSON，不访问网络、文件系统、剪贴板、设备、系统通知或其他系统能力。

- 存储 key：`widget.<instanceId>.v1`
- 数据版本：`schemaVersion: 1`
- 保存字段：专注/休息分钟数、当前阶段、计时状态、剩余毫秒、绝对结束时间、已完成专注轮数
- 不保存任务内容、账号、设备标识、路径、密钥或其他个人信息

宿主先按插件 ID 隔离存储，插件再通过 `instanceId` 隔离不同 Widget 实例。日志只记录操作类型、实例 ID 和错误信息，不记录个人内容。

## 调度、恢复与资源释放

- 仅在 Widget 可见且正在运行时向共享 Scheduler 注册一个 500 ms 调度任务；
- 不使用长期 `setInterval`、后台 Service、隐藏窗口或独立线程；
- 每次显示只根据 `endAt` 与当前时间计算剩余时间，不依赖调度回调次数保证准确性；
- Widget 隐藏、删除、插件禁用或组件卸载时释放 Scheduler；
- 状态改变时立即写入存储，不进行每 500 ms 的存储写入；
- Scheduler 连续失败时接受宿主停止调度，并显示可恢复错误；
- 应用退出后不执行插件代码；重新启动后若结束时间已经过去，会恢复为完成状态。

## 视觉与无障碍

- 使用语义化 HTML、插件作用域 CSS 和宿主公开 Design Tokens；
- 不导入 `apps/desktop` 内部组件，不覆盖 `:root` 或全局元素样式；
- 当前界面不使用第三方图片、字体或图标，因此没有新增许可证；
- 阶段和状态同时使用文字、选中容器和 `aria-pressed` 表达，不只依赖颜色；
- 主要控件点击区域至少为 36×36 px；
- 核心操作可以通过键盘完成，动态完成状态通过 `aria-live` 提示；
- Reduced Motion 下取消非必要动画。

## 开发与验证

在项目根目录运行：

```powershell
corepack pnpm --filter @tool-center/plugin-pomodoro-timer typecheck
corepack pnpm --filter @tool-center/plugin-pomodoro-timer test
corepack pnpm plugin:validate
.\toolcenter.cmd verify
```

使用真实 ToolCenter 桌面壳联调：

```powershell
.\toolcenter.cmd plugin-dev
```

## 本轮验收结果（2026-07-26）

- 番茄钟插件类型检查通过，模型单元测试 8/8 通过；
- `plugin:validate` 验证 3 个已注册插件全部通过；
- `.\toolcenter.cmd verify` 全量通过：前端 10 个测试文件共 39/39，Rust 16/16，TypeScript、ESLint、Stylelint、`cargo fmt` 和严格 `clippy -D warnings` 均无错误；
- Web 生产构建通过，番茄钟保持独立懒加载分包：JavaScript 10.27 kB（gzip 3.51 kB），CSS 6.41 kB（gzip 1.48 kB）；
- `plugin-dev` 成功启动真实 Tauri 开发壳，并在桌面小组件管理页识别到番茄钟清单；
- 隔离的本地交互验收实际覆盖了自定义 1/2 分钟、开始、倒计时推进、暂停、继续、完成一次只计一轮、进入休息、重置、多实例隔离，以及 Small/Medium/Wide 三档布局；控制台无错误或警告；
- 本机同时运行正式版 ToolCenter 时，自动化工具无法稳定激活开发壳 WebView，因此没有自动点击真实桌面 Widget Host。测试没有关闭或修改正式版进程与数据；正式桌面拖动、跨显示器、DPI 和睡眠恢复仍应在合并后人工复核。

桌面验收至少检查：

1. 三档尺寸都能完成开始、暂停、继续、重置和设置时长；
2. 专注与休息时长接受 1 和 180 的边界值，拒绝空值、小数和越界值；
3. 修改时长后当前阶段复位且不会自动开始；
4. 两个 Widget 实例的时长、阶段和完成轮数互不串扰；
5. 运行中隐藏再显示、电脑睡眠恢复和 ToolCenter 重启后剩余时间正确；
6. 专注完成只增加一次完成轮数，并进入“等待开始休息”状态；
7. Widget 锁定、解锁、调整尺寸、删除和插件禁用后没有残留 Scheduler；
8. 键盘焦点、长中文、100%～200% DPI 和 Reduced Motion 可用。

## 已知限制

- `PluginContext.notifications`、热键、后台任务和 Service 当前不可用，因此没有系统级完成提醒；
- Widget Host 没有跨 WebView 通知转发，`ui.notify` 不能作为可靠的番茄钟提醒；
- 当前只提供 Widget，不提供独立 Page；多个实例之间不会共享设置或统计；
- 当前完成轮数只记录本地累计值，不提供按日期统计或历史迁移；
- Widget Host 自身的拖动、显示层级和正式 13 状态验收属于宿主范围，插件不能通过私有接口旁路实现。

## 本轮文件

```text
plugins/pomodoro-timer/
├─ plugin.manifest.ts
├─ package.json
├─ tsconfig.json
├─ README.md
├─ src/
│  ├─ PomodoroWidget.tsx
│  ├─ pomodoro-model.ts
│  ├─ styles.css
│  ├─ use-pomodoro.ts
│  └─ widgets.ts
└─ tests/
   └─ pomodoro-model.test.ts
```
