# 番茄钟

一个运行在 ToolCenter 共享 Widget Host 中的轻量番茄钟，用于在桌面进行可恢复的专注与休息计时。

## 功能范围

- 默认提供 25 分钟专注和 5 分钟休息；
- 专注与休息时长都可以由用户手动设置为 1～180 分钟的整数；
- 修改时长后重置当前阶段，但不会自动开始；
- 支持开始、暂停、继续、重置和手动切换专注/休息阶段；
- 专注完成后播放升调提示音、记录完成轮数，并自动开始休息；
- 休息完成后播放降调提示音，并停下等待用户开始下一轮专注；
- 使用绝对结束时间计算剩余时间，电脑睡眠或 ToolCenter 重启后不会从旧显示值继续倒数；
- 支持 Small 260×160、Medium 360×220、Wide 520×220 三档 Widget；
- 每个 Widget 实例独立保存时长、阶段、运行状态和完成轮数；
- 提供加载、读取失败、保存失败、暂停和完成状态；
- 支持键盘、可见焦点、`aria-live` 完成提示和 Reduced Motion。

## 明确不做

- 不提供 Windows 系统通知、全局快捷键、系统托盘或开机自启；完成提示音仅在当前 Widget WebView 内播放；
- ToolCenter 完全退出时不会在后台执行代码，也无法在完成时弹出提醒；
- Widget 被隐藏或宿主暂停时不保持前端调度；重新显示后会根据保存的绝对结束时间校正状态；
- 不自动开始下一轮专注；休息完成后必须由用户主动开始；
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
3. 点击滑杆图标，分别输入专注和休息分钟数后保存。
4. 点击“开始专注”或“开始休息”启动倒计时。
5. 运行期间可以暂停；暂停后可以继续、重置、切换阶段或修改时长。
6. 专注完成后会响起升调提示音并自动开始休息；休息完成后会响起降调提示音并停下，等待下一轮专注。

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
- 应用退出后不执行插件代码；重新启动或恢复显示时按绝对结束时间校正。若专注已结束但休息尚未结束，会恢复为正在休息；若两段都已结束，会恢复为休息完成。

## 视觉与无障碍

- 使用语义化 HTML、插件作用域 CSS 和宿主公开 Design Tokens；
- 不导入 `apps/desktop` 内部组件，不覆盖 `:root` 或全局元素样式；
- 使用 ToolCenter 已采用的 `@mdui/icons` 紫色 Material 图标，并使用 `react-circular-progressbar` 绘制环形进度；二者均为 MIT License，许可文本已保留在项目 `THIRD_PARTY_NOTICES/`；
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

## 本轮验收结果（2026-08-11）

- 番茄钟插件类型检查通过，模型单元测试 11/11 通过；
- Wide 520×220、Medium 360×220、Small 260×160 已在真实 Widget Host 组件中完成浏览器视觉复核，无横向或纵向溢出；
- 已验证设置弹窗、开始、倒计时推进、暂停、继续和重置；自动休息、整段休眠恢复与完成提示音触发条件由模型测试覆盖；
- 真实 Tauri 桌面壳已验证番茄钟实例创建、显示、开始、倒计时推进、暂停、重置、设置弹窗与取消；联调后已恢复插件原启用状态并隐藏测试实例；
- 全量插件校验通过，共识别并校验 5 个插件；前端 22 个测试文件、90/90 测试通过，TypeScript、ESLint、Stylelint 均通过；
- Rust `fmt`、`clippy -D warnings` 与 22/22 测试通过；`build:web` 通过，番茄钟独立懒加载产物为 JS 19.67 kB（gzip 6.78 kB）和 CSS 14.54 kB（gzip 2.88 kB）。
- 2026-08-11 经用户确认执行 `release-build`，已覆盖唯一 `正式版/ToolCenter.exe`；正式程序启动与番茄钟插件注册状态复核通过，插件详情显示“运行环境就绪”。

桌面验收至少检查：

1. 三档尺寸都能完成开始、暂停、继续、重置和设置时长；
2. 专注与休息时长接受 1 和 180 的边界值，拒绝空值、小数和越界值；
3. 修改时长后当前阶段复位且不会自动开始；
4. 两个 Widget 实例的时长、阶段和完成轮数互不串扰；
5. 运行中隐藏再显示、电脑睡眠恢复和 ToolCenter 重启后剩余时间正确；
6. 专注完成只增加一次完成轮数、播放升调提示音并自动开始休息；休息完成播放降调提示音并停下；
7. Widget 锁定、解锁、调整尺寸、删除和插件禁用后没有残留 Scheduler；
8. 键盘焦点、长中文、100%～200% DPI 和 Reduced Motion 可用。

## 已知限制

- `PluginContext.notifications`、热键、后台任务和 Service 当前不可用，因此没有系统级完成提醒；
- Widget Host 没有跨 WebView 通知转发，`ui.notify` 不能作为可靠的番茄钟提醒；
- 提示音使用浏览器标准 Web Audio API；首次必须由用户点击开始以解锁音频。Widget 不可见、ToolCenter 已退出或系统静音时不能保证听到提示音；
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
│  ├─ pomodoro-sound.ts
│  ├─ styles.css
│  ├─ use-pomodoro.ts
│  └─ widgets.ts
└─ tests/
   └─ pomodoro-model.test.ts
```
