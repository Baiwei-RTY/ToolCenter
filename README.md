# ToolCenter

ToolCenter 是一个面向 Windows 10/11 的轻量化桌面工具启动器。项目采用 Tauri 2、React 19、TypeScript、Vite、pnpm workspace 与 Cargo workspace。

当前版本包含启动器本体、插件平台能力，以及随源码构建并通过校验的第一方插件；插件业务保持在各自 `plugins/<plugin-name>/` 中，不写入启动器公共层。桌面端主框架与插件中心使用已确认的紫色 Material 3 方案；市场行情插件使用独立的简约深色终端方案，桌面便签使用独立的暖纸便签方案。

## 当前功能范围

- 单主窗口启动器，以及按显示器和层级复用的共享桌面 Widget Host；
- 插件清单、自动注册表与懒加载；
- 插件生命周期、错误隔离和资源清理；
- 插件启用、禁用、排序、收藏与最近使用；
- 全局搜索与命令面板；
- 统一设置、权限、存储、日志和调度服务；
- 桌面小组件目录搜索、多实例管理、拖动排序、位置/尺寸/锁定/层级持久化和多显示器迁移；
- Windows 音频设备枚举、默认端点、原生变化通知和权限隔离；
- Windows 活动显示器枚举、HDR 状态读取、指定显示器切换和独立权限隔离；
- 通用只读 HTTPS 请求服务与 Windows 凭据管理器服务，敏感凭据不会返回插件前端；
- 内置 HDR 开关 Widget，可选择目标显示器并通过受权限保护的宿主能力切换 HDR；
- 内置市场行情 Page + Widget，支持 Twelve Data 股票/外汇、Kraken 公共现货与 Binance 公共数字资产期货、自选产品、按数据源节流的可见刷新、折线 / K 线、滚轮缩放和拖动平移；
- 内置暖纸桌面便签 Widget，支持独立标题、正文、清单拖动排序、上下分割线调节、顶部边缘拖动和按实例持久化；
- 紫色 Material 3 主框架与插件中心，可直接读取插件清单、启停状态、入口、权限、隔离存储和诊断数据；
- 概览、工具、插件管理、运行状态、设置、全局浮层和状态组件的正式界面；
- 插件创建、注册表生成和规则校验工具。

## 唯一正式版

项目只维护当前工作区这一套正式源码，固定交付目录为 `正式版/`。执行正式构建后会直接覆盖：

```text
正式版/
├─ ToolCenter.exe
├─ ToolCenter.exe.sha256
├─ 版本信息.json
└─ 使用说明.md
```

不再创建 `ToolCenter-v1.0.1/` 一类代码或程序副本。需要保留历史版本时使用 Git 提交和标签回退，不复制项目文件夹。

当前交付是供本机使用和插件联调的便携式正式开发版。安装器、代码签名和自动更新仍属于后续对外发布阶段。

## 在正式插件中心中开发插件

每个插件仍在独立对话中开发，但所有对话都打开本项目根目录，并只修改自己的 `plugins/<plugin-name>/`。开发联调时执行：

```powershell
.\toolcenter.cmd plugin-dev
```

该命令会在当前进程中补全 Node、pnpm 和 Cargo 的可执行路径，然后校验全部插件、重新生成插件注册表，再启动真实的 ToolCenter Tauri 桌面应用。它不会修改 Windows 系统 PATH。新增插件会直接出现在这个插件中心中，不需要为插件建立独立应用或浏览器预览项目。

插件开发完成并通过验收后执行：

```powershell
.\toolcenter.cmd release-build
```

命令会运行完整前端与 Rust 门禁、构建桌面程序，并覆盖 `正式版/ToolCenter.exe`。正式程序只包含随当前源码构建并通过校验的第一方插件，不会动态执行项目外的未知源码。

## 环境

- Windows 10/11 x64；
- Node.js 24 LTS；
- pnpm 11；
- Rust stable MSVC；
- Microsoft Visual C++ Build Tools；
- Windows SDK；
- Microsoft Edge WebView2 Runtime。

## 常用命令

```powershell
corepack pnpm install
corepack pnpm registry:generate
.\toolcenter.cmd plugin-dev
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm plugin:validate
corepack pnpm rust:check
corepack pnpm rust:test
.\toolcenter.cmd release-build
```

## 目录

```text
apps/desktop/               Tauri 桌面启动器
packages/plugin-contract/   插件公共契约
packages/plugin-runtime/    插件加载和生命周期运行时
plugins/                    独立插件目录
tooling/                    插件创建、注册表生成与校验工具
正式版/                     固定正式程序、校验值与使用说明
docs/                       架构和插件开发说明
```

插件开发要求见 [ToolCenter 插件开发规范（统一正式版）](docs/ToolCenter插件开发要求_统一版.md)。界面设计范围见 [启动器前端界面需求提要.md](启动器前端界面需求提要.md)。

设计实现验收见 [design-qa.md](design-qa.md)，当前开发进度见 [docs/development-status.md](docs/development-status.md)。

## Windows PATH 排查

安装依赖和启动 Tauri 前，建议分别确认 PowerShell 与 cmd 都能找到 Node 和 Cargo：

```powershell
node --version
cargo --version
cmd /c node --version
cmd /c cargo --version
```

如果 PowerShell 可用但 cmd 报找不到命令，请检查 Windows 用户或系统 PATH 中是否存在带多余引号的旧 Node 路径。修正 PATH 属于系统配置变更，应先备份原值。

## 开源许可

ToolCenter 源代码采用 [MIT License](LICENSE) 开放。启动器界面使用 MDUI 2 与 `@mdui/icons`，按 MIT License 使用，详情见 [MDUI 第三方许可说明](THIRD_PARTY_NOTICES/MDUI/NOTICE.md)。音频设备切换、HDR 开关和市场行情插件使用的部分 SVG 图标来自 Google Material Symbols；市场行情图表使用 Apache ECharts。二者均按 Apache License 2.0 使用，详情见 [Material Symbols 第三方许可说明](THIRD_PARTY_NOTICES/Material-Symbols/NOTICE.md)与 [Apache ECharts 第三方许可说明](THIRD_PARTY_NOTICES/ECharts/NOTICE.md)。番茄钟使用 `react-circular-progressbar` 绘制环形进度，按 MIT License 使用，详情见 [React Circular Progressbar 第三方许可说明](THIRD_PARTY_NOTICES/React-Circular-Progressbar/NOTICE.md)。

本地设计交接包、原始参考截图、构建产物和便携式 EXE 不进入源码仓库。可执行文件应通过 GitHub Releases 独立发布。
