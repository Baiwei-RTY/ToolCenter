# FlClash 控制插件

ToolCenter 第一方桌面 Widget，用于读取 FlClash ToolCenter 定制版的本机外部控制接口，启动或停止 FlClash 主代理，并快速切换代理节点。

## 功能范围

- 连接固定的定制版本机控制地址 `http://127.0.0.1:19090`；
- 显示外部控制连接状态、内核版本和 FlClash 主代理运行状态；
- 通过大号启动/停止按钮调用 FlClash 自带的“启动”全局快捷键，并核验定制版 `mixed-port` 是否实际监听；
- 根据当前出站模式和规则引用，只列出实际生效的 Mihomo `Selector` 代理组，并切换组内节点；
- 在每个节点选项末尾显示 FlClash 最近一次测速结果；无结果、不可用、自动选择与直连均显示明确状态；
- 使用与 ToolCenter 整体一致的 Material 3 紫色界面；代理组和节点均使用组件内菜单，避免 Windows 原生下拉框破坏圆角、配色和字号；
- 每个 Widget 实例单独记住上次选择的代理组；
- 通过 ToolCenter 共享 Scheduler 每 5 秒刷新一次，Widget 隐藏后立即释放；
- 支持 Medium、Wide 两档，默认 Medium（最小 360×220）。

本插件不会启动或结束 FlClash 进程，不会读取、修改或导出订阅、配置文件、密钥和账号信息，不会读写 Windows 系统代理，也不会自动开启 FlClash 的外部控制。

## 使用前准备

1. 启动 FlClash；
2. 在 FlClash 中打开“设置 → 高级设置 → 外部控制”；
3. 在 FlClash 的全局快捷键中，将“启动”设置为 `Ctrl+Alt+Shift+F12`；
4. 在 ToolCenter 中授权 `proxy.read`；
5. 首次启动、停止或切换节点时，再按需授权 `proxy.control`。

如果 FlClash ToolCenter 没有监听 `127.0.0.1:19090`，Widget 只显示安全的未连接状态。浏览器预览模式也不会模拟真实控制成功。

## 权限与安全边界

- `proxy.read`：读取固定本机控制接口的版本、`mixed-port`、代理组和当前节点，并从 Windows TCP 监听表判断主代理是否运行；
- `proxy.control`：切换已验证属于目标代理组的节点，或发送固定的 FlClash“启动”全局快捷键。

Rust 宿主层会再次校验权限、请求地址、代理组与节点的归属关系，并拒绝修改当前出站模式不会使用的代理组。快捷键发送后必须检测到 `mixed-port` 监听状态按目标变化，否则操作返回失败。

## 实现说明

- 插件只调用 `@tool-center/plugin-contract` 的 `proxyClient`、权限、存储、日志、通知和 Scheduler；
- 插件不导入 Tauri、Rust command、其他插件源码或 Windows API；
- 本机控制客户端拒绝重定向，连接超时 800 ms、总超时 3 s，响应上限 4 MiB；
- 主开关桥接只发送 `Ctrl+Alt+Shift+F12`，不读取或修改 FlClash 配置文件；
- 运行状态使用 Windows TCP 监听表读取，不通过连接代理端口制造空请求；
- 节点切换前会重新读取代理组，确认组和节点仍然有效；切换成功后只关闭经过该代理组的旧连接，让应用通过新节点自动重连，再次读取真实状态。
- 节点延迟直接复用 FlClash `/proxies` 返回的最近测速历史，不由 Widget 额外发起测速；数据随现有 5 秒状态刷新更新。

## 已知限制

- Mihomo 外部控制 API 不提供 FlClash 私有的 `startListener/stopListener` 动作，因此必须提前配置同一组全局快捷键；
- FlClash 与 ToolCenter 权限级别不一致，或快捷键被其他程序占用时，Windows 可能拒绝或改派快捷键；Widget 会因监听状态没有变化而报告失败；
- 当前版只支持 FlClash ToolCenter 定制版的无密钥本机外部控制模式，不允许自定义地址、远程地址或控制密钥；
- 只展示 `Selector` 类型代理组，不直接操作 `URLTest`、`Fallback` 等自动组；
- 主代理停止后必须保留外部控制监听，Widget 才能再次发送启动快捷键并核验状态；这是当前 FlClash 版本的运行行为，升级后需要重新联调。

## 开发与验证

在项目根目录运行：

```powershell
corepack pnpm registry:generate
corepack pnpm plugin:validate
corepack pnpm --filter @tool-center/plugin-flclash-controller typecheck
corepack pnpm --filter @tool-center/plugin-flclash-controller test
.\toolcenter.cmd verify
```

使用真实 ToolCenter 桌面壳联调：

```powershell
.\toolcenter.cmd plugin-dev
```

自动化测试不会发送真实快捷键；正式控制必须由用户在真实 Widget 中明确点击并通过权限确认。
