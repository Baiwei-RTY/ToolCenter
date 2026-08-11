# HDR 开关插件

ToolCenter 第一方桌面 Widget，用于查看并切换指定 Windows 显示器的 HDR 状态。

## 功能范围

- 枚举当前 Windows 本地桌面会话中的活动显示器；
- 显示显示器名称、Windows 显示源、主显示器标记和 HDR 状态；
- 选择并记住每个 Widget 实例自己的目标显示器；
- 开启或关闭指定显示器的 Windows HDR；
- 切换后重新读取真实状态；
- 支持 Small、Medium、Wide 三档 Widget，默认 Small（最小 260×160）；
- 在 160 px 紧凑高度下将目标屏幕选择与 HDR 操作按钮保持在同一行，避免按钮被裁切；
- 覆盖加载、无显示器、权限拒绝、HDR 不支持、目标断开、拓扑变化和切换失败状态；
- Widget 隐藏时不读取显示器、不轮询、不创建后台任务。

本插件不调整亮度、色温、分辨率、刷新率、缩放、SDR 内容亮度、Auto HDR 或颜色配置文件，也不会自动控制失效目标之外的其他显示器。

## 插件信息

- 插件 ID：`toolcenter.hdr-toggle`
- 包名：`@tool-center/plugin-hdr-toggle`
- 版本：`0.1.0`
- 最低宿主版本：`0.1.0`
- 入口：Widget `display-hdr-toggle`

## 权限

- `display.read`：列出活动显示器并读取 HDR 支持和开关状态；
- `display.control`：开启或关闭用户当前选择的显示器 HDR。

插件在操作前说明用途，最终由 ToolCenter Rust 命令层再次校验。插件不使用 PowerShell、Shell、注册表、外部 EXE、原始 Rust command 或插件内 Windows API。

## 存储

每个 Widget 实例使用：

```text
widget-<instanceId>-display-id
```

该值只保存宿主提供的不透明显示器 ID。插件不解析或拼接 ID。如果保存的目标已经失效，Widget 会要求用户重新选择，不会自动切换到另一台显示器。

数据版本：`1`。当前只有一个字符串值，不需要迁移。

## 资源与释放

- 不注册显示器变化订阅；
- 不创建 Scheduler、`setInterval`、后台线程或隐藏窗口；
- Widget 重新显示、用户手动刷新或切换完成时才读取状态；
- 没有需要手动释放的长期资源；
- Widget 删除后只保留该实例的目标选择记录，不包含硬件原始 ID、凭据或个人信息。

## 开发与验证

在项目根目录运行：

```powershell
corepack pnpm registry:generate
corepack pnpm plugin:validate
corepack pnpm --filter @tool-center/plugin-hdr-toggle typecheck
corepack pnpm --filter @tool-center/plugin-hdr-toggle test
.\toolcenter.cmd verify
```

使用真实 ToolCenter 桌面壳联调：

```powershell
.\toolcenter.cmd plugin-dev
```

浏览器模式不会模拟 HDR 成功，只能验证权限、加载、错误和纯界面状态。真实切换会改变 Windows 显示设置，执行前必须提醒用户并获得确认。

## 真实 Windows 验收

- 单屏和多屏枚举；
- 同型号显示器可区分；
- HDR 与非 HDR 显示器不会混淆；
- 读取和控制权限分别允许、拒绝和恢复；
- 只改变明确选择的显示器；
- 开启和关闭后状态与 Windows 设置一致；
- 其他显示器不受影响；
- 目标断开、拓扑变化、远程会话和驱动拒绝时安全失败；
- Widget 多实例、三档尺寸、隐藏、锁定、删除和插件禁用后无残留资源。

## 正式资源

Widget 使用 `ToolCenter-视觉交接-v1.0.2` 中已批准的显示器、刷新、权限、错误和成功 SVG 图标，样式仅使用 ToolCenter Design Tokens。图标来自 Google Material Symbols，按 Apache License 2.0 使用；许可记录见项目 `THIRD_PARTY_NOTICES/Material-Symbols/NOTICE.md`。

## 已知限制

- 首版没有显示器变化事件订阅；显示器连接变化后需要手动刷新；
- 宿主无法可靠区分 HDR 与其他 Advanced Color 状态时，插件会显示错误而不是猜测；
- 当前没有独立设置页面，目标选择和错误恢复均在 Widget 内完成；
- 正式 HDR 写入验收必须在目标 Windows 机器上人工确认。
