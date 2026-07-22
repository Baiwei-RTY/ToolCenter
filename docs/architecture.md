# 启动器功能架构

## 当前阶段

当前阶段建立一个模块化单体启动器：Tauri 负责窗口、桌面 Widget Host 和受控系统服务，React 负责主窗口与 Widget 界面，插件通过构建时生成的静态注册表接入，并在用户访问具体入口或恢复 Widget 实例时才加载业务代码。

```text
Tauri Core
├─ 设置与插件命名空间存储
├─ 权限记录和二次校验
├─ 日志与诊断
├─ Widget 实例、显示器和透明窗口区域管理
└─ Windows Core Audio 服务

Main WebView
├─ Launcher Shell
├─ Search / Command Palette
├─ Plugin Runtime
├─ Shared Scheduler / Event Bus
└─ Lazy Plugin Entrypoints

Widget Hosts（按显示器和显示层级复用）
├─ Shared React Root / Plugin Runtime
├─ 多个 Widget 实例
├─ 实例级生命周期、错误边界和资源账本
└─ 原生窗口区域裁切与桌面空白点击穿透

Audio COM Worker
├─ 复用 IMMDeviceEnumerator
├─ IMMNotificationClient 原生设备通知
├─ audio.read / audio.control 命令级权限校验
└─ 隔离的默认端点兼容层
```

## 关键决策

1. `plugin.manifest.ts` 可以在启动时读取，但不得执行副作用，也不得同步导入插件页面代码。
2. 生成工具自动维护注册表，启动器不手写插件导入列表。
3. 每个插件入口拥有独立运行实例和资源账本；Widget 进一步以稳定 `instanceId` 隔离多个实例，卸载或异常时由 Runtime 强制释放。
4. 插件通过 Plugin Context 使用系统能力，Rust 对持久化和权限操作再次校验。
5. Widget 不按实例创建 WebView。同一显示器、同一层级的多个 Widget 共享一个宿主；为了支持多显示器和每实例桌面层级，单个显示器最多存在“桌面层”和“始终置顶层”两个宿主 WebView。
6. Widget 位置保存为显示器 ID、工作区相对坐标、缩放比例、尺寸和最后有效位置。显示器失效时迁移到主显示器；分辨率和 DPI 改变时保持相对位置并重新裁切。
7. 透明宿主通过 Windows `SetWindowRgn` 只保留 Widget 与已声明弹层区域；拖动期间临时恢复完整窗口区域，结束后重新应用局部区域。
8. 音频查询和通知使用公开的 Windows Core Audio API。默认音频端点切换没有受支持的公开 API，因此未公开 `IPolicyConfig` 只存在于单独 Rust 兼容层，失败时返回结构化错误，不向插件暴露。

## 持久化位置

- 启动器设置：应用配置目录下 `app/settings.json`；
- 插件权限：应用配置目录下 `app/permissions.json`；
- Widget 实例：应用配置目录下 `app/widgets.json`；
- 插件业务数据：应用配置目录下按插件 ID 隔离。

以上路径由 Tauri 运行时解析，文档和插件不得硬编码用户本地绝对路径。
