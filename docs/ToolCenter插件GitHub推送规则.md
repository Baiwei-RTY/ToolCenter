# ToolCenter 插件 GitHub 推送规则

## 文档信息

| 项目 | 内容 |
|---|---|
| 文档用途 | 统一 ToolCenter 插件的 GitHub 提交、审查、合并和发布流程 |
| 适用仓库 | `Baiwei-RTY/ToolCenter` |
| 仓库类型 | 公开 Monorepo |
| 默认分支 | `main` |
| 适用对象 | 启动器宿主、第一方插件和公共插件能力开发 |

## 1. 仓库与目录

- 所有插件统一进入 ToolCenter 主仓库，不为插件单独创建应用或仓库。
- 插件必须位于 `plugins/<plugin-name>/`。
- 一个插件使用一个独立分支，建议命名：

```text
codex/plugin-<plugin-name>
```

- 不直接向 `main` 推送，统一通过 Pull Request 合并。
- 插件不是独立应用，不得创建重复的 Tauri、Electron、EXE、安装包、托盘或独立运行时。

## 2. 推送范围

普通插件只提交：

```text
plugins/<plugin-name>/
apps/desktop/src/plugin-registry.generated.ts
pnpm-lock.yaml
```

如果插件依赖新的宿主能力，还必须在同一个 PR 中提交：

- `packages/plugin-contract/`
- `packages/plugin-runtime/`
- `apps/desktop/src-tauri/`
- 对应权限、测试、架构和规范文档
- 必要的根目录依赖配置

不得只提交插件代码而遗漏它依赖的宿主能力，也不得为了单个插件开放通用 Shell、PowerShell、原始 Rust command 或其他宽泛系统接口。

## 3. 提交拆分

推荐将一次插件接入拆成三个提交。

### 3.1 宿主能力

```text
feat(host): add <capability> service for plugins
```

### 3.2 插件功能

```text
feat(plugin): add <plugin-name> plugin
```

### 3.3 文档同步

```text
docs: document <plugin-name> integration
```

每个提交保持目标单一，方便审查、定位问题和按范围回滚。

## 4. 提交前检查

必须执行：

```powershell
.\toolcenter.cmd verify
git diff --check
git status --short
```

插件还要单独执行：

```powershell
corepack pnpm --filter @tool-center/plugin-<name> typecheck
corepack pnpm --filter @tool-center/plugin-<name> test
```

涉及真实 Windows 能力时，还必须在 ToolCenter 桌面壳中验收：

```powershell
.\toolcenter.cmd plugin-dev
```

浏览器、Vitest、静态截图和内存桥不能替代真实系统能力测试。

## 5. 精确暂存

禁止直接执行：

```powershell
git add -A
git add .
```

必须按提交范围精确暂存，例如：

```powershell
git add plugins/<plugin-name>
git add apps/desktop/src/plugin-registry.generated.ts
git add pnpm-lock.yaml
```

提交前检查暂存内容：

```powershell
git diff --cached --stat
git diff --cached
```

如果发现与当前插件无关的改动，应先从本次暂存范围中排除，不得擅自删除或覆盖其他对话留下的文件。

## 6. 公开仓库安全检查

推送前必须确认不存在：

- API Key、Token、密码、Cookie、验证码
- `.env`、证书、私钥和账号凭据
- 用户姓名、学校或其他个人隐私
- 本地绝对路径
- 运行日志、调试数据和崩溃转储
- 未经授权的图片、字体、图标和第三方源码
- 不应公开的配置文件

敏感配置应使用环境变量，并加入 `.gitignore`。

GitHub CLI 输出中的认证 Token 即使被遮罩，也不得复制进代码、文档、Issue、PR 或日志。

## 7. 禁止上传的构建产物

源码 PR 不上传：

```text
node_modules/
dist/
target/
coverage/
*.log
.env*
正式版/ToolCenter.exe
正式版/ToolCenter.exe.sha256
正式版/版本信息.json
```

`正式版/使用说明.md` 可以作为项目文档提交。

EXE、安装包和压缩包只能在正式验收后，通过 GitHub Release 发布。

## 8. 推送与创建 PR

完成提交后：

```powershell
git push -u origin codex/plugin-<plugin-name>
```

优先创建 Draft PR：

```powershell
gh pr create --draft --base main --head codex/plugin-<plugin-name>
```

PR 标题格式：

```text
feat: add <plugin-name> plugin
```

不要直接推送或强制推送 `main`。除非用户明确要求，否则不得使用 `--force` 或 `--force-with-lease`。

## 9. PR 必须说明

PR 描述至少包括：

- 插件名称、ID 和功能
- Page、Widget、Action 或 Service 入口
- 使用的权限及申请原因
- 是否修改宿主、公共契约或 Rust
- 测试命令和结果
- 真实桌面验收结果
- 已知限制
- 第三方素材及许可证
- 安全检查结果
- 正式版是否已经重新构建
- 是否仍有硬件场景未验证

## 10. 合并条件

只有满足以下条件才能合并到 `main`：

- 插件校验通过
- 类型检查、Lint、Vitest 和 Rust 测试通过
- `.\toolcenter.cmd verify` 通过
- Manifest、实现、测试和 README 一致
- 插件已进入生成注册表
- 权限拒绝和错误恢复路径完整
- 没有资源泄漏或残留任务
- 没有敏感信息和越权调用
- GitHub Actions 全部通过
- 真实 ToolCenter 桌面验收完成
- 用户明确同意合并

## 11. 正式版与 GitHub Release

PR 合并不等于正式版发布。

正式发布顺序：

```text
合并源码
→ 在 main 上重新验证
→ 构建唯一正式版
→ 检查 EXE 哈希
→ 实际启动验收
→ 用户确认发布
→ 创建 GitHub Release
```

正式构建命令：

```powershell
.\toolcenter.cmd release-build
```

该命令会覆盖固定的 `正式版/`，执行前必须获得用户确认。

创建或更新 GitHub Release、上传 EXE、安装包或压缩包前，也必须再次获得用户确认并执行敏感信息检查。

## 12. 高风险插件补充规则

涉及 HDR、音频设备、文件、进程、快捷键或系统设置时：

- 真实测试前必须说明会改变什么系统状态。
- 获得用户确认后才能执行写入测试。
- 测试前记录原状态。
- 测试后恢复原状态。
- PR 中记录实际测试环境和未覆盖场景。
- 不得以“接口调用未报错”代替实际状态核对。
- 不得在远程会话、未知目标或权限状态不明确时强行执行系统写入。

## 13. 回滚方式

- 插件功能与宿主能力尽量分提交。
- 通过 `git revert` 回滚，不复制版本目录。
- 插件回滚时同步移除注册表、依赖和文档。
- 宿主公共能力只有确认没有其他插件依赖后才能回滚。
- Release 出现问题时回退到上一 Git 标签并重新构建。
- 禁止使用 `git reset --hard`、强制覆盖或删除其他对话的未提交改动作为普通回滚方式。

## 14. 推送完成后的汇报

完成推送后必须向用户说明：

- 分支名称
- 提交数量和提交摘要
- 推送的仓库
- Draft PR 或正式 PR 链接
- 自动测试结果
- GitHub Actions 状态
- 未合并或未发布的内容
- 是否上传了正式构建产物
- 仍需用户确认的风险操作

## 15. 核心原则

```text
一个仓库
一个插件一个分支
宿主能力与依赖插件放在同一个 PR
按职责拆分提交
精确暂存
先检查再推送
先 Draft PR 再合并
源码和二进制分开发布
高风险操作必须再次确认
```
