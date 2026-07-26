# 桌面便签

一个运行在 ToolCenter 共享 Widget Host 中的轻量便签插件，用于随手记录文字和管理少量待办事项。

## 当前功能

- 编辑纯文本便签并自动保存；
- 添加、完成/取消完成和删除待办；
- 已完成待办使用勾选状态和删除线共同表达；
- 支持 Small 260×160、Medium 360×220、Wide 520×220；
- 每个 Widget 实例独立保存内容；
- 提供加载、空数据、保存失败和重试状态；
- 键盘操作、可见标签、焦点轮廓和 Reduced Motion 支持。

## 明确不做

- 不提供富文本、Markdown、附件、图片或云同步；
- 不提供提醒、系统通知、全局快捷键或后台任务；
- 不在多个 Widget 实例之间共享内容；
- 不提供历史版本和误删恢复；
- 不创建独立窗口、WebView、Tauri 应用或后台进程。

## 插件信息

| 项目 | 内容 |
|---|---|
| 插件 ID | `toolcenter.sticky-notes` |
| 版本 | `0.1.0` |
| 最低宿主版本 | `0.1.0` |
| 入口 | Widget：`sticky-notes` |
| 默认尺寸 | Medium |
| 权限 | 无 |

## 数据与隐私

插件只通过 `context.storage` 保存本地 JSON，不访问网络、文件系统、剪贴板或其他系统能力。

- 存储 key：`widget.<instanceId>.v1`
- 数据版本：`schemaVersion: 1`
- 单个实例便签上限：4,000 字符
- 单个实例待办上限：50 项
- 单项待办上限：120 字符

数据由宿主按插件 ID 隔离；`instanceId` 进一步隔离不同小组件。日志只记录操作类型、实例 ID 和错误信息，不记录便签或待办正文。

## 懒加载与资源释放

- Manifest 只静态声明入口，Widget 组件通过动态 `import()` 加载；
- 未创建或未显示 Widget 时不加载业务组件；
- 只使用一次性防抖保存计时器，不创建 `setInterval`、Scheduler 或系统监听；
- 组件卸载时清理待执行计时器，并尝试提交最后一次尚未排队的修改。

## 运行与测试

在项目根目录执行：

```powershell
corepack pnpm --filter @tool-center/plugin-sticky-notes typecheck
corepack pnpm --filter @tool-center/plugin-sticky-notes test
.\toolcenter.cmd verify
.\toolcenter.cmd plugin-dev
```

桌面验收至少检查：

1. 从 Widget 管理页创建桌面便签；
2. Small、Medium 可切换便签和待办，Wide 同时显示两部分；
3. 输入便签后重新加载仍能恢复；
4. 添加待办后点击项目，文字出现删除线；再次点击可以取消完成；
5. 删除待办、锁定位置、隐藏、重新显示和创建第二个实例；
6. 两个实例的数据互不串扰；
7. 保存失败时显示错误并可以重试；
8. 插件禁用或 Widget 删除后没有残留计时器或界面。

## 已知限制

- Page 与 Widget 之间没有跨 WebView 的实时数据订阅，因此当前版本只提供 Widget；
- 浏览器 Memory Host 刷新后不会保留数据，持久化验收必须在真实 ToolCenter Tauri 桌面应用中进行；
- 当前版本不提供已删除待办恢复。

## 本轮修改与验收

- 新增 `plugins/sticky-notes/`，未修改 Rust、Plugin Contract、Plugin Runtime 或其他插件；
- 插件类型检查、单元测试、ESLint、Stylelint 和插件清单校验均通过；
- `.\toolcenter.cmd verify` 通过：前端共 9 个测试文件、33 项测试，Rust 共 16 项测试；
- `pnpm build:web` 通过；便签 Widget 产物约为 JS 8.04 kB、CSS 7.55 kB，低于 200 kB 单入口目标；
- 已在真实 ToolCenter Tauri 桌面应用中验证中尺寸 Widget：创建实例、便签自动保存、应用重启后恢复、添加待办、键盘完成待办以及完成文字删除线均正常；
- Small 与 Wide 已完成清单声明、独立样式分支和构建校验，但本轮桌面自动化未稳定捕获透明 Widget Host，仍建议在正式发布前人工切换确认一次布局；
- 未执行发布、Git 提交或推送。
