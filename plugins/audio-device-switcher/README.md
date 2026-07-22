# 音频设备切换插件

ToolCenter 第一方插件，用于查看并切换 Windows 默认音频输出设备。

## 功能范围

- 仅读取和显示音频输出设备，不读取或显示麦克风。
- 每次切换同时设置 `console`、`multimedia`、`communications` 三种 Windows 默认角色。
- 提供启动器内管理页面，以及 Small、Medium、Wide 三档桌面 Widget；默认使用 Small（260×160）。
- 监听系统音频设备变化，不使用轮询；页面或 Widget 卸载时释放订阅。
- 覆盖读取权限、控制权限、无设备、设备断开、宿主不可用、系统不支持和切换失败状态。

## 权限

- `audio.read`：列出输出设备并读取当前默认输出。
- `audio.control`：把用户选择的输出设备设为三个 Windows 默认角色。

权限提示由前端说明用途，最终仍由 ToolCenter 的 Rust 权限层校验。

## 开发与验证

在项目根目录运行：

```powershell
corepack pnpm registry:generate
corepack pnpm plugin:validate
corepack pnpm --filter @tool-center/plugin-audio-device-switcher typecheck
corepack pnpm --filter @tool-center/plugin-audio-device-switcher test
```

浏览器开发模式没有真实 Windows 音频设备，因此只能验证权限、空状态和界面。真实设备枚举与切换需要在 Tauri 桌面应用中测试；测试切换会改变 Windows 当前默认输出设备。

## 资源来源

界面使用 `ToolCenter-视觉交接-v1.0.2` 中已批准的 SVG 图标，资源保留原文件内容，样式使用启动器共享 Design Tokens。
