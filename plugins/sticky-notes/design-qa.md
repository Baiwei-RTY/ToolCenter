# 暖纸便签设计验收

## 证据

- 视觉真值：`../../design-previews/sticky-notes-warm-paper/design-qa-artifacts/reference-selected-concept-1.png`，1606×979；
- 正式实现：`design-qa-artifacts/formal-medium.png`，360×220；
- 完整对照：`design-qa-artifacts/comparison-final.png`；
- 局部对照：`design-qa-artifacts/comparison-focus-final.png`；
- 响应式：`design-qa-artifacts/formal-small.png`（260×160）与 `design-qa-artifacts/formal-wide.png`（520×220）；
- 用户错位反馈：`design-qa-artifacts/alignment-user-before-empty.png` 与 `design-qa-artifacts/alignment-user-before-one-item.png`；
- 对齐修正实现：`design-qa-artifacts/alignment-after-450x262.png`；
- 对齐修正完整/局部同画布对照：`design-qa-artifacts/alignment-before-vs-after.png` 与 `design-qa-artifacts/alignment-before-vs-after-focus.png`；
- 字体一致性复验：当前运行预览基准为 `design-qa-artifacts/font-calibration-reference-current-run-complete.png`，按 450 px 宽度归一化后为 `design-qa-artifacts/font-calibration-reference-normalized-450.png`；修改前、修改后分别为 `design-qa-artifacts/font-calibration-before-450x262.png` 与 `design-qa-artifacts/font-calibration-after-450x262.png`，同画布对照为 `design-qa-artifacts/font-calibration-comparison.png`；
- Figma 标注板：`https://www.figma.com/design/Z9sjU6FbGvvGBIUmd0Rkbv?node-id=2-2`；本地渲染复验为 `design-qa-artifacts/font-calibration-figma-board-rgb.png`；
- 浏览器视口：1280×720 CSS px；Medium 组件为 360×220 CSS px；设备像素比 2，截图按 CSS 像素归一化为 1×；
- 本轮对齐复验仍使用 1280×720 CSS px 视口，组件为 450×262 CSS px、设备像素比 2，浏览器截图按 450×262 CSS 像素输出；状态为标题“本周安排”、单项清单“111”和“已保存”。
- 状态：本周安排、空正文、5 项清单、第 3 项完成、已保存。

## Findings

- P0/P1/P2 未解决项：无。
- 第 1 轮已修复宿主按钮重置造成的空复选框消失、内容边距偏小、标题焦点外框和宿主控制条干扰。
- 第 2 轮已修复完成勾选图标百分比尺寸失真，改用正式 Material `check-box` 与 `check-box-outline-blank` 图标。
- 第 3 轮已修复 MDUI 图标内部 SVG 被默认 24 px 行高下推的问题：清单复选框原下移 8 px，底部添加和保存图标原下移 6 px；统一将图标宿主行高归零后，Small、Medium、Wide 三档的图标 SVG 与相邻文字中心差均不超过 0.004 px。
- 便签顶部透明拖动热区已扩大：Medium/Wide 为 19 px 高，Small 为 13 px 高，并向两侧扩展；热区下边缘恰好停在标题输入框上沿，右边缘与宿主控制条保持 2 px 间隔。它复用既有宿主拖动处理链，锁定时不接收指针事件。
- 已确认预览与正式源码使用相同的 Windows 中文 UI 字体栈和 400 字重；差异来自字号比例。按 450 px 宽度归一化后，预览标题/清单/添加/状态约为 14.7/11/10.5/9.8 px，而修改前正式实现为 13/10/10/9 px。现已校准为 Medium 14.5/11/10.5/10 px、Small 12/10/10/9 px、Wide 16/12/12/11 px，正文字号保持不变。
- P3：视觉稿带有轻微生成式纸张颗粒；正式实现使用稳定暖纸纯色与阴影，结构、层级和可读性不受影响。

## 必查表面

- 字体：Windows 中文 UI 字体栈；标题、清单和工具栏的字号、字重、行高与参考稿一致；Figma 板的说明文字使用已验证可用的 `Noto Sans SC`，截图保留产品实际字体；
- 间距：圆角、24 px 主边距、18 px 顶部边距、分割线、清单行和工具栏已同画布核对；
- 色彩：暖白、深灰、琥珀和灰褐语义一致；
- 图像与图标：无产品图片；全部功能图标使用 `@mdui/icons`；
- 文案：标题、示例清单、添加入口和保存状态与参考稿一致。

## 交互与响应式

- 已验证标题与正文编辑、添加、完成、取消完成、删除和自动保存；
- 已验证鼠标拖动与 `Alt + ↑/↓` 排序；
- 已验证鼠标拖动与键盘调节上下分割线；
- 已检查顶部拖动热区在 Small/Medium/Wide 下分别为 188×13、338×19、488×19 CSS px，均具有 `grab` 光标且不遮挡标题或右上角控制条；锁定分支沿用宿主既有拖动保护；
- Small 清单可滚轮浏览，三档尺寸无横向溢出；
- 字号校准后重新添加单项清单，Small、Medium、Wide 的根节点均无横纵向溢出，底部添加入口与保存状态无重叠；
- 三档预览控制台 error 均为 0。

## 真实桌面壳边界

- `.\toolcenter.cmd plugin-dev` 已成功启动真实 `target/debug/toolcenter-desktop.exe`；
- Windows 窗口捕获辅助器在重连后仍无法取得窗口状态，因此本报告不把真实 Tauri 重启持久化写成已验证；该缺口不影响已有浏览器同画布视觉结论，仍需人工桌面复验。

## Comparison history

1. Pass 1：发现空复选框消失、内容边距和焦点呈现偏差；修正 CSS 作用域与布局后复查。
2. Pass 2：发现完成勾选图标尺寸异常；切换为正式 Material 复选框图标后复查。
3. Pass 3：用户实机截图显示图标内部 SVG 与文字错位；归零图标行高并增加顶部拖动热区后，以 450×262 单项清单状态重新截取完整与局部同画布证据。
4. Pass 4：确认“字体不同”不是字体家族错误，而是正式实现相对预览缩小约 9–12%；校准三档标题、清单和底部状态字号，并建立当前运行截图与 Figma 对照板。
5. Final：DOM 盒模型、内部 SVG、三档溢出测量和同画布局部对照均无可执行 P0/P1/P2 差异。

final result: passed
