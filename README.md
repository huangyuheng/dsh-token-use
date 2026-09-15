# dsh-token-use

[English](README.en.md) | 中文

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

DeepSeek Harness 实时 Token 用量与消费金额插件：安装后在 **设置 → Token 用量** 查看用量（自带设置侧边栏一级入口），页面每 5 秒刷新（页面隐藏时暂停，零轮询浪费）。

## 功能

- **金额卡片**：按 DeepSeek 官方定价 × 本地用量实时估算消费金额（含高峰/空闲时段倍率），每张卡片（总量、趋势、按模型、按日期、按项目）都带金额字段。
- **官方定价自动更新**：每天 **12:00** 抓取一次官方定价页并缓存到本地，重启不丢、断网可用内置快照兜底。
- **总量卡片**：金额（估算）、总计（输入+输出+缓存）、输入、输出、缓存读、缓存写、推理、调用次数。
- **按模型区分单价**：输入/输出/缓存命中分别按模型的官方单价计价；非 DeepSeek 模型（claude、gpt 等）一律不计金额，用 `—` 标出。
- **范围筛选**：按天 / 按月 / 全部三个 tab，默认「按天=今天」；可选日期、月份。
- **模型筛选**：时间筛选旁的下拉框按模型过滤（含该模型的项目/按天维度明细），默认全部模型。
- **用量趋势图**：基于 ECharts（按需打包、随插件离线分发，不依赖 CDN）。缓存命中/输入/输出按**堆叠面积**画出构成，上沿即总计（另有一条总计参考线），每天金额用**金额柱**走右轴（¥），调用次数在悬停提示里。卡片右上角可切 **7 / 30 / 90 天（默认 7 天）**。无用量日为真实 0 值（堆叠才准），悬停会写明「当日无用量」；刻度单位整轴统一，单调平滑不过冲。图表用命令式渲染，鼠标移动不触发 React 重渲染。
- **单位切换**：中文（亿 / 万 / 千）与英文（B / M / K）一键切换，记忆选择。
- **明细表**：按模型、按日期、按项目三张表，含金额列（悬停显示该模型单价）与总计列。

## 金额是估算值

金额卡片（总量卡片里的最后一个）右上角有个 ⓘ，鼠标移入即显示完整口径说明：

> 金额为估算值：按 DeepSeek 官网定价 × 本地记录用量推算，并已按调用时刻区分高峰/空闲单价。受官方调价、缓存计费口径与统计延时影响，可能与实际账单有出入，请以官网结算金额为准。

口径细节：

- 计价字段：`inputTokens`（缓存未命中输入）、`cacheReadTokens`（缓存命中输入）、`outputTokens`（含推理）；缓存写官方不计费。
- 高峰/空闲：官网每日公布高峰时段（当前为 UTC 工作日 01:00–04:00、06:00–10:00，空闲价格为高峰的一半），**每条记录按它发生时刻的单价计价**，之后调价不会改写历史。
- 只统计 DeepSeek 模型：模型名里不含 `deepseek` 的（claude、gpt、minimax…）不计金额；名字模糊匹配不到官方定价的 DeepSeek 模型也不计，并在 ⓘ 说明里列出。
- **少算的部分**：联网搜索、会话标题这类辅助调用**会产生账单，但 token 数只在服务端、本地取不到**，所以只计次数、不猜金额，ⓘ 说明里列出本期次数。因此这里的金额是**账单下限**，实际只会略高。用官方逐小时导出核对过：我们统计到的请求，token 数与高峰/空闲单价和官方逐行一致。
- 币种默认人民币（取官网中文页），可在配置里切成 `USD`（取官网英文页）。


## 为什么值得装

你在烧 token，但你说不清烧在哪：哪个项目最贵、哪个模型最吃缓存、这周比上周涨了多少。

**dsh-token-use 把这些变成一眼看得懂的数字。** 它跟着每一次调用实时累加，把消费金额、总量、输入、输出、缓存命中、推理和调用次数摊开在设置页里，按模型、按天、按月、按项目随手切换，趋势用一条平滑曲线讲清楚。装完即用：不用配置、不用重启会话、不会在你写代码的时候跳出来打扰你。

看不见的成本最贵——把它变成看得见的。

![Token 用量面板：范围与模型筛选、金额与总量卡片、7/30/90 天可切的趋势图（堆叠构成 + 金额柱）、以及按模型/按日期/按项目三张带金额的明细表](assets/token-usage.jpg)

## 安装

```sh
dsh plugin --profile web add dsh-token-use
# 或从源码安装：dsh plugin --profile web add github:huangyuheng/dsh-token-use
```

重启 `dsh web` 后生效。下载 zip 解压后的本地目录安装：

```sh
dsh plugin --profile web add /解压路径/dsh-token-use
```

## 性能设计

- 宿主侧 **不轮询、不写盘、不加定时器**（除了每天一次定价刷新）：通过 `session/event` 事件总线做 O(1) 增量累加（每条 `assistant/message` 一次字典加法 + 一次金额乘法）。
- 启动时做 **一次性**历史重建：流式解压 `$DSH_HOME/sessions/**/session.jsonl.zstd`（`node:zlib` 原生 zstd），每读一个文件主动让出事件循环（`scheduler.yield()`），不阻塞会话处理；重建与实时事件用「会话 seq 水位」去重，任意先后顺序都不会重复计数。
- **定价刷新**：每天 12:00 一次 HTTPS GET（15 秒超时，失败 1 小时后重试），结果写入 `$DSH_HOME/dsh-token-use/pricing.json`（原子替换，最多保留 30 份快照）；进程重启时同步读缓存，不重复联网；联网失败自动退回内置快照，面板照常显示。
- 只暴露一个只读 JSON 接口 `GET /dsh-token-use`（仅回环可访问，内存快照，`no-store`）。

```sh
# 全部
curl http://127.0.0.1:3080/dsh-token-use
# 指定日期 / 月份
curl 'http://127.0.0.1:3080/dsh-token-use?month=2026-09'
curl 'http://127.0.0.1:3080/dsh-token-use?day=2026-09-10'
# 指定模型（可与 day/month 组合）
curl 'http://127.0.0.1:3080/dsh-token-use?model=deepseek-v4-flash'
```

响应里每个桶都带 `cost`（估算金额），`pricing` 是当前价目表、抓取时间与下次刷新时间，`modelPricing` 是各模型匹配到的单价或未计价原因。

## 开发

```sh
pnpm install          # 仅开发需要（esbuild + echarts）
pnpm run build        # 重新生成 client/client.js（= 精简 ECharts + client/src.js）
```

`client/client.js` 是已提交的构建产物，使用者无需安装依赖或构建。

**开发环路**（把本仓库以 `link:` 装进 profile 后：`dsh plugin --profile web add /path/to/dsh-token-use`）：

- 改 `client/src.js` → `pnpm run build` → **浏览器里的面板自动热更新**（宿主侧会轮询每个插件行的 client bundle，变化时通过 SSE `/plugins/events` 推 `rebuilt`，浏览器侧热替换），**不用重启 `dsh web`、也不用刷新页面**；实测换装延迟 < 1s。
- 改 `lib/*.js`（宿主侧，如 `pricing.js`）→ 仍需重启 `dsh web`。
- **热重载要求 `apply()` 幂等**：重载会把新 fiber 装进来，若它直接重复注册同一个 locale 命名空间 / 槽位就会抛错，整个设置分区会消失直到刷新页面。本插件的字典、导航样式与 `settings.section` 注册都是「接管式」的（先退掉旧注册再登记），因此可以安全热重载。

界面用 DSH 自带的组件库 `@deepseek-ai/dsh-client-ui-primitives`（`Button` / `Pill` / `Input` / `Menu` / `Tooltip` / `StateDot` 与图标集）：打包插件里直接 `require("@deepseek-ai/dsh-client-ui-primitives")` 即可；老版本 shell 上组件缺失时逐项降级为原生控件。**创造模式预览动态 cordis 插件**时无法引入外部依赖，可改用 `window.__DSH_MODULES__.import("@deepseek-ai/dsh-client-ui-primitives")`（该模块属于 shell 的静态模块，普通 Web GUI 里没有 `window.__DSH_MODULES__`）。

已发布到 npm（包名 `dsh-token-use`，`repository` 指回本仓库，因此官方市场会自动关联并显示下载量）。升级流程：改 `version` → `npm publish` → 用户 `dsh plugin update` 或市场一键更新。

## 字段口径

- `input` / `output`：API 上报的输入/输出 tokens。
- `cacheRead` / `cacheWrite`：提示词缓存读/写 tokens（API 计费口径中缓存读也计入输入侧）。
- `reasoning`：推理 tokens。
- `cost`：按上面的字段与当时单价算出的估算金额；缓存写不计费，推理已含在输出内，不重复计。
- `auxiliary`：本期未计入金额的辅助调用次数（`search` 联网搜索、`title` 会话标题）。
- 模型归属：该会话最近一次 `request/header` 的 model；标题生成等无 usage 记录的小调用不在统计内。
- 项目归属：取会话创建头里的 `cwd`（实时事件读 `session.header.cwd`，历史扫描读日志头）；子会话/分叉会话继承父会话的项目；极少数暂时无法归属的调用先挂起，归属明确后自动回填，30 秒仍未明确才记入 `(no cwd)`。

## 兼容性

给他人安装前，这些差异都已处理：

| 维度 | 说明 |
| --- | --- |
| 运行环境 | 需要 **dsh web ≥ 0.1.0-rc.6**（设置侧边栏 `settings.section` 槽位）。宿主侧只用 Node 内置模块；zstd 解压依赖 `node:zlib`（Node ≥ 22.15 内置，dsh 自身要求 ^22.19 \|\| >=24，故必然满足）。 |
| 数据目录 | 按 `$DSH_HOME`（环境变量，缺省 `~/.dsh`）解析，与 dsh 官方 `dsh-home-paths` 规则一致；自定义 home 同样有效。历史用量**只读**；唯一写入的是定价缓存 `$DSH_HOME/dsh-token-use/pricing.json`（原子替换，可用 `pricing.enabled: false` 完全关闭联网与写盘）。 |
| 设置导航图标 | 应用按 section id 硬编码导航图标，未知 id（含本插件与插件市场）都回退成同一个齿轮，槽位没有 icon 选项。插件用「结构选择器 + mask」把自己的柱状图图标画在齿轮位置：只依赖自身 `label` 里的标记类名，不依赖应用 CSS 模块的哈希类名；若应用改版导致结构变化，选择器失配即回退为默认齿轮（不会出现两个图标），功能不受影响。 |
| 会话格式 | 同时支持 `session.jsonl[.zstd]`（多帧 zstd，含 checksum）、带版本号的新一代 `session.v<N>.jsonl[.zstd]`（dsh 迁移后会与旧文件并存），以及明文 `.jsonl`；同一会话**只读最高版本那一代**，不会重复计数；`.bak`/`.corrupt-*`/`session.lock` 自动跳过，个别损坏帧只计入 `scan.skipped`。 |
| 目录布局 | 兼容官方 JSONL 持久层的 `sessions/<项目目录>/<会话目录>/` 结构；会话按项目目录、会话 ID 独立读取。 |
| 统计口径 | 部分 provider（如 pi-ai 适配）会把推理 token 并入输出，此时「推理」列为 0 属正常；标题生成、联网搜索等不落 `usage` 的调用不计入；模型归属取该会话最近一次 `request/header`。 |
| 网络访问 | 接口默认**仅回环**。局域网部署（配置了 trustedHosts）时在 profile patch 里开 `allowRemote: true`，且仍只接受同源请求；客户端遇到 403 会直接提示原因。出网只有一个用途：每天 12:00 抓一次 `api-docs.deepseek.com` 官方定价页（可用 `pricing.url` 换源、`pricing.enabled: false` 关闭）。 |
| 性能 | 历史重建在 **Worker 线程**执行，不阻塞宿主事件循环；期间新事件先缓冲、扫描完成后回放，靠会话 seq 水位去重。之后只做事件增量。 |
| 多实例 | 每个 `$DSH_HOME` 独立统计；同一 home 下的多个 profile 共享 `sessions` 目录，统计会合并显示。 |

## 配置（cordis.patch.yml 可覆盖）

```yaml
- id: dsh-token-use
  name: 'dsh-token-use'
  config:
    endpoint: /dsh-token-use
    scanAtBoot: true    # false 则只统计插件启动之后的实时用量
    allowRemote: false  # 局域网（非回环）访问时设为 true，仅接受同源请求
    pricing:
      enabled: true     # false 则关闭每日定价抓取，只用内置/已有快照
      currency: CNY     # CNY（官网中文页，元）或 USD（官网英文页，$）
      refreshHour: 12   # 本地时间每天几点抓取
      # url: https://api-docs.deepseek.com/zh-cn/quick_start/pricing  # 自定义定价页
```

## 安装后

1. 重启 `dsh web`（bundle 成员变化必须重启才生效）；
2. 打开 **设置 → Token 用量**；
3. 也可以用命令行：`curl 'http://127.0.0.1:3080/dsh-token-use?month=2026-09'`。
