# ToolCenter 设计验收记录

## 验收范围

- 设计来源：`设计交接/02-即时设计导出/PNG/` 的 11 张 1440×900 画板；
- 核心对照：概览、设置、全局搜索浮层；
- 组件与状态参考：Foundations、Controls、Cards & Lists、States、Overlays；
- 实现环境：Tauri 2、React 19、Windows WebView2；
- 响应式验证：1440×900、1280×720、960×640。

## 对照证据

- `design-qa-artifacts/overview-comparison.png`：概览设计稿与实现并排对照；
- `design-qa-artifacts/settings-comparison.png`：设置设计稿与实现并排对照；
- `design-qa-artifacts/palette-comparison.png`：全局浮层设计稿与实现并排对照；
- `design-qa-artifacts/responsive-960x640.png`：最小验收视口截图；
- `design-qa-artifacts/` 中保留了对应实现截图，便于后续回归。

## 验收结论

- 信息结构、标题栏、侧栏、卡片栅格、设置分组、全局浮层位置与尺寸均与交接稿一致；
- 页面使用真实运行时数据。当前插件注册表为空，因此概览和工具页展示设计好的空状态，不伪造插件数据；
- 搜索、命令面板、页面导航、设置分类、开关、选择框、侧栏折叠和危险操作确认均可交互；
- 键盘焦点、可访问名称、Esc 关闭、方向键选择、Enter 执行和减少动态效果均已覆盖；
- 控制台最终检查无 warning/error；
- 960×640 下侧栏自动收起，内容可滚动，标题栏图标完整，无遮挡或横向溢出。

## 已解决问题

- P1：设置稿的“常规”状态同时呈现启动行为与外观分组，实现已对齐；
- P2：全局搜索浮层的顶部位置和高度已对齐；
- P2：小窗口下命令图标与品牌图标被响应式选择器隐藏，已修复；
- P0：无；
- 未解决的 P1/P2：无。

品牌 Logo、安装包图标和完整深色主题不在本次交接成品范围内，继续保留为后续设计输入项。

result: passed

---

# 音频设备切换插件设计验收

## 验收范围

- 插件 Page：权限说明、空设备、默认角色、输出设备列表、切换中、成功与失败恢复。
- 桌面 Widget：Small 260×160、Medium 360×220、Wide 520×220，包含设备菜单与锁定状态。
- 功能边界：仅处理音频输出设备；不读取、不显示、不切换麦克风。

## 对照来源

- `ToolCenter-视觉交接-v1.0.2/07-Plugin-Audio/Page/audio-page-default@2x.png`
- `ToolCenter-视觉交接-v1.0.2/07-Plugin-Audio/Widget/audio-widgets@2x.png`
- `ToolCenter-视觉交接-v1.0.2/07-Plugin-Audio/States/audio-state-matrix@2x.png`
- `ToolCenter-视觉交接-v1.0.2/06-Widget-Templates/Widget实现说明.md`
- 启动器现有 Design Tokens、页面 Shell 与 Widget Host。

## 已完成的对照与修正

1. Page 使用启动器现有 Shell 与共享 Token；标题、说明、权限入口、状态卡、圆角、边框和主色与 v1.0.2 保持一致。原设计中的输入设备区域根据本次明确需求删除，页面只保留输出设备与三个默认角色。
2. Widget 使用 260×160、360×220、520×220 三档宿主尺寸及安全区，采用正式 SVG 图标；Small 保留当前输出和快速切换，Medium/Wide 增加可用输出设备快捷项。
3. 初次对照发现 Widget 标题语义偏离设计稿，已统一为“音频设备”，设备副标题明确为“默认输出 · 常规 / 媒体 / 通信”。
4. 初次运行发现 React 严格模式会让正在懒加载的 Page/Widget 被宿主提前释放。已在 Page 与 Widget 宿主挂载计数中延迟实际释放，复查后不再出现“加载期间已释放”。
5. 权限对话框、无设备恢复、设备菜单、成功反馈、三档布局和锁定/解锁状态均完成实际交互检查；页面与 Widget 控制台无错误或警告。

## 可访问性与稳定性

- 核心操作均使用原生按钮，具备可读名称、禁用状态和键盘焦点轮廓。
- 状态同时使用图标、文字和颜色，不只依赖颜色表达。
- 装饰图标使用空替代文本，动态错误使用 `role="alert"`，普通状态使用 `role="status"`。
- 设备名称使用单行省略与 `title`，长名称不会挤压操作按钮。
- 没有全局样式注入、长期定时器、隐藏窗口或插件自行创建的后台任务。

## 验证说明

- 浏览器模式使用真实组件和实际 Widget Host，以本地模拟输出设备验证视觉与交互；浏览器宿主本身不提供 Windows 音频设备。
- Rust 测试已只读枚举本机真实 Windows 音频端点并通过。
- 为避免未经确认改变用户当前系统设置，本轮没有在真实硬件上执行默认输出切换；正式切换路径已由单元测试确认一次调用同时传入 `console`、`multimedia`、`communications` 三种角色。

final result: passed
