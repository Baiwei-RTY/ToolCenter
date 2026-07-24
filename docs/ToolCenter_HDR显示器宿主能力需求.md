# ToolCenter HDR 显示器宿主能力需求

## 文档信息

| 项目 | 内容 |
|---|---|
| 文档编号 | TC-HOST-DISPLAY-HDR-001 |
| 版本 | 1.0 |
| 状态 | 宿主能力已实现，待真实 HDR 切换与多显示器验收 |
| 更新日期 | 2026-07-24 |
| 适用宿主 | ToolCenter 0.1.x |
| 目标平台 | Windows 10/11 x64 |
| 需求来源 | HDR 桌面 Widget 插件开发前置检查 |

## 1. 背景与阻塞原因

计划开发一个 ToolCenter 桌面 Widget，用于：

1. 枚举当前 Windows 会话中的活动显示器；
2. 让用户指定目标显示器；
3. 查看目标显示器是否支持 HDR，以及 HDR 当前是否开启；
4. 开启或关闭指定显示器的 Windows HDR 功能；
5. 在显示器断开、权限拒绝或系统不支持时提供可恢复错误。

提出本需求时，宿主只开放了 `audio` 和基础 `system.getSummary()` 等能力，没有显示器枚举、HDR 状态读取和 HDR 切换服务。插件规范禁止插件直接调用 Tauri、原始 Rust command、PowerShell、外部 EXE 或 Windows API，因此该插件此前无法合规实现。

本需求属于宿主公共能力扩展。宿主完成本需求前，不应通过通用命令执行、Shell 调用或插件内部原生代码进行旁路实现。

## 2. 实现前证据与当前结果

以下是实施前检查到的缺口：

- `packages/plugin-contract/src/services.ts`：`PluginContext` 没有显示器服务；
- `packages/plugin-contract/src/manifest.ts`：没有 `display.read` 和 `display.control` 权限；
- `packages/plugin-runtime/src/context.ts`：没有显示器命令桥接；
- `apps/desktop/src-tauri/src/lib.rs`：没有注册显示器或 HDR 相关 Tauri command；
- `apps/desktop/src-tauri/src/services/`：没有显示器 HDR 服务；
- 现有 Widget Manager 的显示器信息用于 Widget Host 定位，不能直接替代 Windows DisplayConfig 的显示目标标识。

截至 2026-07-24，宿主已完成：

- `PluginContext.display`、`DisplaySummary` 和 `DisplayService`；
- `display.read`、`display.control` 及 Rust 命令层二次校验；
- `display_targets_list`、`display_hdr_set` Runtime 桥接；
- Windows DisplayConfig 活动目标枚举、Windows 11 HDR 专用状态和 Windows 10 受限降级；
- 独立不透明显示器 ID、写入前重新验证和写入后状态核对；
- 浏览器模式明确不可用、TypeScript/Rust 测试和公共规范同步；
- 本机真实 Windows 活动显示器与 HDR 状态只读验证。

尚未执行会改变系统设置的真实 HDR 开关，以及多显示器、同型号双屏、远程桌面和热插拔全量验收。

## 3. 目标

宿主需要提供最小、专用、受权限保护的 `DisplayService`，使受信任第一方插件可以：

- 读取活动显示器列表；
- 区分多个同型号显示器；
- 读取每个显示器的 HDR 支持状态和当前开关状态；
- 对指定显示器设置 HDR 开关；
- 在 Rust 层重新验证插件权限和显示器标识；
- 返回结构化、可恢复的错误；
- 在操作成功后返回或重新读取真实系统状态。

## 4. 非目标

本轮宿主扩展不包含：

- 亮度、色温、分辨率、刷新率、缩放比例或颜色配置文件调整；
- HDR 校准、SDR 内容亮度调节或 Auto HDR；
- 显示器布局、主显示器切换、复制/扩展模式切换；
- 后台常驻轮询、隐藏窗口或独立系统服务；
- 通用 PowerShell、Shell、进程执行或任意原始 command；
- 跨远程桌面会话控制；
- 插件专属窗口、托盘程序、EXE 或安装包；
- 将 Widget Manager 的显示器 ID 强行复用为 Windows DisplayConfig 目标 ID。

后续如需增加上述能力，应单独设计权限、契约和验收范围。

## 5. 公共契约要求

### 5.1 建议类型

在 `packages/plugin-contract/src/services.ts` 中新增：

```ts
export interface DisplaySummary {
  /** 宿主生成的不透明标识；插件不得解析、拼接或推断其格式。 */
  readonly id: string;

  /** 面向用户的显示器名称；无法获取 EDID 友好名称时提供稳定降级名称。 */
  readonly name: string;

  /** Windows 显示源名称，用于区分同型号显示器，例如“显示器 1”。 */
  readonly sourceName: string;

  /** 当前是否为主显示器。 */
  readonly primary: boolean;

  /** 当前显示路径是否支持 Windows HDR。 */
  readonly hdrSupported: boolean;

  /** Windows HDR 当前是否开启。 */
  readonly hdrEnabled: boolean;
}

export interface DisplayService {
  listDisplays(): Promise<readonly DisplaySummary[]>;
  setHdrEnabled(displayId: string, enabled: boolean): Promise<void>;
}
```

并在 `PluginContext` 中新增：

```ts
readonly display: DisplayService;
```

### 5.2 最小接口原则

- 暂不增加独立 `getDisplay()`：`listDisplays()` 已能覆盖初始读取和操作后刷新；
- 暂不增加显示变化订阅：首版由插件在首次显示、用户手动刷新和切换完成后重新读取；
- 不向插件公开 Windows `LUID`、target ID 等可被自行拼接的原始操作参数；
- 不开放通用显示设置接口；
- 不把 Widget 位置管理和 HDR 系统目标混入同一服务。

## 6. 权限模型

新增两个最小权限：

| 权限 | 用途 |
|---|---|
| `display.read` | 枚举活动显示器，读取名称、主显示器标记及 HDR 状态 |
| `display.control` | 开启或关闭指定显示器的 Windows HDR |

要求：

1. Manifest 必须显式声明插件实际使用的权限；
2. 插件调用前通过 `context.permissions` 向用户说明用途；
3. Rust 读取命令必须再次检查 `display.read`；
4. Rust 写入命令必须再次检查 `display.control`；
5. `display.read` 不得隐式获得控制能力；
6. `display.control` 不得变成通用系统设置或通用命令权限；
7. 默认不申请 `administrator.request`，除非真实目标系统验证表明 Windows API 明确需要提升权限；
8. 权限拒绝必须返回可识别错误，不能静默降级为成功。

## 7. Runtime 与宿主桥接

### 7.1 建议桥接命令

| 命令 | 参数 | 返回值 | Rust 权限 |
|---|---|---|---|
| `display_targets_list` | `pluginId` | `DisplaySummary[]` | `display.read` |
| `display_hdr_set` | `pluginId`, `displayId`, `enabled` | `void` | `display.control` |

`packages/plugin-runtime/src/context.ts` 应把命令封装为 `context.display`，插件不得直接看到或调用这些命令名。

### 7.2 浏览器开发降级

非 Tauri 浏览器环境不得模拟真实 HDR 成功。允许：

- 返回“宿主能力不可用”的结构化错误；
- 在测试中注入内存桥接结果；
- 验证插件的加载、权限拒绝、空状态和错误状态。

浏览器模拟和 Vitest 不能替代真实 Windows HDR 操作验收。

## 8. Windows 原生实现要求

### 8.1 活动显示器枚举

建议使用 Windows CCD/DisplayConfig API：

1. `GetDisplayConfigBufferSizes` 获取缓冲区大小；
2. `QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS | QDC_VIRTUAL_MODE_AWARE)` 获取活动显示路径；
3. 如果返回 `ERROR_INSUFFICIENT_BUFFER`，重新获取大小并重试；
4. 使用 `DisplayConfigGetDeviceInfo` 和 `DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME` 获取目标友好名称；
5. 获取可区分显示器的显示源名称；
6. 只返回当前桌面会话中的活动显示目标；
7. 对复制模式、同型号显示器和显示器热插拔进行真实验证。

### 8.2 HDR 状态读取

对每个活动路径使用其 adapter ID 和 target ID 查询 Advanced Color/HDR 信息。

实现时必须注意：Windows 的 “Advanced Color” 是 HDR、WCG 和高位深能力的总称。Windows 11 22H2 及更高版本还可能为特定 SDR 显示器启用 Advanced Color/自动颜色管理。因此不得在没有区分颜色模式的情况下，把所有 `advancedColorSupported` 都直接展示成“支持 HDR”。

最低要求：

- `hdrSupported` 必须表示该目标可使用 Windows HDR，而不是泛化的 Advanced Color；
- `hdrEnabled` 必须与 Windows 设置中的“使用 HDR”状态一致；
- 如果当前 SDK/API 只能可靠判断 Advanced Color、无法可靠区分 HDR 与 SDR Advanced Color，应返回明确的“不确定/不支持”错误，不能误报；
- 在 Windows 10 与 Windows 11 目标版本上分别验证；
- 对驱动不支持、远程会话和非活动目标返回结构化错误。

### 8.3 HDR 状态写入

建议基于：

- `DISPLAYCONFIG_DEVICE_INFO_SET_ADVANCED_COLOR_STATE`；
- `DisplayConfigSetDeviceInfo`。

写入流程：

```text
验证 pluginId 与 display.control
→ 重新枚举当前活动显示路径
→ 解析并验证宿主生成的 displayId
→ 确认目标仍存在且支持 HDR
→ 调用 Windows API 设置状态
→ 重新读取该目标真实状态
→ 状态一致时返回成功，否则返回失败
```

禁止：

- 直接信任前端保存的 adapter ID 或 target ID；
- 对已断开的显示器继续使用缓存句柄；
- 先返回成功再异步执行切换；
- 使用 PowerShell、注册表猜测、快捷键模拟或打开 Windows 设置页替代真实设置；
- 把 Windows API 错误统一吞掉并返回空数组。

## 9. 显示器标识设计

`DisplaySummary.id` 必须是宿主管理的不透明标识。

要求：

- 插件只能原样保存和回传；
- Rust 层每次写入前重新验证该 ID 是否对应当前活动路径；
- 不把未经验证的字符串直接转换成 Windows 操作参数；
- 显示器拔出、拓扑变化或 ID 失效时返回 `display.target-unavailable`；
- 插件保存的首选显示器失效后，可以让用户重新选择，但不得自动控制另一个显示器；
- 同型号显示器必须能通过 `sourceName` 或等价宿主标签区分。

如果宿主使用编码后的 adapter ID 与 target ID 生成 ID，也必须把编码格式视为宿主内部实现，不写入公共契约。

## 10. 错误模型

建议至少提供以下错误码：

| 错误码 | 场景 | recoverable |
|---|---|---|
| `display.permission-denied` | 插件缺少读取或控制权限 | `true` |
| `display.unavailable` | 当前平台或宿主不提供显示能力 | `false` |
| `display.no-active-target` | 没有活动显示目标 | `true` |
| `display.target-unavailable` | 目标已断开、停用或 ID 失效 | `true` |
| `display.hdr-unsupported` | 目标不支持 Windows HDR | `true` |
| `display.hdr-state-unknown` | 无法可靠区分 HDR 与其他 Advanced Color 状态 | `true` |
| `display.access-denied` | 当前进程无权访问控制台桌面或处于远程会话 | `true` |
| `display.topology-changed` | 枚举与操作期间显示拓扑发生变化 | `true` |
| `display.hdr-set-failed` | Windows 或驱动拒绝设置 | `true` |
| `display.hdr-state-mismatch` | API 返回成功但重新读取状态不一致 | `true` |

面向用户的错误信息应说明原因和恢复动作；日志可以保留 Windows 返回码，但不得记录不必要的设备标识或个人信息。

## 11. 生命周期与性能

- 不创建常驻后台线程；
- 不使用长期 `setInterval` 轮询显示器；
- 首版不要求显示器变化订阅；
- 每次读取或写入只在当前调用期间持有资源；
- Widget 不可见时不进行非必要刷新；
- 插件禁用、Widget 删除或页面卸载后不得残留任务；
- 单个显示器查询失败时应尽可能隔离错误，但不能把失败目标误报为不支持 HDR；
- 插件异常不得导致 ToolCenter 或其他 Widget 退出。

## 12. 安全要求

- 所有系统调用位于 Rust 权限层之后；
- 前端权限状态不能作为最终安全边界；
- 仅允许布尔值 HDR 开关，不接受任意设备属性或原始 packet；
- 严格校验 `pluginId`、`displayId` 和 `enabled`；
- 不使用 Shell、PowerShell、外部 EXE、注册表脚本或键盘模拟；
- 不记录 EDID 原始数据、序列号或不必要的硬件唯一标识；
- 不新增网络权限；
- 不新增管理员权限，除非有独立证据、风险说明和用户确认；
- 不修改正式版、创建 Release、提交或推送 GitHub，除非用户另行明确授权。

## 13. 建议修改范围

宿主实现预计涉及：

```text
packages/plugin-contract/src/services.ts
packages/plugin-contract/src/manifest.ts
packages/plugin-runtime/src/context.ts
packages/plugin-runtime/src/context.test.ts（或现有对应测试）
apps/desktop/src-tauri/src/services/display.rs
apps/desktop/src-tauri/src/services/mod.rs
apps/desktop/src-tauri/src/commands/display.rs
apps/desktop/src-tauri/src/commands/mod.rs
apps/desktop/src-tauri/src/lib.rs
Cargo.toml（仅在 windows crate 缺少必要 feature 时）
docs/ToolCenter插件开发要求_统一版.md
README.md 或 docs/architecture.md（如公共能力列表发生变化）
```

具体文件以当前实现为准。不要手工修改自动生成的插件注册表。

## 14. 兼容性与影响评估

- `PluginContext` 新增必填服务后，所有上下文工厂和测试桩都需要同步；
- 现有音频插件不应受到行为影响；
- 浏览器 Memory Host 必须有明确的不可用实现或测试注入方式；
- 新增权限必须同步 Manifest 类型、权限设置页和插件校验规则；
- Windows crate feature 变更可能更新 Cargo 构建配置，但不应引入新的第三方依赖；
- 不应更改现有 Widget Manager 的位置、尺寸、显示器迁移和窗口层级逻辑；
- 公共契约变更后必须评估全部现有插件的类型检查结果。

## 15. 测试要求

### 15.1 TypeScript

- `DisplayService` 类型和 `PluginContext` 暴露正确；
- Runtime 命令参数包含当前 `pluginId`；
- 权限拒绝不会调用写入命令；
- 浏览器环境不会假装切换成功；
- 现有插件和宿主类型检查通过。

### 15.2 Rust 单元测试

- 不透明 ID 的生成、解析和非法输入拒绝；
- Windows 返回码到 `AppError` 的映射；
- 目标不存在、HDR 不支持和状态不一致路径；
- 读取使用 `display.read`，写入使用 `display.control`；
- 操作前重新验证目标，不能使用过期缓存；
- 可抽离的纯函数测试不依赖真实显示器。

### 15.3 真实 Windows 验收

必须在真实 ToolCenter Tauri 桌面应用中验证：

1. 单显示器、双显示器和同型号双显示器；
2. HDR 显示器与非 HDR 显示器混合；
3. 分别开启和关闭指定显示器，其他显示器不受影响；
4. 返回状态与 Windows“设置 → 系统 → 显示 → HDR”一致；
5. 切换过程中拔出目标显示器；
6. 显示器拓扑变化后重新读取；
7. 权限允许、拒绝和重新授权；
8. 驱动拒绝或系统不支持时显示可恢复错误；
9. 不需要管理员权限的普通本地桌面会话；
10. 远程桌面或无法访问控制台桌面时安全失败；
11. 插件异常不导致 ToolCenter 退出；
12. 不产生常驻线程、轮询器或残留资源。

真实 HDR 测试会改变 Windows 显示设置，执行前必须提醒用户并获得确认。

## 16. 完成标准

只有同时满足以下条件，宿主能力才算完成：

- `context.display` 可供插件使用；
- `display.read` 与 `display.control` 实现前端提示和 Rust 二次校验；
- 能列出并区分所有活动显示器；
- 能可靠区分 HDR 与其他 Advanced Color 场景；
- 能读取并切换指定显示器的 HDR；
- 操作后重新读取并验证真实状态；
- 显示器断开、权限拒绝和系统不支持均有结构化错误；
- 没有 PowerShell、外部 EXE、原始 command 或管理员权限旁路；
- 没有常驻轮询和资源泄漏；
- 文档、契约、实现和测试一致；
- `corepack pnpm plugin:validate`、TypeScript、Lint、Vitest、Rust fmt、Clippy 和 Cargo test 通过；
- `.\toolcenter.cmd verify` 通过；
- 已在真实 Windows ToolCenter 桌面壳中完成 HDR 操作验收。

## 17. 回滚方案

宿主实现前建议创建 Git 分支或提交当前工作区。

如果扩展导致回归，可按以下范围回滚：

1. 删除 `DisplayService`、显示器 DTO 和 `PluginContext.display`；
2. 删除 `display.read`、`display.control`；
3. 删除 Runtime 显示器桥接；
4. 删除 Rust display service、commands 和注册项；
5. 回滚 Cargo feature 变更；
6. 回滚公共能力文档更新；
7. 重新运行完整门禁，确认现有音频插件与 Widget Manager 恢复原状。

不得使用复制版本目录代替 Git 回滚。

## 18. 官方参考

- [QueryDisplayConfig function](https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-querydisplayconfig)
- [DisplayConfigGetDeviceInfo function](https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-displayconfiggetdeviceinfo)
- [DisplayConfigSetDeviceInfo function](https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-displayconfigsetdeviceinfo)
- [DISPLAYCONFIG_DEVICE_INFO_TYPE enumeration](https://learn.microsoft.com/windows/win32/api/wingdi/ne-wingdi-displayconfig_device_info_type)
- [Use DirectX with Advanced Color on HDR/SDR displays](https://learn.microsoft.com/windows/win32/direct3darticles/high-dynamic-range)

## 19. 可复制给宿主修复对话的任务说明

```text
请按照 docs/ToolCenter_HDR显示器宿主能力需求.md，为 ToolCenter 增加受权限保护的显示器 HDR 公共能力。

开始前完整阅读 AGENTS.md、README.md、docs/ToolCenter插件开发要求_统一版.md、packages/plugin-contract/src/、packages/plugin-runtime/src/、apps/desktop/src/runtime/host.ts，以及当前 Rust commands/services。

先只读检查并报告：
1. 环境与 Git 工作区状态；
2. 计划修改的文件；
3. display.read / display.control 权限方案；
4. Windows HDR API 和显示器 ID 方案；
5. 对现有插件、Widget Manager、公共契约和测试桩的影响；
6. 风险与回滚方式。

这是宿主级公共能力变更。报告后等待用户确认，再修改 apps/desktop、src-tauri、plugin-contract、plugin-runtime、权限和构建配置。

实现必须满足：
- 插件只能通过 context.display 调用；
- Rust 层二次校验权限；
- displayId 是不透明值，并在每次写入前重新验证；
- 能可靠区分 HDR 与其他 Advanced Color 场景；
- 操作后重新读取真实状态；
- 不使用 PowerShell、Shell、外部 EXE、注册表脚本、快捷键模拟或管理员权限旁路；
- 不创建常驻线程、轮询器或隐藏窗口；
- 补充 TypeScript、Rust 和真实 Windows 验收；
- 同步公共能力文档；
- 完成后运行 .\toolcenter.cmd verify。

任何真实 HDR 切换都会改变 Windows 设置，执行前必须再次获得用户确认。不要覆盖正式版，不要 git add、commit、push、创建 Release 或上传构建产物。
```
