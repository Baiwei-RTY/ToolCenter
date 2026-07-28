# 当前开发状态

## 已完成

- Tauri 2、React 19、TypeScript、Vite、pnpm 与 Cargo Monorepo；
- 单窗口、单 WebView 和自定义标题栏功能；
- 插件 Contract、构建时注册表、入口懒加载、生命周期和资源强制清理；
- 插件启停、排序、收藏、最近使用、运行状态、全局搜索和命令面板；
- 设置持久化、插件命名空间存储、权限记录、日志轮换和诊断；
- 插件创建、注册表生成和静态规则校验；
- 按设计交接稿完成标题栏、导航、核心页面、全局浮层、状态组件和 Design Tokens；
- 完成 1440×900 设计稿对照以及 1280×720、960×640 响应式验收；
- 使用自定义确认对话框承接插件权限申请和危险操作，替代浏览器原生确认框；
- 前端与 Rust 自动测试、Lint、Clippy 和发布模式构建。
- 共享桌面 Widget Host、Widget Manager、多实例生命周期、尺寸/锁定/层级/位置持久化和显示器迁移；
- Windows 透明宿主原生窗口区域裁切，实际 Widget 区域可交互、透明空白区域不占用桌面命中；
- `PluginContext.audio` 的输入/输出枚举、默认端点读取、原生设备变化通知和默认端点切换；
- `audio.read` 与 `audio.control` 的 Rust 命令级独立校验，以及独立 COM 工作线程和退出清理；
- 在当前 Windows 电脑上完成真实音频端点枚举和默认端点兼容接口探测（未改变系统默认设备）。
- `PluginContext.display` 的活动显示器枚举、HDR 支持/开关状态读取和指定显示器切换；
- `display.read` 与 `display.control` 的 Rust 命令级独立校验、不透明显示器 ID、写入前重验和写入后状态核对；
- 在当前 Windows 电脑上完成 DisplayConfig 活动目标和 HDR 状态的真实只读查询（未改变 HDR 设置）；
- 内置 `toolcenter.hdr-toggle` Widget 已接入插件中心，支持选择目标显示器、读取 HDR 状态以及按实例保存选择；
- `PluginContext.credentials` 已接入 Windows 凭据管理器，只提供写入、存在性检查与删除，前端无法读回明文；
- `PluginContext.network` 已接入共享 Rust HTTPS GET 服务，包含 `network.request` 二次校验、凭据头注入、超时、响应上限和本地目标拦截；
- 内置 `toolcenter.market-watch` Page + Widget 已接入插件中心，支持 Twelve Data 免费行情、Binance 公共数字资产期货、自选产品、60 秒可见刷新、折线 / K 线和 1 日 / 5 日 / 1 月切换；
- 已接入视觉交接 v1.0.2 的正式应用图标；
- 已建立固定 `正式版/ToolCenter.exe` 输出，以及插件直接进入真实 ToolCenter 桌面壳的开发命令。

## 等待后续设计输入

- 最终品牌字体和动画细节。

本轮视觉验收记录见项目根目录的 `design-qa.md`。

## 后续功能阶段

- 系统托盘和关闭到托盘行为；
- 全局快捷键；
- 自动更新；
- 完整任务服务与数据库服务；
- 安装包、签名和发布流程。

## 待进一步硬件和多显示器联调

当前已接入首个 Widget/音频插件，但以下场景仍需在实际硬件条件下继续完成端到端联调：

- 多 Widget 实例的拖动、菜单弹层区域、锁定、尺寸切换和重启恢复；
- 双屏或多屏、不同 DPI、拔出显示器和主显示器切换；
- 实际切换默认输出/输入并核对 Console、Multimedia、Communications 三个角色；
- USB 与蓝牙音频设备连接、断开和属性变化事件；
- HDR 与非 HDR 混合、多台同型号显示器、拓扑变化和远程桌面的显示能力降级；
- 经用户单独确认后，实际开启和关闭指定显示器 HDR 并核对 Windows 设置；
- 插件禁用、重载、权限拒绝和订阅取消后的资源清理。

默认端点切换依赖 Windows 未公开的 `IPolicyConfig` 兼容接口，未来 Windows 更新后需要重新执行兼容性测试。
