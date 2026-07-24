# ToolCenter 插件直接接入正式插件中心——开发对话提示词

## 使用方法

1. 为每个插件创建一个单独的 Codex/ChatGPT 开发对话。
2. 让该对话打开当前 ToolCenter 项目根目录。
3. 复制下面的完整提示词作为首条消息。
4. 替换所有 `<尖括号占位内容>`。

## 可复制提示词

```text
你现在正在 ToolCenter 项目中开发一个第一方内置插件。

请先确认当前工作目录是 ToolCenter 项目根目录，并且根目录中存在 AGENTS.md、README.md、apps/、packages/ 和 plugins/。

插件信息：
- 插件显示名称：<插件名称>
- 插件目录名称：<kebab-case-name>
- 插件 ID：toolcenter.<stable-id>
- 插件目标：<一句话说明插件功能>
- 入口类型：<Page / Widget / Action，可多选>
- 预计权限：<暂不确定可以填写“根据实际功能最小化声明”>

一、开始前必须检查

先阅读：

1. AGENTS.md
2. README.md
3. docs/ToolCenter插件开发规范_v1.0.md
4. packages/plugin-contract/src/
5. packages/plugin-runtime/src/
6. plugins/ 下已有插件的结构
7. 当前插件的 README、package.json 和 plugin.manifest.ts（如果已经存在）

检查当前电脑的 Node.js、pnpm、Rust、Cargo 和 Tauri 开发环境是否可用，并检查 Git 工作区状态。

先向我汇报：

- 当前环境是否满足开发要求；
- 准备修改哪些文件；
- 插件需要哪些入口和权限；
- 是否需要修改启动器本体或公共契约；
- 简短实施计划。

完成检查后，在不涉及宿主级变更的情况下直接开始开发，不要停留在计划阶段。

二、插件开发边界

本插件是 ToolCenter 内部插件，不是独立应用。

必须遵守：

- 插件只能放在 plugins/<kebab-case-name>/；
- 不得创建独立 Tauri、Electron、Web 应用、EXE、安装包、托盘程序或重复启动器；
- 不得为插件长期运行单独的浏览器开发服务器；
- 插件必须通过 @tool-center/plugin-contract 和 PluginContext 接入；
- 不得直接导入 @tauri-apps/*；
- 不得直接导入 apps/desktop 内部源码；
- 不得调用原始 Rust command；
- 不得导入其他插件的内部源码；
- 不得绕过 Rust 权限层访问系统能力；
- 不得手动修改 plugin-registry.generated.ts；
- 不得动态加载项目目录外的未知代码；
- 不得在插件中保存密码、Token、API Key、Cookie、个人路径或其他敏感信息。

默认只允许修改：

- plugins/<kebab-case-name>/；
- 该插件自己的测试和 README；
- 注册表生成工具自动更新的文件。

如果必须修改以下内容，先说明原因、影响范围、兼容性风险和回滚方式，等待我确认后再修改：

- apps/desktop/
- apps/desktop/src-tauri/
- packages/plugin-contract/
- packages/plugin-runtime/
- 根 package.json、Cargo.toml 或构建配置
- 公共权限、UI Kit、Design Tokens
- 其他插件

三、功能实现要求

插件必须具有：

- 独立 package.json；
- plugin.manifest.ts；
- README.md；
- TypeScript 配置；
- 对应入口；
- 必要的单元测试；
- 加载、空状态、权限拒绝、业务失败和异常状态；
- 资源释放和卸载流程。

Manifest 必须：

- 使用稳定且唯一的插件 ID；
- contribution 与实际入口保持一致；
- Page、Widget、Action 分别动态 import；
- 只声明实际使用的最小权限；
- 不得产生顶层副作用。

生命周期要求：

- 所有事件订阅、系统监听、快捷键和后台任务都必须释放；
- 不得自行创建长期 setInterval；
- 周期任务使用共享 Scheduler；
- deactivate、dispose、stop 和释放函数必须可以重复调用；
- 插件禁用、重载、页面退出和发生异常后不得残留资源；
- 单个插件异常不得导致 ToolCenter 退出。

四、界面要求

插件必须使用 ToolCenter 共享 UI、Design Tokens 和现有视觉规范。

不得：

- 注入未经审核的全局样式；
- 覆盖 :root 或宿主 Design Tokens；
- 复制启动器标题栏、侧栏或设置页面；
- 使用 Emoji、ASCII 字符或临时手绘图标代替正式图标；
- 创建与 ToolCenter 无关的独立视觉体系。

插件样式必须具有插件作用域，并适配 ToolCenter 窗口和对应 Widget 尺寸。

如果正式素材不足，先使用语义清晰的文本或已有共享资源，并记录缺少的素材，不要擅自设计新的品牌风格。

五、Widget 插件附加要求

如果插件包含 Widget：

- 支持的尺寸必须在 Manifest 中声明；
- defaultSize 必须包含在 supportedSizes 中；
- 每个 Widget 实例使用独立 instanceId；
- 不得使用模块全局变量保存实例专属数据；
- 业务数据使用 instanceId 组成独立存储 key；
- visible=false 时暂停不必要的刷新和订阅；
- locked=true 时不得引发误拖动或误操作；
- 位置、尺寸、显示器、层级和锁定状态由 ToolCenter 管理；
- 不得自行创建桌面窗口；
- portal 菜单或弹层必须按规范标记 Widget 交互区域；
- 必须验证多实例、隐藏、锁定、尺寸切换、位置恢复和卸载清理。

六、权限和系统能力

所有权限必须遵循：

前端说明用途
→ 用户决定
→ PluginContext 调用
→ Rust 权限层再次验证
→ 返回结果或安全降级

权限被拒绝时，插件必须显示可恢复状态，不得崩溃或绕过权限。

如果当前 ToolCenter 没有提供插件所需的系统能力：

1. 不得自行绕过宿主实现；
2. 记录缺失能力；
3. 说明建议增加的 Plugin Contract、Rust 服务和权限；
4. 等待我确认是否扩展启动器本体。

七、直接接入正式插件中心

插件开发过程中统一在项目根目录运行：

.\toolcenter.cmd plugin-dev

这条命令会：

1. 校验全部插件；
2. 重新生成插件注册表；
3. 启动真实的 ToolCenter Tauri 桌面应用；
4. 将当前插件直接接入插件中心；
5. 使用真实 Plugin Runtime、Rust 权限层和共享 UI；
6. 支持开发期间热更新。

开发和验收必须在这个独立桌面应用中进行。

不得用以下方式代替正式插件中心验收：

- 普通浏览器页面；
- 独立 Web 演示站；
- 单独启动的插件应用；
- 只有静态截图；
- 只有 Vitest 模拟环境；
- 只有浏览器内存桥测试。

八、测试流程

开发过程中至少运行：

corepack pnpm --filter @tool-center/plugin-<name> typecheck
corepack pnpm --filter @tool-center/plugin-<name> test
corepack pnpm plugin:validate
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test

完成前运行：

.\toolcenter.cmd verify

并在真实 ToolCenter 桌面应用中验证：

- 插件可以在插件中心显示；
- 插件可以启用、禁用和重新加载；
- Page、Action 或 Widget 入口可以正常打开；
- 权限允许和拒绝路径正常；
- 空状态、错误状态和恢复操作正常；
- 插件异常不会导致启动器退出；
- 插件禁用或卸载后没有残留监听和后台任务；
- README、Manifest、实现和测试保持一致。

如果涉及音频、文件、快捷键、系统设置、进程或其他真实系统能力，还必须在 Windows 电脑上做实际验证。任何会改变系统设置的测试，执行前先提醒我并获得确认。

九、正式版更新

开发完成后先向我汇报：

- 已完成的功能；
- 修改的文件；
- 使用的权限；
- 测试结果；
- 桌面应用验收结果；
- 已知限制；
- 是否修改了宿主或公共契约；
- 是否发现敏感信息或发布风险。

不要自行覆盖正式版，也不要自行提交或推送 GitHub。

只有我明确确认后，才可以运行：

.\toolcenter.cmd release-build

该命令会执行完整门禁、构建 ToolCenter，并覆盖：

正式版/ToolCenter.exe

正式版更新后不得创建新的版本文件夹。历史版本通过 Git 提交和标签管理。

十、GitHub 与安全要求

ToolCenter 是公开源码项目。开发完成前必须检查：

- API Key、Token、密码、Cookie 和私钥；
- .env 和本地配置文件；
- 用户名、学校信息和个人绝对路径；
- 日志、数据库和运行数据；
- 构建产物和临时文件；
- 第三方素材、字体、图标和许可证；
- 不应该公开的参考截图或设计交接文件。

不得自行执行：

- git add -A
- git commit
- git push
- gh repo 操作
- GitHub Release
- 修改仓库可见性
- 上传正式 EXE

除非我在当前对话中明确授权。

现在请先检查环境、项目结构、现有规范和插件契约，然后给出简短计划并开始开发。
```
