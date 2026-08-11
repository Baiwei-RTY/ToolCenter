# ToolCenter 设计验收记录

## 当前验收：暖纸便签正式重构

### 基线与证据

- 设计来源：`design-previews/sticky-notes-warm-paper/design-qa-artifacts/reference-selected-concept-1.png`，1606×979；
- 正式实现截图：`plugins/sticky-notes/design-qa-artifacts/formal-medium.png`，360×220；
- 完整同画布对照：`plugins/sticky-notes/design-qa-artifacts/comparison-final.png`；
- 清单与工具栏局部对照：`plugins/sticky-notes/design-qa-artifacts/comparison-focus-final.png`；
- 响应式证据：`plugins/sticky-notes/design-qa-artifacts/formal-small.png` 与 `plugins/sticky-notes/design-qa-artifacts/formal-wide.png`；
- 用户错位反馈：`plugins/sticky-notes/design-qa-artifacts/alignment-user-before-empty.png` 与 `plugins/sticky-notes/design-qa-artifacts/alignment-user-before-one-item.png`；
- 对齐修正截图：`plugins/sticky-notes/design-qa-artifacts/alignment-after-450x262.png`；完整/局部同画布对照为 `plugins/sticky-notes/design-qa-artifacts/alignment-before-vs-after.png` 与 `plugins/sticky-notes/design-qa-artifacts/alignment-before-vs-after-focus.png`；
- 字体一致性复验：当前运行预览基准为 `plugins/sticky-notes/design-qa-artifacts/font-calibration-reference-current-run-complete.png`，按 450 px 宽度归一化后为 `font-calibration-reference-normalized-450.png`；修改前、修改后分别为 `font-calibration-before-450x262.png` 与 `font-calibration-after-450x262.png`，三者同画布对照为 `font-calibration-comparison.png`；
- Figma 标注板：`https://www.figma.com/design/Z9sjU6FbGvvGBIUmd0Rkbv?node-id=2-2`；本地渲染复验为 `plugins/sticky-notes/design-qa-artifacts/font-calibration-figma-board-rgb.png`；
- 浏览器视口：1280×720 CSS px；组件实际尺寸 360×220 CSS px；`devicePixelRatio` 为 2，但浏览器截图按 CSS 像素输出为 1×；设计稿按相同比例归一化为 360×220 后比较；
- 本轮对齐复验在同一 1280×720 CSS px 视口下使用 450×262 CSS px 组件、`devicePixelRatio: 2`；浏览器仍按 CSS 像素输出，状态为标题“本周安排”、单项清单“111”和“已保存”。
- 状态：标题“本周安排”、空正文、5 个清单项、第 3 项完成、保存成功、Medium 尺寸。

### 对照历史与修正

- 第 1 轮 P2：宿主按钮重置覆盖了未完成复选框边框，导致空复选框视觉消失；标题与清单左侧留白也小于视觉稿。已提高插件内复选框规则作用域，并按参考比例校准 24 px 主内容边距、18 px 顶部边距、分割线与工具栏边界；
- 第 1 轮 P2：标题获得焦点时继承宿主全局焦点外框，宿主控制条会干扰视觉稿。已为正文编辑区增加更高作用域的焦点规则，并把控制条限制为悬停或控制条自身焦点时显示；
- 第 2 轮 P2：百分比尺寸让原 `check` Web Component 计算为 7.6×20.4 px，完成勾选不稳定。已改用 `@mdui/icons` 的正式 `check-box` 与 `check-box-outline-blank` 图标，并使用确定尺寸；
- 第 3 轮 P2：用户实机截图显示 MDUI 图标的外盒虽已居中，但内部 SVG 受默认 24 px 行高影响，清单复选框下移 8 px，添加与保存图标下移 6 px。已将图标宿主行高归零；Small、Medium、Wide 三档复测中，图标 SVG 与相邻文字中心差均不超过 0.004 px；
- 第 3 轮交互补充：便签顶部圆角边框拖动热区随后按实机反馈扩大，Medium/Wide 为 19 px 高、Small 为 13 px 高并向两侧延伸；热区下边缘与标题输入框上沿相接，右边缘与控制条保留 2 px 间隔，锁定时不接收指针事件；
- 第 4 轮 P2：正式源码与预览均使用 `Microsoft YaHei UI` 优先的同一字体栈和 400 字重，但按 450 px 宽度归一化后，正式版标题/清单/添加/状态为 13/10/10/9 px，预览约为 14.7/11/10.5/9.8 px，因此产生“字体不同”的视觉感受。已将 Medium 校准为 14.5/11/10.5/10 px，并同步建立 Small 12/10/10/9 px、Wide 16/12/12/11 px 的响应比例；正文字号保持不变；
- 最终同画布与局部对照未发现可执行的 P0/P1/P2 差异。参考稿的生成式纸张颗粒比实现更明显；正式实现保留稳定的暖纸纯色与轻微阴影，记录为不影响层级和使用的 P3。

### 必查表面

- 字体与排版：使用 Windows 中文 UI 字体栈；标题、清单、工具栏字号、字重、行高和截断与归一化参考稿处于同一视觉层级；Figma 板内说明文字使用已验证可用的 `Noto Sans SC`，截图本身保留产品实际字体渲染；
- 间距与布局：圆角、内容边界、上部留白、分割线、5 行清单和底部工具栏位置已同画布核对；Small 通过滚轮浏览较长清单，Medium 与 Wide 可显示 5 行示例；
- 颜色与令牌：暖白纸面、深灰正文、琥珀完成态、灰褐分割线和保存状态与参考稿一致；
- 图像与图标：界面没有产品图片或品牌图；全部功能图标来自正式 `@mdui/icons`，没有字符图标、临时 SVG 或 CSS 图形；
- 文案：标题、示例清单、“添加清单项”和“已保存”与参考稿一致。

### 交互、响应式与可访问性

- 已实际验证标题、正文、添加、完成、取消完成、删除和自动保存；
- 已验证鼠标按住拖动清单排序，以及 `Alt + ↑/↓` 键盘排序；
- 已验证鼠标上下拖动分割线，以及方向键、`Home`、`End` 调整；
- 已验证 Small/Medium/Wide 顶部拖动热区分别为 188×13、338×19、488×19 CSS px，层级、抓取光标、标题/控制条避让和锁定保护均正确；宿主拖动判定继续由既有单元测试覆盖；
- Small 260×160、Medium 360×220、Wide 520×220 均无横向溢出；Small 清单滚轮从偏移 14 恢复至 0，滚动正常；
- 字号校准后重新添加单项清单并测量：三档根节点 `scrollWidth === clientWidth`、`scrollHeight === clientHeight`，添加入口与保存状态没有重叠；Small、Medium、Wide 的清单字号分别为 10、11、12 px；
- 复选框使用原生按钮与 `role="checkbox"`，分割线具有数值语义，焦点轮廓与 Reduced Motion 均保留；
- 三档正式 Host 预览控制台 error 均为 0。

final result: passed

---

# 桌面小组件实例设置菜单预览验收

## 验收对象

- 设计来源：对话内确认的桌面小组件管理页改进方案；
- 对照画布：`design-qa-artifacts/widgets-settings-qa-comparison.png`；
- 菜单状态：`design-qa-artifacts/widgets-settings-menu-1287x474.png`；
- 设置浮层：`design-qa-artifacts/widgets-settings-popover-1287x720.png`；
- 响应式复核：1287×720、1024×768、900×800；
- 实现分支：`codex/widgets-instance-settings-menu`，未覆盖 `正式版/`。

## 视觉与结构结论

- 实例行的图标、标题、说明、显示开关和三点按钮沿用当前 Material 3 页面节奏，未改变原有主列表结构；
- 原先常驻在列表下方的“实例设置”卡片已移除，页面不再因选中实例产生额外纵向区块；
- 三点菜单统一为“实例设置 / 重置位置 / 删除实例”，危险操作以分隔线和错误色独立呈现；无效的“打开插件设置”入口已删除；
- 实例设置使用锚定在三点按钮附近的浮动面板，包含尺寸、所在显示器、显示层级和锁定位置；可见状态只保留在实例行，避免同一操作重复出现；
- 顶部 `ToolCenter` 品牌区与“可用小组件”目录统一使用 `--tool-pane-width`；1487、1179、1024 和双栏临界宽度下右边界误差均为 0 px；
- 浮层圆角、描边、阴影、字号、图标和控件高度均复用当前 Design Tokens 与 `@mdui/icons`，没有新增临时图标、CSS 图形或全局样式。

## 交互与响应式

- 三点按钮可在菜单、设置浮层和关闭状态之间稳定切换；点击外部区域、按 Esc 或点击关闭按钮均可关闭；
- 尺寸、显示器、显示层级和锁定状态均调用原有真实 `widgetService.update` 并即时保存；锁定后尺寸和显示器控件正确禁用，解锁后恢复；
- 实例行显示开关、拖动排序以及 Alt + 方向键排序保持可用；排序后顺序真实持久化；
- 1024×768 与 900×800 下列表、菜单和设置浮层无横向溢出、控件重叠或不可点击区域；短窗口下浮层使用内部滚动；
- 960 px 及以下沿用既有上下堆叠布局，因此目录不再保留需要与标题栏对齐的右侧竖向分割线；
- 控件保留原生按钮、选择框、复选框语义及可访问名称，菜单、对话框、分隔线和展开状态可被辅助技术识别。

## 验证结果

- TypeScript 类型检查、ESLint、Stylelint、85 项前端单元测试和 5 个插件清单校验全部通过；
- Rust fmt、Clippy 和 22 项 Rust 单元测试全部通过；
- 浏览器控制台无 error；仅有 Vite 开发环境中的 Lit 开发模式提示，正式构建不包含该提示；
- 未解决 P0/P1/P2：无。

final result: passed

---

# 桌面小组件管理页 Material 3 重构验收

## 验收对象

- 视觉来源：`design-previews/widgets-management-material3/reference-option-1.png`（用户确认的第一套方案）。
- 正式开发版截图：`design-qa-artifacts/widgets-management-formal-final.png`。
- 同尺寸完整对照：`design-qa-artifacts/widgets-management-comparison-full.png`，左侧为视觉稿，右侧为正式开发版。
- 内容区归一化对照：`design-qa-artifacts/widgets-management-comparison-focus.png`，排除启动器共享侧栏与标题栏后比较页面本体。
- 状态：音频、HDR、番茄钟禁用；市场行情、桌面便签启用且各有一个实例；市场行情实例选中、显示、未锁定、宽尺寸、桌面层。

## 视觉对照结论

- 正式开发版保留 ToolCenter 既有单主窗口标题栏和主导航侧栏；这是启动器架构约束，不复制视觉稿中的独立标题栏。页面内容区仍保持“左侧可用目录 + 右侧桌面实例与设置”的双栏结构。
- 目录宽度、搜索框、100px 左右的目录卡、实例行、设置分组、底部主按钮、圆角、细描边和紫色选中态与视觉稿保持同一层级与节奏。
- 字体沿用启动器共享系统字体栈和 Material 3 字重，正文、辅助文字、状态标签和标题未出现裁切或重叠；窄窗口下文字保持单行省略或自然换行。
- 颜色全部复用现有 Design Tokens；禁用状态同时使用文字与弱化色，选中状态使用描边、底色和图标色，不只依赖单一颜色表达。
- 可见图标全部来自正式 `@mdui/icons` 图标库，没有自制 SVG、CSS 图形、Emoji 或占位图标。市场行情图标因使用真实 Material 图标库，比生图稿中的生成图形更简洁，但语义和光学尺寸一致。
- 页面没有图片类内容，因此不存在拉伸、压缩或透明边缘问题。

## 功能与状态回归

- 目录搜索可筛选名称与描述；禁用插件仍可查看，但“添加小组件”会禁用并提示先启用插件。
- 添加市场行情时完成真实权限确认流程；添加桌面便签后实例数量、目录计数和设置区均同步更新。
- 目录选择会同步选中该目录下已有的第一个实例，实例行选择与设置标题保持一致。
- 鼠标按住实例左侧手柄可上下拖动排序；`Alt + ↑/↓` 可作为键盘回退；新顺序通过统一 Widget 服务提交并由 Rust 校验后持久化。
- 尺寸、显示器、显示层级、可见性和锁定状态均使用真实实例接口；锁定后尺寸和显示器控件立即禁用，解锁后恢复。
- 更多菜单、外部点击关闭、Esc 关闭、重置位置、打开插件设置、删除确认与取消均完成交互检查。
- 空状态、权限对话框、成功通知、禁用状态和删除高风险确认均有明确文字反馈。

## 响应式与无障碍

- 1487×1058：与视觉稿同尺寸验收，双栏完整显示，无横向或纵向裁切。
- 1280×800 与 1024×768：保持双栏；1024 下文档 `scrollWidth === clientWidth`，目录与设置区无横向溢出。
- 900×800：页面自动改为上下堆叠，目录与桌面区各自保持完整宽度，文档无横向溢出。
- 搜索框、目录项、实例行、拖动手柄、开关、下拉框、折叠按钮和菜单均使用原生语义控件并提供可访问名称。
- 实例行的 Enter/Space 处理只在行本身获得焦点时触发，不再拦截子级开关和菜单的键盘输入；拖动手柄仍支持键盘排序。
- 开关的透明原生输入覆盖完整 48×28 轨道，保持焦点轮廓，并避免只有 1px 输入区域导致的命中不稳定。

## 修正记录

1. P1：共享开关原生输入原为 1×1px 且禁止指针事件，管理页命中不稳定；已在本页扩大到完整轨道并复测显示/隐藏、锁定/解锁。
2. P2：实例行最初会接管从子控件冒泡的 Enter/Space；已限制为仅处理行本身或拖动手柄，避免影响开关和菜单的键盘操作。
3. P2：目录选中态与已有实例设置可能不同步；已在选中目录时同步定位其已有实例。
4. P1：原服务没有持久化实例顺序；已增加浏览器与 Rust 两端的完整顺序校验、保存和 Widget Host 同步。
5. 未解决 P0/P1/P2：无。

final result: passed

---

## 当前验收：市场行情简约深色终端

### 基线与证据

- 设计来源：`design-previews/market-watch-dark-terminal/design-qa-artifacts/reference-selected-concept-2.png`，1928×815；
- 实现入口：`/plugin/toolcenter.market-watch/market-watch-settings`；
- 实现截图：`design-qa-artifacts/market-watch-formal-terminal-pass3-normalized.png`；
- 同画布对照：`design-qa-artifacts/market-watch-comparison-pass3-side-by-side.png`；
- 局部对照：`design-qa-artifacts/market-watch-comparison-pass3-header.png` 与 `design-qa-artifacts/market-watch-comparison-pass3-chart.png`；
- 浏览器验收视口：1666×1000 CSS px；终端实际区域 1482.4×626.625 CSS px，截图裁切后归一化为 1928×815；
- 状态：AAPL、折线、1 日、在线演示快照。真实 Tauri 环境改用当前市场数据，曲线路径与价格会自然变化。

### 对照与修正

- 第 1 轮发现外层宿主裁切、标题字号偏小、浏览器演示状态与参考稿不同，均已修正；
- 第 2 轮校准标题、报价、控制栏、坐标标签、交易时段文案、边框、渐变与图表占比；
- 第 3 轮修复按钮继承字体造成的产品名称字重偏差，并将演示曲线的价格范围对齐参考坐标；
- 终端边界、圆角、深色表面、顶部控制区、报价层级、蓝色图表、右侧坐标和底部交易时段与参考稿保持一致；
- 参考稿中的行情路径属于静态示例，正式版保留真实 OHLC 数据路径，不把静态曲线写入真实数据分支；
- P0/P1/P2 未解决项：无。截图格式转换造成的轻微文字抗锯齿差异及实时曲线路径变化记录为可接受的 P3。

### 功能、响应式与无障碍

- 已实际点击验证产品切换、折线 / K 线、1 日 / 5 日 / 1 月、刷新和设置面板；
- 已用鼠标滚轮验证时间窗口从 `0–64` 缩放为 `7–61`，再按住左键拖动为 `11–64`；按 `0` 恢复 `0–64`；
- 900×800 与 620×780 视口下页面和终端 `scrollWidth === clientWidth`，无横向溢出或控件重叠；
- 原生按钮、`aria-pressed`、图表 `role="application"`、可访问名称、键盘 `+/-/0/Home` 和焦点轮廓已覆盖；
- 产品选择已改为语义正确的 `menu/menuitemradio`；设置对话框具备焦点闭环、Esc 关闭和关闭后焦点恢复；
- 使用独立应用标识启动真实 Tauri 候选壳，确认插件按需加载、深色终端在原生 WebView2 中正常呈现，并正确进入“等待网络授权”状态；测试没有改写正式版设置；
- Kraken 公共 OHLC 端点实测 HTTP 200 并返回 721 行；当前网络对 Twelve Data 与 Binance 建连时出现 TLS 重置，因此这两个供应商的真实行情仍需在用户允许 `network.request` 且网络可达时复验；
- 浏览器控制台无应用错误；仅有 Vite/React 开发提示与 Lit 开发模式提示，生产构建不包含这些开发提示。

final result: passed

---

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
