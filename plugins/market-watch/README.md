# 市场行情

ToolCenter 第一方金融行情插件。Page 使用完整的简约深色行情终端；桌面 Widget 使用无额外外框的圆角行情视图，完整铺满组件尺寸，并在内部保留产品、图表类型和时间范围切换。设置面板用于维护免费数据源、可选 Twelve Data 凭据和自选列表。

## 当前版本

- Widget：`market-watch`
- Page：`market-watch-settings`
- 默认尺寸：Wide 520×220
- 支持尺寸：Small 260×160、Medium 360×220、Wide 520×220
- 权限：`network.request`
- 数据源：[BiQuote](https://biquote.io/docs/) 免 Key 股票 OHLC、[Twelve Data](https://twelvedata.com/docs) Basic 免费方案与公开 demo、[Kraken Spot REST](https://docs.kraken.com/api-reference/market-data/get-ohlc-data) 公共现货 OHLC、[Binance USDⓈ-M Futures](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/Introduction) 公共期货行情
- 自动刷新：数字资产可见时约 60 秒，股票、外汇和商品约 120 秒；隐藏或卸载后停止

## 功能边界

当前版本提供：

- 股票、外汇、现货数字资产、商品和数字资产期货代码的自选列表；
- 桌面 Widget 去除宿主边框、独立标题栏和终端页眉 / 页脚，采用圆角行情区，并在顶部紧凑排列产品、图表类型和时间范围切换；
- 折线图 / K 线图即时切换；
- 1 日 / 5 日 / 1 月范围切换；
- 鼠标滚轮按光标位置放大时间细节，横轴会按可见跨度自动切换日期、时分或日期与时分；按住鼠标左键拖动左右查看，按 `0` 或 `Home` 恢复完整范围；
- 每个 Widget 实例独立保存产品、图表类型和时间范围；
- 手动刷新、加载、空数据、未配置、权限申请/拒绝、网络不可用和错误重试状态；
- 浏览器开发模式中按产品和时间范围生成的确定性演示数据；
- 刷新失败时保留最后一次成功快照，并明确标记“离线缓存”；
- AAPL、MSFT 等股票优先使用 BiQuote 公开只读接口，无需 API Key；BiQuote 失败时，AAPL 可回退 Twelve Data 公开演示，已保存凭据的其他股票可回退 Twelve Data；
- EUR/USD 使用 Twelve Data 无 Key 公开演示；
- BTC/USD 等现货数字资产使用 Kraken 公共 OHLC，无需 API Key；
- Binance USDⓈ-M 数字资产期货免 Key 行情；
- Windows 凭据管理器保存可选的 Twelve Data 免费 API Key。

当前版本明确不提供：

- 下单、账户接入、持仓、收益或投资建议；
- WebSocket 逐笔行情；
- 后台常驻服务、隐藏刷新或系统通知；
- 绕过数据供应商套餐的数据权限；
- 交易所级别的低延迟保证。

## 数据实时性

股票优先使用 BiQuote REST `ohlc`，外汇和商品使用 Twelve Data REST `time_series`；现货数字资产使用 Kraken REST `OHLC`；数字资产期货使用 Binance USDⓈ-M REST `klines`。刷新频率和实际延迟受接口限额、上游经纪商、交易所、品种和市场状态影响，因此界面显示的是“最新获取到的数据”，不是交易撮合级实时流。

- BiQuote 股票 1 日 / 5 日 / 1 月：5 分钟最多 96 条 / 30 分钟最多 80 条 / 日线最多 32 条；
- Twelve Data 外汇和商品 1 日 / 5 日 / 1 月：1 分钟 390 条 / 15 分钟 130 条 / 日线 32 条；
- Kraken 现货 1 日 / 5 日 / 1 月：5 分钟 288 条 / 15 分钟 480 条 / 1 小时 720 条（接口最多返回最近 720 根已完成与当前周期数据）；
- Binance 期货 1 日 / 5 日 / 1 月：5 分钟 288 条 / 1 小时 120 条 / 8 小时 90 条；
- 小组件可见时，Kraken/Binance 产品约每 60 秒刷新；BiQuote/Twelve Data 产品约每 120 秒刷新，以降低免费接口压力和 Twelve Data 日额度消耗。

BiQuote 官方文档声明只读 REST 接口无需身份验证；其股票行情来自上游经纪商和历史引导数据，因此属于尽力而为的数据源，稳定性、交易场所口径和许可范围不等同于付费交易所综合行情。插件仅将其用于个人桌面信息展示，并保留 Twelve Data 回退路径。

Twelve Data 的 `demo` 在本插件中用于 AAPL 回退和 EUR/USD。Basic 免费方案需要注册免费 API Key；免费额度与个人使用条款以供应商当前说明为准。商品以及传统交易所期货通常需要更高套餐或额外市场数据授权。当前免费数字资产入口限定为 Kraken 现货（例如 `BTC/USD`）和 Binance USDⓈ-M 期货（例如 `BTCUSDT`）。

默认自选产品为 AAPL、MSFT、EUR/USD、BTC/USD、BTCUSDT、ETHUSDT 和 SOLUSDT。其中 AAPL、MSFT、Kraken 现货与三个 Binance USDⓈ-M 产品不需要 Key；非公开演示的外汇和商品仍需要用户自己的 Twelve Data 免费 API Key。

## 安全与隐私

可选 Twelve Data API Key 的处理路径：

1. 设置页把输入值交给 `context.credentials.set()`；
2. Rust 宿主按插件 ID 和逻辑 key 写入 Windows 凭据管理器；
3. 前端只有 `set / has / remove`，没有读取明文的 API；
4. 需要 Key 时插件只传 `credentialKey`，Rust 从凭据管理器读取并注入 `Authorization` 请求头；
5. API Key 不写入 JSON、日志、Git 或插件 README。

BiQuote、Twelve Data 公开 demo、Kraken 现货和 Binance 期货请求不携带凭据。所有网络请求仍由共享 Rust HTTPS 服务执行并再次校验 `network.request`。宿主只允许 HTTPS GET、标准 443 端口、公开域名、有限响应大小和短超时，并禁止重定向、localhost 与 IP 字面量目标。

非秘密设置使用：

- 全局：`settings.v1`
- 实例：`widget.<instanceId>.v1`

设置页修改默认产品或自选列表后，会向同一页面上下文发送配置变更事件；不同 WebView 中已经打开的小组件会在手动刷新或下一次 Scheduler 刷新时重新读取共享设置。

## 生命周期

- Page 与 Widget 分别通过动态 `import()` 懒加载；
- 插件不直接导入 `@tauri-apps/*`、桌面壳源码或其他插件；
- 插件不调用 `fetch`、`setInterval` 或原始 Rust command；
- 周期刷新通过 `context.scheduler.register()` 注册；
- `visible=false` 时不发请求；
- Scheduler 释放函数由 React effect 清理；
- 插件异常由宿主错误边界隔离。

## 运行与测试

在项目根目录执行：

```powershell
corepack pnpm --filter @tool-center/plugin-market-watch typecheck
corepack pnpm --filter @tool-center/plugin-market-watch test
corepack pnpm exec eslint plugins/market-watch --max-warnings 0
corepack pnpm exec stylelint "plugins/market-watch/src/**/*.css"
.\toolcenter.cmd verify
.\toolcenter.cmd plugin-dev
```

如果当前终端的 pnpm 子进程找不到 Node，请直接使用项目的 `toolcenter.cmd`，它会修正桌面环境的 PATH。

## 桌面验收

1. 在插件管理中启用“市场行情”，进入设置页；
2. 不填写 API Key，分别验证 AAPL、MSFT、BTC/USD 和 BTCUSDT 的公开连接；
3. 首次验证连接时允许 `network.request`；
4. 在桌面小组件页创建 Wide 市场行情；
5. 验证折线 / K 线与 1 日 / 5 日 / 1 月均可切换；滚轮可缩放，按住左键可左右拖动，`0` 可复位；
6. 验证 Small、Medium、Wide 无裁切、横向滚动或控件重叠；
7. 创建两个实例，确认各自选择互不影响；
8. 隐藏 Widget 超过一个刷新周期，确认没有继续请求；
9. 断网、拒绝权限、选择需要 Key 的代码、移除 API Key，确认分别进入可恢复状态；
10. 删除 Widget 或禁用插件后，确认没有 Scheduler 和订阅残留。

浏览器 Memory Host 只用于视觉、交互和响应式回归，不会绕过插件契约访问真实网络；真实公开行情与权限链路必须在 `plugin-dev` 启动的 Tauri 桌面壳中验收。

## 免责声明

本插件仅用于学习与信息展示，不构成投资建议。任何交易决策都应以持牌行情源、交易所和经纪商提供的数据为准。
