# ToolCenter 设计验收记录

## 当前复验：概览页图标与文字对齐

### 对照证据

- 用户反馈截图：`design-qa-artifacts/overview-alignment-user-before.png`，为 Windows 显示缩放下的 1905×1339 物理像素截屏；
- 浏览器实现截图：`design-qa-artifacts/overview-alignment-browser-after-1487x1058.jpg`，视口为 1487×1058 CSS px；
- 原生候选截图：`design-qa-artifacts/native-overview-alignment-after-1489x1060.jpg`，Tauri/WebView2 窗口为 1489×1060 px；
- 用户截图与原生候选同画布对照：`design-qa-artifacts/overview-alignment-before-vs-native-after.jpg`。由于原截图包含 Windows 显示缩放和桌面边缘，对照重点为侧栏、快速操作、空状态和卡片标题的相对位置，不进行原始像素差分。

### 修正前问题

- P2：快速操作卡片的标题区、70 px 操作项和内边距合计超过 142 px 容器的可用高度，图标与文字组合偏下并贴近底边；
- P2：侧栏图标宿主高度与标签间距偏大，图标和文字虽然处于同一列，但视觉上被拆成两组；
- P2：概览标题、欢迎信息、空状态和右上角操作链接缺少明确行高，WebView2 字体度量会产生 1–3 px 的基线漂移；
- P2：运行任务名称使用普通行内图标，动态内容出现时不能保证图标与文字垂直居中。

### 修正与复验结果

- 快速操作改为固定 60 px 双行网格，图标与标签均使用 20 px 盒模型、20 px 行高和 6 px 纵向间距；5 项图标/文字水平中心偏差均为 0 px，网格距卡片底部 17 px；
- 侧栏图标统一为 28×28 px，图标宿主高度收紧为 36 px，标签行高固定为 20 px；6 个入口的图标与标签水平中心偏差均为 0 px；
- 概览标题、欢迎信息、空状态、状态横幅和区域操作链接补齐明确行高，运行任务名称改为 `inline-flex` 垂直居中；
- 1487×1058 浏览器视口的 `scrollWidth` 与视口宽度一致，无横向溢出；控制台无 error，仅保留开发模式下 Lit 的既有提示；
- 1489×1060 原生候选中，侧栏、快速操作、收藏空状态、最近使用空状态、正在执行空状态和状态横幅均通过视觉复验；颜色、文案、功能入口与正式能力未改变；
- P0/P1/P2 未解决项：无。

**当前复验结果：passed**

---

## 当前复验：原生候选版与 Material 3 确认稿一致性修正

### 修正前证据

- 设计基准：`视觉稿件/ToolCenter-Material3-第二套紫色变体-v5/01.png`，1487×1058、浅色、市场行情选中；
- 原生候选截图：`design-qa-artifacts/native-candidate-before-tools-1202x802-dark.jpg`；
- 浏览器同尺寸截图：`design-qa-artifacts/browser-preview-current-1202x802-light.png`；
- 设计稿与当前实现同画布对照：`design-qa-artifacts/reference-vs-current-before-1487x1058.png`。

### 修正前问题

- P1：候选版继承旧设置后打开旧概览页和系统深色主题，与确认稿的 `/tools` 浅色首屏不同；
- P1：MDUI 深色主题类未启用，Shadow DOM 组件仍使用浅色前景令牌，出现黑字、按钮和背景混色；
- P1：候选默认窗口为 1200×800，确认稿为 1487×1058，触发整套 `<=1280px` 缩小规则并裁去 258px 内容高度；
- P2：MDUI Chip/Button 使用了无效尺寸变量和错误 Shadow Part，图标未使用官方 `icon` slot；
- P2：旧 `.tool-list` 的 `gap: 10px` 串入新插件中心，列表分隔与纵向位置偏移；
- P2：品牌、命令入口、页面、小组件和便签等图标与确认稿语义或轮廓不一致。

### 修正后证据

- 浏览器确认尺寸：`design-qa-artifacts/browser-after-final-1487x1058.png`；
- 浏览器紧凑尺寸：`design-qa-artifacts/browser-after-fix-1202x802-v2.png`；
- 浏览器深色插件中心：`design-qa-artifacts/browser-dark-theme-tools-1487x1058.png`；
- 原生候选程序：`design-qa-artifacts/native-candidate-after-final-1489x1060.jpg`；
- 设计稿与原生候选同画布对照：`design-qa-artifacts/reference-vs-native-after-1487x1058.jpg`。

### 修正结果

- P1：旧设置一次性迁移到 `/tools`、浅色主题和当前注册表顺序；插件启停、收藏、最近使用、权限、存储、Widget 与凭据不变；
- P1：文件夹候选构建使用独立应用标识与数据目录，测试前的原版设置已原样恢复；候选版不会再改写正式版或旧候选版的主题、首页与插件排序；
- P1：MDUI 浅色/深色主题类与启动器 Design Tokens 同步，深色插件中心和设置页均无错误前景色；
- P1：默认原生窗口改为 1487×1058 并居中；短高度窗口使用独立紧凑规则，不再裁切固定头部和底栏；
- P2：Chip/Button 使用真实 host 尺寸、`::part(button)` 与官方图标 slot，标签、圆角和图标基线对齐；
- P2：恢复 Noto Sans SC 首选字体，原生 WebView2 中文细笔画完整；MDUI rem 基准恢复 16px；
- P2：HDR、命令入口、页面、小组件、便签、主题模式等图标均改用匹配语义的官方 `@mdui/icons`；
- P2：原生候选、浏览器预览和设计稿的标题栏、导航轨、424px 主列表、详情头部、页签、内容边界与底栏位置一致；
- P0/P1/P2 未解决项：无。品牌盾牌内部字母没有对应的官方 Material 图标，继续使用最接近的官方盾牌轮廓，记录为 P3。

**当前复验结果：passed**

---

## 当前验收：Material 3 插件中心正式接入

### 验收基线

- 设计来源：`视觉稿件/ToolCenter-Material3-第二套紫色变体-v5/01.png`；
- 实现页面：`/tools`，浅色主题，市场行情插件选中，全部插件处于启用状态；
- 精确对照视口：1487×1058 CSS px，设备像素比 1；设计稿与实现截图均为 1487×1058 px；
- 完整同画布对照：`design-qa-artifacts/material3-plugin-center-comparison-full.png`；
- 标题栏、导航栏和插件列表局部对照：`design-qa-artifacts/material3-plugin-center-comparison-shell.png`；
- 实现截图：`design-qa-artifacts/material3-plugin-center-implementation-1487x1058.png`；
- 响应式复核：`design-qa-artifacts/material3-plugin-center-responsive-1280x720.png` 与 `design-qa-artifacts/material3-plugin-center-responsive-1024x720.png`，均无横向溢出或控件遮挡。

### 实现与设计对照

- 排版：标题栏、112 px 导航轨、424 px 插件主列表、详情头部、页签、内容和底部状态栏的分区边界与设计稿对齐；字体采用系统 UI 字体栈，字重存在不影响使用的 P3 级细微差异；
- 色彩：主色、容器色、描边、成功状态和悬停/选中状态均由 Material 3 Design Tokens 驱动，紫色系与设计稿一致；
- 图标：界面使用 `@mdui/icons` 的正式 Material 图标，不使用临时字符图标；设计稿中的品牌盾牌采用最接近的正式 Material 图标表达，属于可接受的 P3 差异；
- 内容：设计稿中的行情图表仅作为插件业务示意。正式插件中心改为展示真实清单、入口、运行时、权限、存储和实例信息，避免把市场行情业务复制进启动器；点击“打开页面”仍进入原有插件页面；
- 架构：保持单窗口、单 WebView；插件入口继续懒加载；启动器只通过现有运行时和 Rust 权限桥接能力工作，没有导入插件内部源码，也没有修改 `plugins/*`。

### 交互验证

- 选择插件、全部/页面/小组件/已启用筛选、搜索与清空均通过；
- 插件启用/停用真实写入应用状态并调用运行时，验证后已恢复启用状态；
- Page 插件可进入原有插件页面，Widget 插件可进入桌面实例页，Service 可进入运行状态页；
- 内容、权限、存储和诊断页签可读取真实数据；权限修改沿用现有确认对话框与 Rust 二次校验；
- 启动器路由计算值为 `--color-primary: #6750a4`，原插件页面容器计算值仍为 `#5b5fc7`，Widget Host 同样保留旧令牌；
- 浏览器控制台无 error；仅开发模式出现 Lit 的开发构建提示，生产构建不包含该提示。

### 修正记录

- 第 1 轮：发现旧样式使概览卡片跨越全部网格列，导致摘要区堆叠；已限定当前插件中心网格作用域；
- 第 2 轮：发现详情头部/底栏比例与设计稿有偏差且内容多出 22 px；已校准行高并仅展示非零贡献类型；
- 最终复核：内容区 `scrollHeight` 与 `clientHeight` 均为 621 px，1487×1058 下无非预期溢出。

**当前验收结果：passed**

---

## 历史验收：Light UI Kit 首轮实现

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

---

# 市场行情插件视觉验收

## 验收对象

- 设计来源：对话内确认的市场行情视觉方案；公开仓库不提交原始参考图
- 实现截图：`design-qa-artifacts/market-watch-implementation.png`
- 并排对照：`design-qa-artifacts/market-watch-comparison.png`
- K 线证据：`design-qa-artifacts/market-watch-kline.png`
- 设置页证据：`design-qa-artifacts/market-watch-settings-page.png`
- 响应式证据：`design-qa-artifacts/market-watch-medium-full.png`、`design-qa-artifacts/market-watch-small-full.png`
- 视口：Wide 520×220；同时复核 Medium 360×220、Small 260×160
- 密度：Windows 逻辑像素 1×，截图保持 CSS 尺寸
- 状态：AAPL、1 日、折线、可见、未锁定；浏览器模式使用明确标注的确定性演示数据

## 对照结论

- 信息结构与确认稿一致：左侧产品选择、价格、涨跌和状态；右侧图表类型、时间范围、刷新和价格图。
- Wide 左右比例、分隔线、圆角、边框、分段控件、主价格层级、绿色上涨语义和蓝紫色图表已对齐 ToolCenter Light UI Kit。
- 折线图与 K 线图均由真实 OHLC 数据结构渲染；“折线 / K 线”和“1 日 / 5 日 / 1 月”均已实际点击验证。
- 产品下拉已依次验证 AAPL、MSFT、EUR/USD 与 BTCUSDT；价格精度、涨跌方向、数据源标签和图表路径均随产品更新。5 日按钮状态与数据点数量同步更新。
- Medium 与 Small 的 `scrollWidth/clientWidth`、`scrollHeight/clientHeight` 均相等，无横向滚动、纵向溢出或控件裁切。
- 设置页使用现有页面 Shell 和 Design Tokens，API Key、权限、自选产品、默认产品和免责声明的层级清晰。
- 浏览器控制台最终无 warning/error。

## 修正记录

1. P1：Wide 主价格在收窄左栏后发生省略；已调整左栏安全间距和数字字号，`213.87 USD` 完整显示。
2. P2：演示时间最初按 UTC 偏移为 17:30–23:48；已改为本地交易时段，显示 09:30–15:48。
3. P2：Small 同时显示绝对涨幅和百分比时信息拥挤；已在 Small 保留百分比，在 Medium/Wide 保留两项。
4. P2：趋势方向只靠颜色表达；已加入“涨 / 跌”文本徽标，同时保留正负号和数值。
5. P1：BTCUSDT 的五位数价格与货币单位在 Wide 左栏发生省略；已按格式化价格长度降低数字字号，桌面壳复查可完整显示 `65,380.10 USDT`。
6. 未解决 P0/P1/P2：无。

## 功能与无障碍

- 产品选择使用原生 `select`；图表和时间范围使用具备 `aria-pressed` 的按钮组。
- 图表提供可访问名称，K 线节点包含开、高、低、收文本；刷新按钮具有明确名称。
- 权限申请、拒绝、未配置、空数据、不可用、错误、加载和成功状态均有文字说明和恢复入口。
- Reduced Motion 下关闭骨架动画；焦点轮廓使用共享 `--color-focus`。
- Widget 隐藏时不执行网络读取，周期任务由共享 Scheduler 管理并在卸载时释放。

## 公开数据源回归

- 设置页已加入 Twelve Data 公开演示与 Binance USDⓈ-M 免费期货说明，Wide 页面无横向溢出。
- 真实 Tauri 桌面壳已验证 `network.request` 权限与公开连接：AAPL 返回 `333.07 USD`（Twelve Data 公开演示），BTCUSDT 返回约 `65,400 USDT`（Binance USDⓈ-M，数值会随市场变化）。
- AAPL 与 BTCUSDT 的最新价、数据时间、数据源标签和折线形状均不同，确认产品切换不再复用同一条演示曲线。
- 小组件自选列表已显示 `BTCUSDT · 比特币永续`；折线图与 K 线图在浏览器真实组件中均完成点击回归，桌面 Widget Host 中完成真实行情与长价格布局复查。
- 刷新失败时保留最后成功快照并显示“离线缓存”；正常读取时显示“在线”。
- 更新后浏览器控制台无 warning/error，原 520×220 小组件视觉结构未变化。

final result: passed
