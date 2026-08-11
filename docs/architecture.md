# 启动器功能架构

## 当前阶段

当前阶段建立一个模块化单体启动器：Tauri 负责窗口、桌面 Widget Host 和受控系统服务，React 负责主窗口与 Widget 界面，插件通过构建时生成的静态注册表接入，并在用户访问具体入口或恢复 Widget 实例时才加载业务代码。

```text
Tauri Core
├─ 设置与插件命名空间存储
├─ 权限记录和二次校验
├─ 日志与诊断
├─ Widget 实例、显示器和透明窗口区域管理
├─ Windows 凭据管理器与受控 HTTPS GET 服务
├─ Windows Core Audio 服务
└─ Windows DisplayConfig HDR 服务

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

DisplayConfig HDR Service
├─ 按调用枚举当前活动显示路径
├─ 使用独立不透明 ID 标识 HDR 控制目标
├─ display.read / display.control 命令级权限校验
└─ 写入前重新验证目标，写入后重新读取真实状态

Credential / HTTPS Service
├─ 按插件 ID 和逻辑 key 隔离 Windows 通用凭据
├─ 前端只可写入、检查存在和删除，不能读取明文
├─ network.request 在 Rust 命令层再次校验
├─ 允许免凭据公开请求或由 Rust 注入安全凭据
└─ 仅允许公开域名的 HTTPS GET，并限制端口、重定向、超时和响应大小
```

## 关键决策

1. `plugin.manifest.ts` 可以在启动时读取，但不得执行副作用，也不得同步导入插件页面代码。
2. 生成工具自动维护注册表，启动器不手写插件导入列表。
3. 每个插件入口拥有独立运行实例和资源账本；Widget 进一步以稳定 `instanceId` 隔离多个实例，卸载或异常时由 Runtime 强制释放。
4. 插件通过 Plugin Context 使用系统能力，Rust 对持久化和权限操作再次校验。
5. Widget 不按实例创建 WebView。同一显示器、同一层级的多个 Widget 共享一个宿主；为了支持多显示器和每实例桌面层级，单个显示器最多存在“桌面层”和“始终置顶层”两个宿主 WebView。
6. Widget 实例顺序与位置一并持久化；管理页提交的新顺序必须完整覆盖当前实例 ID，Rust 在保存前校验数量、去重和集合一致性。位置保存为显示器 ID、工作区相对坐标、缩放比例、尺寸和最后有效位置。显示器失效时迁移到主显示器；分辨率和 DPI 改变时保持相对位置并重新裁切。
7. 透明宿主通过 Windows `SetWindowRgn` 只保留 Widget 与已声明弹层区域；Widget 顶部栏除锁定、隐藏等操作按钮外均可按住拖动，锁定后禁止拖动；拖动期间临时恢复完整窗口区域，结束后重新应用局部区域。
8. 音频查询和通知使用公开的 Windows Core Audio API。默认音频端点切换没有受支持的公开 API，因此未公开 `IPolicyConfig` 只存在于单独 Rust 兼容层，失败时返回结构化错误，不向插件暴露。
9. HDR 使用 Windows CCD/DisplayConfig API。Windows 11 使用独立 HDR 状态，Windows 10 只在旧接口能够可靠表示 HDR 时降级；无法区分 HDR 与其他 Advanced Color 状态时返回结构化错误。Display 服务不缓存目标、不轮询，也不复用 Widget Manager 的显示器 ID。
10. 敏感 API Key 不进入插件 JSON。插件通过 `context.credentials` 保存逻辑凭据引用，请求时由 `context.network` 对应的 Rust 服务读取并注入 Authorization 头；插件 JavaScript 和日志都不接收明文回读。

## 持久化位置

- 启动器设置：应用配置目录下 `app/settings.json`；
- 插件权限：应用配置目录下 `app/permissions.json`；
- Widget 实例：应用配置目录下 `app/widgets.json`；
- 插件业务数据：应用配置目录下按插件 ID 隔离。
- 插件敏感凭据：Windows 凭据管理器中按 `ToolCenter/<pluginId>/<key>` 隔离。

以上路径由 Tauri 运行时解析，文档和插件不得硬编码用户本地绝对路径。
