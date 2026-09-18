window.__ModuleLoader__.load({ id: "dsh-token-use", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  var react = require("react");
  var useEffect = react.useEffect;
  var useRef = react.useRef;
  var useState = react.useState;
  var h = react.createElement;

  /**
   * The DSH UI primitives: controls, icons and the floating layers every other
   * plugin builds with, so this panel uses the shell's own components instead of
   * re-inventing them. A packaged plugin resolves the module like any dependency
   * (it is one of the shell's static modules); when a shell predates a component
   * the small fallbacks below keep the panel usable rather than blank.
   */
  var ui = {};
  try {
    ui = require("@deepseek-ai/dsh-client-ui-primitives") || {};
  } catch (error) {
    ui = {};
  }
  var component = function (name, fallback) {
    return typeof ui[name] === "function" ? ui[name] : fallback;
  };
  /**
   * Tooltip is the right layer for the ⓘ: it positions in viewport coordinates,
   * clamps to the window and flips sides, so an anchor at the panel's right edge
   * still shows the whole note. (HoverCard always opens to the *right* of its
   * anchor and never clamps, so there it gets cut off by the window.)
   */
  var tooltip = component("Tooltip", null);
  var stateDot = component("StateDot", null);
  var menu = component("Menu", null);
  var modal = component("Modal", null);
  var icon = function (name) {
    return typeof ui[name] === "function" ? ui[name] : null;
  };
  var iconQuestion = icon("IconQuestionOutline14");
  var iconChevron = icon("IconChevronDownOutline14");
  var iconRefresh = icon("IconRefreshOutline14");
  var iconGauge = icon("IconGaugeOutline16");
  var iconTrend = icon("IconDataOutline16");
  var iconCheck = icon("IconCheckOutline16");
  var iconWarn = icon("IconWarningOutline16");
  var iconClock = icon("IconClockOutline16");
  var iconLoading = icon("IconLoadingOutline16");
  var iconApi = icon("IconApiOutline14");
  /** Chip and Button degrade into styled native controls on an older shell. */
  var chip = component("Pill", function (props) {
    return h("button", { type: "button", className: "dshtu_seg", "data-on": props.active === true, onClick: props.onClick, disabled: props.disabled === true }, props.children);
  });
  var button = component("Button", function (props) {
    return h("button", { type: "button", className: "dshtu_btn", onClick: props.onClick, disabled: props.disabled === true }, props.icon, props.children);
  });
  var input = component("Input", function (props) {
    return h("input", { type: props.type, value: props.value, onChange: props.onChange, className: "dshtu_input" });
  });

  var NS = "settings.tokenUsage";
  var inject = ["slots", "locale"];

  var zh = {
    tab: "Token 用量",
    totals: "总用量（历史重建 + 实时累计）",
    total: "总计",
    input: "输入",
    output: "输出",
    cacheRead: "缓存读",
    cacheWrite: "缓存写",
    reasoning: "推理",
    calls: "调用次数",
    byModel: "按模型",
    byDay: "按日期",
    byProject: "按项目",
    trend: "用量趋势",
    trendNote: "每条折线按自身峰值归一化；悬停查看当日明细",
    trendNoData: "当日无用量",
    daysSuffix: "天",
    trendEmpty: "当前范围不足两天数据，切换到「按月」或「全部」查看趋势",
    peak: "峰值",
    filterAll: "全部",
    filterDay: "按天",
    filterRange: "时间段",
    filterMonth: "按月",
    filterYear: "按年",
    filterLabel: "范围",
    modelLabel: "模型",
    modelAll: "全部模型",
    unitLabel: "单位",
    unitZh: "中文",
    unitEn: "英文",
    cost: "金额",
    costTotal: "金额（估算）",
    costTip: "估算金额，以官网结算为准",
    costTipLong: "金额为估算值：按 DeepSeek 官网定价 × 本地记录用量推算，并已按调用时刻区分高峰/空闲单价。受官方调价、缓存计费口径与统计延时影响，可能与实际账单有出入，请以官网结算金额为准。",
    priceSource: "定价来源",
    priceFetched: "更新于 {time}",
    priceNext: "下次 {time}",
    pricePeak: "高峰单价翻倍（UTC 工作日 {ranges}）",
    priceBuiltIn: "内置定价快照（未能联网更新：{error}）",
    priceOffline: "内置定价快照（尚未联网更新）",
    pricePeakAssumed: "高峰时段按默认规则（官网文案未识别）",
    notPriced: "未计入金额",
    auxiliaryNote: "另有 {count} 次辅助调用（{detail}）只计次数、不计金额：token 数在服务端，本地取不到。",
    auxSearch: "联网搜索",
    auxTitle: "会话标题",
    copy: "复制说明",
    copied: "已复制",
    reasonExcluded: "非 DeepSeek 模型",
    reasonUnmatched: "未匹配到官方定价",
    unitOffPeak: "空闲",
    unitPeak: "高峰",
    scanPending: "正在重建历史用量…",
    scanDone: "已扫描 {sessions} 个会话 · {files} 个日志 · {ms} ms",
    scanFailed: "历史重建失败：{error}",
    updated: "更新于 {time}",
    loading: "加载中…",
    error: "读取失败",
    remoteDenied: "接口仅允许本机访问；局域网使用需在插件配置中开启 allowRemote",
    retry: "重试",
    tabOverview: "概览",
    tabModels: "模型统计",
    tabProjects: "项目统计",
    tabConfig: "配置信息",
    heatmap: "使用热力图",
    heatmapNote: "近 12 个月，每格一天；悬停查看当天明细",
    heatLess: "少",
    heatMore: "多",
    heatCell: "{day} · 总计 {total} · {cost} · {calls} 次调用",
    heatEmpty: "近 12 个月没有记录",
    configVersions: "版本信息",
    configRuntime: "运行环境",
    versionPackage: "组件",
    versionInstalled: "已安装",
    versionLatest: "最新",
    versionState: "状态",
    versionCurrent: "最新",
    versionOutdated: "有新版本",
    versionAhead: "高于 registry",
    versionUnknown: "未知",
    versionChannel: "{channel} 通道",
    versionChecked: "检查于 {time}",
    versionRefresh: "重新检查",
    healthCheck: "健康检查",
    healthRunning: "检查中…",
    healthOk: "接口正常",
    healthFail: "接口异常",
    healthLatency: "响应耗时",
    healthEndpoint: "接口版本",
    healthScan: "历史扫描",
    healthScanDone: "{sessions} 会话 · {files} 日志 · {ms} ms",
    healthScanRunning: "运行中",
    healthScanFailed: "失败",
    healthPricing: "定价数据",
    healthPricingValue: "{source} · 更新于 {time}",
    healthBuckets: "数据桶",
    healthBucketsValue: "{days} 天 · {models} 个模型",
    healthUpdated: "数据更新于",
    restart: "一键重启",
    restartTitle: "重启 dsh web 服务",
    restartBody: "将重启正在提供本页面的 dsh web 进程（PID {pid}）。页面会断开约 10-30 秒，恢复后自动重新加载。",
    restartConfirm: "确认重启",
    restartCancel: "取消",
    restartPending: "已提交重启，等待服务恢复…",
    restartDone: "服务已恢复，正在重新加载页面…",
    restartFailed: "重启失败：{error}",
    runtimePlatform: "平台版本",
    runtimeNode: "Node 版本",
    runtimePid: "进程 PID",
    runtimePort: "监听端口",
    runtimeUptime: "已运行",
    runtimeHome: "DSH_HOME",
    runtimeUptimeValue: "{days} 天 {hours} 小时",
    runtimeUptimeShort: "{minutes} 分钟",
    close: "关闭",
    healthResults: "自检结果",
    healthToneOk: "正常",
    healthToneWarn: "有提醒",
    healthToneError: "有问题",
    healthToneIdle: "未检查",
    healthSectionEndpoint: "接口",
    healthSectionClient: "客户端 bundle",
    healthSectionHarness: "Harness 自检",
    checkProfile: "Profile 完整性",
    checkPlugins: "插件包完整性",
    checkDeps: "依赖解析",
    checkCordis: "cordis 单实例",
    checkVersions: "服务包版本一致",
    bundleOk: "可加载",
    bundleFailed: "加载失败（http {status}）",
    bundleNoEntry: "服务端未下发客户端 bundle",
    bundleSkipped: "服务端插件，无前端 bundle",
    healthHint: "建议：{hint}",
    healthChecking: "正在自检…",
    healthSummaryProfile: "{name} · {dir}",
    healthSummaryPlugins: "{ok}/{total} 通过",
    healthSummaryDeps: "{count} 个依赖",
    healthSummaryCordis: "{copies} 份 cordis",
    healthSummaryVersions: "服务端 v{version}",
    codeProvided: "由服务包提供",
    codeNotInstalled: "未安装",
    codeModulesMissing: "node_modules 不存在",
    codeBundlesEmpty: "profile 启动图里没有 bundle",
    codeEntryMissing: "入口文件缺失：{detail}",
    codeEntryUndeclared: "未声明入口（exports[\".\"] / main）",
    codePatchMissing: "bundle patch 缺失：{detail}",
    codeClientMissing: "前端 bundle 缺失：{detail}",
    codeClientUndeclared: "声明了 dsh.client，但没有 exports[\"./client\"]",
    codeUnresolved: "无法从服务端解析",
    codeServiceMismatch: "与服务端版本不一致",
    hintNoProfile: "在 {root} 下找不到包含本插件的 profile",
    hintInstall: "在该 profile 里执行 dsh plugin install",
    hintAdd: "用 dsh plugin add {name} 安装它",
    hintReinstall: "重新安装该插件：发布的包文件不完整",
    hintBundlesEmpty: "profile 的启动图里没有 bundle，插件不会被加载",
    hintCordisMixed: "运行时 import cordis 的插件必须共用同一份、同一版本",
    hintCordisDuplicate: "版本相同但路径不同（link 安装会解析到自己的副本），只有运行时 import cordis 的插件会受影响",
    hintServiceVersion: "服务端 bundle 与正在运行的 CLI 版本不一致，是插件起不来的常见原因"
  };
  var en = {
    tab: "Token usage",
    totals: "Totals (history rebuild + live fold)",
    total: "Total",
    input: "Input",
    output: "Output",
    cacheRead: "Cache read",
    cacheWrite: "Cache write",
    reasoning: "Reasoning",
    calls: "Calls",
    byModel: "By model",
    byDay: "By day",
    byProject: "By project",
    trend: "Usage trend",
    trendNote: "Each line is normalized to its own peak; hover for daily detail",
    trendNoData: "no usage this day",
    daysSuffix: "d",
    trendEmpty: "Fewer than two days in range — switch to By month or All for a trend",
    peak: "Peak",
    filterAll: "All",
    filterDay: "By day",
    filterRange: "Date range",
    filterMonth: "By month",
    filterYear: "By year",
    filterLabel: "Range",
    modelLabel: "Model",
    modelAll: "All models",
    unitLabel: "Unit",
    unitZh: "中文",
    unitEn: "English",
    cost: "Cost",
    costTotal: "Cost (est.)",
    costTip: "Estimated amount — the official bill prevails",
    costTipLong: "Amounts are estimates: DeepSeek's published prices × the usage recorded here, priced with the peak/off-peak rate in effect at each call. Official price changes, cache accounting and reporting lag can make this differ from your actual bill — the official settlement prevails.",
    priceSource: "Prices from",
    priceFetched: "fetched {time}",
    priceNext: "next {time}",
    pricePeak: "Peak rates are double (UTC weekdays {ranges})",
    priceBuiltIn: "Built-in price snapshot (could not refresh online: {error})",
    priceOffline: "Built-in price snapshot (not refreshed online yet)",
    pricePeakAssumed: "Peak window uses the default rule (page wording not recognised)",
    notPriced: "Not counted",
    auxiliaryNote: "A further {count} auxiliary calls ({detail}) are counted but not priced: their tokens exist only server-side.",
    auxSearch: "web search",
    auxTitle: "session titles",
    copy: "Copy note",
    copied: "Copied",
    reasonExcluded: "not a DeepSeek model",
    reasonUnmatched: "no matching official price",
    unitOffPeak: "off-peak",
    unitPeak: "peak",
    scanPending: "Rebuilding history…",
    scanDone: "Scanned {sessions} sessions · {files} logs · {ms} ms",
    scanFailed: "History rebuild failed: {error}",
    updated: "Updated {time}",
    loading: "Loading…",
    error: "Failed to load",
    remoteDenied: "Endpoint is loopback-only; enable allowRemote in the plugin config for LAN access",
    retry: "Retry",
    tabOverview: "Overview",
    tabModels: "By model",
    tabProjects: "By project",
    tabConfig: "Configuration",
    heatmap: "Usage heatmap",
    heatmapNote: "Last 12 months, one cell per day; hover for that day's detail",
    heatLess: "Less",
    heatMore: "More",
    heatCell: "{day} · {total} tokens · {cost} · {calls} calls",
    heatEmpty: "Nothing recorded in the last 12 months",
    configVersions: "Versions",
    configRuntime: "Runtime",
    versionPackage: "Package",
    versionInstalled: "Installed",
    versionLatest: "Latest",
    versionState: "Status",
    versionCurrent: "Up to date",
    versionOutdated: "Update available",
    versionAhead: "Ahead of registry",
    versionUnknown: "Unknown",
    versionChannel: "{channel} channel",
    versionChecked: "Checked {time}",
    versionRefresh: "Check again",
    healthCheck: "Health check",
    healthRunning: "Checking…",
    healthOk: "Endpoint healthy",
    healthFail: "Endpoint failed",
    healthLatency: "Latency",
    healthEndpoint: "Endpoint version",
    healthScan: "History scan",
    healthScanDone: "{sessions} sessions · {files} logs · {ms} ms",
    healthScanRunning: "running",
    healthScanFailed: "failed",
    healthPricing: "Price data",
    healthPricingValue: "{source} · fetched {time}",
    healthBuckets: "Buckets",
    healthBucketsValue: "{days} days · {models} models",
    healthUpdated: "Data updated",
    restart: "Restart service",
    restartTitle: "Restart the dsh web service",
    restartBody: "This restarts the dsh web process serving this page (PID {pid}). The page goes away for roughly 10-30 seconds and reloads itself once the service is back.",
    restartConfirm: "Restart now",
    restartCancel: "Cancel",
    restartPending: "Restart submitted — waiting for the service…",
    restartDone: "Service is back — reloading the page…",
    restartFailed: "Restart failed: {error}",
    runtimePlatform: "Platform",
    runtimeNode: "Node version",
    runtimePid: "PID",
    runtimePort: "Port",
    runtimeUptime: "Uptime",
    runtimeHome: "DSH_HOME",
    runtimeUptimeValue: "{days}d {hours}h",
    runtimeUptimeShort: "{minutes}m",
    close: "Close",
    healthResults: "Self-check",
    healthToneOk: "Healthy",
    healthToneWarn: "Attention",
    healthToneError: "Problems",
    healthToneIdle: "Not checked",
    healthSectionEndpoint: "Endpoint",
    healthSectionClient: "Client bundles",
    healthSectionHarness: "Harness self-check",
    checkProfile: "Profile integrity",
    checkPlugins: "Plugin packages",
    checkDeps: "Dependency resolution",
    checkCordis: "Single cordis instance",
    checkVersions: "Service bundle versions",
    bundleOk: "loads",
    bundleFailed: "failed to load (http {status})",
    bundleNoEntry: "the server published no client bundle for this plugin",
    bundleSkipped: "server-side plugin, no client bundle",
    healthHint: "Try: {hint}",
    healthChecking: "Running the self-check…",
    healthSummaryProfile: "{name} · {dir}",
    healthSummaryPlugins: "{ok}/{total} ok",
    healthSummaryDeps: "{count} declared",
    healthSummaryCordis: "{copies} copies of cordis",
    healthSummaryVersions: "service v{version}",
    codeProvided: "provided by the service",
    codeNotInstalled: "not installed",
    codeModulesMissing: "node_modules is missing",
    codeBundlesEmpty: "the boot graph lists no bundles",
    codeEntryMissing: "entry file missing: {detail}",
    codeEntryUndeclared: "no entry declared (exports[\".\"] / main)",
    codePatchMissing: "bundle patch missing: {detail}",
    codeClientMissing: "client bundle missing: {detail}",
    codeClientUndeclared: "dsh.client declared but no exports[\"./client\"]",
    codeUnresolved: "not resolvable from the service",
    codeServiceMismatch: "differs from the service",
    hintNoProfile: "no profile under {root} lists this plugin",
    hintInstall: "run dsh plugin install in that profile",
    hintAdd: "install it with dsh plugin add {name}",
    hintReinstall: "reinstall this plugin: its published files are incomplete",
    hintBundlesEmpty: "with no bundles the profile loads no plugins",
    hintCordisMixed: "plugins that import cordis at runtime must share one copy and one version",
    hintCordisDuplicate: "same version, different paths (a linked plugin resolves its own copy) — harmless unless the plugin imports cordis at runtime",
    hintServiceVersion: "a service bundle older or newer than the running CLI is a common cause of failed plugin startups"
  };

  var css = ".dshtu_wrap{max-width:860px;display:flex;flex-direction:column;gap:14px;padding:2px 2px 4px;color:var(--dsw-alias-label-primary);font-size:13px}.dshtu_card{background:var(--dsw-alias-bg-layer-3);border-radius:14px;box-shadow:var(--dsw-elevation-stroke);padding:14px 16px}.dshtu_bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dshtu_bar label{color:var(--dsw-alias-label-tertiary);font-size:12px}.dshtu_bar .dshtu_select,.dshtu_bar .dshtu_input{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:4px 8px;font-size:12.5px}.dshtu_bar .dshtu_select{width:168px;text-overflow:ellipsis;white-space:nowrap}.dshtu_chips{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}.dshtu_subBar{margin-top:12px}.dshtu_pick{display:inline-flex;align-items:center;gap:4px;max-width:230px}.dshtu_pickLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dshtu_metaIcon{display:inline-flex;align-items:center;margin-right:5px;vertical-align:-2px;color:var(--dsw-alias-label-tertiary)}.dshtu_cardTitle{display:inline-flex;align-items:center}.dshtu_foot{display:flex;align-items:center;gap:6px}.dshtu_statLabel{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}.dshtu_field{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.dshtu_seg{display:inline-flex;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;overflow:hidden}.dshtu_seg button{border:0;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;padding:4px 10px;font-size:12.5px}.dshtu_seg button[data-on=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dshtu_totalsMeta{margin-top:12px}.dshtu_grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:8px}.dshtu_stat{background:var(--dsw-alias-bg-module-platform);border-radius:10px;padding:10px 12px}.dshtu_stat b{display:block;font-size:16px;line-height:24px;font-variant-numeric:tabular-nums}.dshtu_stat span{color:var(--dsw-alias-label-tertiary);font-size:12px}.dshtu_stat[data-main=true]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,var(--dsw-alias-bg-module-platform))}.dshtu_stat[data-main=true] b{color:var(--dsw-alias-state-business-primary);font-size:20px}.dshtu_table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}.dshtu_table th,.dshtu_table td{text-align:right;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l2);font-weight:400}.dshtu_table th:first-child,.dshtu_table td:first-child{text-align:left}.dshtu_table th{color:var(--dsw-alias-label-tertiary);font-size:12px;white-space:nowrap}.dshtu_table td:first-child{overflow-wrap:anywhere;max-width:300px;color:var(--dsw-alias-label-secondary)}.dshtu_meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.dshtu_err{color:var(--dsw-alias-state-error-primary);display:flex;align-items:center;gap:10px}.dshtu_chart{width:100%;height:260px}.dshtu_info{display:inline-flex;align-items:center;justify-content:center;margin-left:6px;color:var(--dsw-alias-label-tertiary);cursor:help}.dshtu_info:hover{color:var(--dsw-alias-state-business-primary)}.dshtu_pop{display:block;max-width:420px;font-size:12px;font-weight:400;line-height:18px;text-align:left;white-space:normal}.dshtu_pop .dshtu_sep{margin:0 5px;opacity:.55}[role=tooltip]:has(.dshtu_pop){background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:10px 12px;border:0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.16)}.dshtu_nd{color:var(--dsw-alias-label-tertiary)}.dshtu_range{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.dshtu_range input{width:132px}.dshtu_range em{font-style:normal;color:var(--dsw-alias-label-tertiary)}.dshtu_tabRow{display:flex;align-items:center;gap:10px}.dshtu_tabs{display:flex;align-items:center;gap:2px;flex:1;flex-wrap:wrap}.dshtu_tabs button{border:0;background:0 0;font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:5px 10px 6px;border-bottom:2px solid transparent;font-size:13px}.dshtu_tabs button:hover{color:var(--dsw-alias-label-primary)}.dshtu_tabs button[data-on=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-state-business-primary);font-weight:500}.dshtu_heatCard{display:flex;flex-direction:column;gap:10px}.dshtu_heatHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dshtu_heatScroll{overflow-x:auto;padding-bottom:4px}.dshtu_heatBody{display:flex;gap:3px}.dshtu_heatDays{display:flex;flex-direction:column;gap:3px;width:17px}.dshtu_heatDay{height:11px;font-size:10px;line-height:11px;color:var(--dsw-alias-label-tertiary)}.dshtu_heat{display:flex;gap:3px}.dshtu_heatCol{display:flex;flex-direction:column;gap:3px}.dshtu_heatColHead{position:relative;height:13px}.dshtu_heatColLabel{position:absolute;left:0;top:0;font-size:10px;line-height:13px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}.dshtu_heatCell{width:11px;height:11px;border-radius:2px;background:var(--dsw-alias-bg-module-platform)}.dshtu_heatCell[data-future=true]{background:0 0}.dshtu_heatLegend{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--dsw-alias-label-tertiary)}.dshtu_heatLegend i{width:11px;height:11px;border-radius:2px;display:inline-block}.dshtu_kv{display:grid;grid-template-columns:minmax(96px,auto) 1fr;gap:6px 14px;margin-top:8px;font-size:12.5px}.dshtu_kv dt{color:var(--dsw-alias-label-tertiary)}.dshtu_kv dd{margin:0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.dshtu_acts{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}.dshtu_health{display:grid;grid-template-columns:minmax(96px,auto) 1fr;gap:6px 14px;margin-top:12px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l2);font-size:12.5px}.dshtu_health dt{color:var(--dsw-alias-label-tertiary)}.dshtu_health dd{margin:0;font-variant-numeric:tabular-nums}.dshtu_stack{display:flex;flex-direction:column;gap:14px}.dshtu_tblBar{margin-top:12px}.dshtu_checkList{margin:8px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}.dshtu_head{display:flex;align-items:center;gap:6px;margin-bottom:8px}.dshtu_head h3{margin:0;font-size:13px;font-weight:500}.dshtu_slim .dshtu_bar{margin:0}.dshtu_state{display:inline-flex;align-items:center;gap:6px;font-size:12.5px}.dshtu_state[data-tone=ok]{color:var(--dsw-alias-state-success-primary)}.dshtu_state[data-tone=warn]{color:var(--dsw-alias-state-warning-primary)}.dshtu_state[data-tone=bad]{color:var(--dsw-alias-state-error-primary)}.dshtu_state[data-tone=idle]{color:var(--dsw-alias-label-tertiary)}.dshtu_modalBody{font-size:12.5px;line-height:20px;color:var(--dsw-alias-label-secondary);max-width:420px}.dshtu_modalFoot{display:flex;justify-content:flex-end;gap:8px}.dshtu_verCell{font-variant-numeric:tabular-nums;white-space:nowrap}";

  function trimNum(v, decimals) {
    var f = v.toFixed(decimals);
    if (f.indexOf(".") !== -1) f = f.replace(/0+$/, "").replace(/\.$/, "");
    return f;
  }

  function fmtValue(v, unit) {
    v = v || 0;
    if (unit === "en") {
      if (v >= 1e9) return trimNum(v / 1e9, 2) + "B";
      if (v >= 1e6) return trimNum(v / 1e6, 2) + "M";
      if (v >= 1e3) return trimNum(v / 1e3, 1) + "K";
      return String(v);
    }
    if (v >= 1e8) return trimNum(v / 1e8, 2) + "亿";
    if (v >= 1e4) return trimNum(v / 1e4, 1) + "万";
    if (v >= 1e3) return trimNum(v / 1e3, 1) + "千";
    return String(v);
  }

  var fmtTime = function (ms) {
    var d = new Date(ms);
    var p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  };

  var MONEY = { symbol: "¥" };

  function setSymbol(symbol) { MONEY.symbol = symbol || "¥"; }

  /** Money reads at a glance: small amounts keep more decimals. */
  function fmtMoney(v) {
    var value = v || 0;
    var decimals = value >= 1000 ? 2 : value >= 1 ? 3 : 4;
    var text = value.toFixed(decimals);
    if (decimals > 2) text = text.replace(/0+$/, "").replace(/\.$/, "");
    return MONEY.symbol + text;
  }

  var today = function () { return new Date().toISOString().slice(0, 10); };
  var thisMonth = function () { return new Date().toISOString().slice(0, 7); };
  var thisYear = function () { return new Date().toISOString().slice(0, 4); };

  function statBox(t, label, value, unit, main) {
    return h("div", { className: "dshtu_stat", "data-main": main === true },
      h("b", null, fmtValue(value, unit)),
      h("span", null, label));
  }

  function basename(path) {
    var text = String(path);
    var idx = Math.max(text.lastIndexOf("/"), text.lastIndexOf("\\"));
    return idx >= 0 ? (text.slice(idx + 1) || text) : text;
  }

  /** A row of the shell's pills for one small enum (range, unit, chart window). */
  function chips(options, active, onPick) {
    return options.map(function (option) {
      return h(chip, {
        key: option.value,
        active: option.value === active,
        onClick: function () { onPick(option.value); }
      }, option.label);
    });
  }

  /**
   * A shell-styled dropdown: the Menu popover (the same one the composer picks
   * models with) anchored on a pill, showing the current label. Renders a plain
   * `select` on a shell that has no Menu. Shared by the range window, the year
   * and the model filter, so their behaviour cannot drift apart.
   */
  function Dropdown(props) {
    var _a = useState(false), open = _a[0], setOpen = _a[1];
    var current = props.items.filter(function (item) { return item.id === props.value; })[0];
    if (menu === null) {
      return h("select", {
        className: "dshtu_select",
        value: props.value,
        onChange: function (event) { props.onChange(event.target.value); }
      }, props.items.map(function (item) { return h("option", { key: item.id, value: item.id }, item.label); }));
    }
    return h(menu, {
      open: open,
      align: "start",
      side: "bottom",
      portal: true,
      compact: true,
      items: props.items,
      selectedId: props.value,
      onSelect: function (id) { props.onChange(id); setOpen(false); },
      onClose: function () { setOpen(false); },
      anchor: h(chip, { active: true, onClick: function () { setOpen(!open); } },
        h("span", { className: "dshtu_pick" },
          h("span", { className: "dshtu_pickLabel" }, current === undefined ? String(props.value) : current.label),
          iconChevron === null ? null : h(iconChevron, {})))
    });
  }

  /**
   * The money card's ⓘ: the shell's own icon inside the shell's Tooltip, with a
   * plain title attribute as the only fallback on a shell without it.
   */
  function noteTrigger(t, notes) {
    var glyph = h("i", { className: "dshtu_info" }, iconQuestion === null ? "i" : h(iconQuestion, {}));
    if (tooltip === null) return h("i", { className: "dshtu_info", title: notes.text }, "i");
    return h(tooltip, {
      label: h("div", { className: "dshtu_pop" }, notes.node),
      side: "top",
      delayMs: 120,
      maxWidth: 420
    }, glyph);
  }

  var BUCKET_KEYS = ["calls", "input", "output", "cacheRead", "cacheWrite", "reasoning", "total", "cost"];

  /** Project tables read as directory names; same-named projects merge, full path rides the title. */
  function shortenProjects(rows) {
    var merged = {};
    var titles = {};
    Object.keys(rows || {}).forEach(function (key) {
      var name = basename(key);
      titles[name] = key;
      var source = rows[key];
      if (merged[name] === undefined) {
        merged[name] = {};
        BUCKET_KEYS.forEach(function (k) { merged[name][k] = source[k] || 0; });
      } else {
        BUCKET_KEYS.forEach(function (k) { merged[name][k] += source[k] || 0; });
      }
    });
    return { rows: merged, titles: titles };
  }

  /**
   * One breakdown table. `notes` (optional) maps a row key to the money cell:
   * `{ blank, tip }` renders an em dash for rows that carry no price at all
   * (a non-DeepSeek model) and always explains the amount on hover.
   */
  function table(t, keyLabel, rows, unit, titles, notes) {
    var keys = Object.keys(rows || {});
    if (keys.length === 0) return null;
    return h("div", { className: "dshtu_card" },
      h("table", { className: "dshtu_table" },
        h("thead", null,
          h("tr", null,
            h("th", null, keyLabel),
            h("th", null, tooltip === null
              ? h("span", { title: t("costTipLong") }, t("cost") + "*")
              : h(tooltip, { label: h("div", { className: "dshtu_pop" }, t("costTipLong")), side: "top", delayMs: 250 }, h("span", null, t("cost") + "*"))),
            h("th", null, t("total")),
            h("th", null, t("input")),
            h("th", null, t("output")),
            h("th", null, t("cacheRead")),
            h("th", null, t("reasoning")),
            h("th", null, t("calls")))),
        h("tbody", null, keys.map(function (key) {
          var row = rows[key];
          var note = notes === undefined ? undefined : notes[key];
          var blank = note !== undefined && note.blank === true;
          var tip = note === undefined ? t("costTip") : note.tip;
          var money = blank ? "—" : fmtMoney(row.cost);
          return h("tr", { key: key },
            h("td", { title: titles !== undefined && titles[key] !== undefined ? titles[key] : undefined }, key),
            h("td", { className: blank ? "dshtu_nd" : undefined },
              tooltip === null
                ? h("span", { title: tip }, money)
                : h(tooltip, { label: h("div", { className: "dshtu_pop" }, tip), side: "top", delayMs: 250 }, h("span", { className: "dshtu_moneyCell" }, money))),
            h("td", null, fmtValue(row.total, unit)),
            h("td", null, fmtValue(row.input, unit)),
            h("td", null, fmtValue(row.output, unit)),
            h("td", null, fmtValue(row.cacheRead, unit)),
            h("td", null, fmtValue(row.reasoning, unit)),
            h("td", null, fmtValue(row.calls, unit)));
        }))));
  }

  /**
   * Trend layers: the three billed components stack into the total envelope,
   * the total rides on top as a reference line, and each day's amount is drawn
   * as bars against its own axis. Calls stay in the tooltip — a third value
   * axis would crowd a narrow panel.
   */
  var CHART_SERIES = [
    { key: "cacheRead", label: "cacheRead", color: "#8b5cf6", fill: "rgba(139,92,246,.40)", stack: "tokens" },
    { key: "output", label: "output", color: "#f59e0b", fill: "rgba(245,158,11,.55)", stack: "tokens" },
    { key: "input", label: "input", color: "#10b981", fill: "rgba(16,185,129,.55)", stack: "tokens" },
    { key: "total", label: "total", color: "#4d6bfe", width: 2, line: true, axis: 0, z: 12 },
    { key: "cost", label: "cost", kind: "bar", color: "rgba(77,107,254,.14)", axis: 1, z: 8 }
  ];

  /** One unit for a whole axis: tick labels must not mix 3000万 and 1.2亿. */
  function axisScale(max, unit) {
    var scales = unit === "en"
      ? [[1e9, "B"], [1e6, "M"], [1e3, "K"]]
      : [[1e8, "亿"], [1e4, "万"], [1e3, "千"]];
    for (var i = 0; i < scales.length; i++) {
      if (max >= scales[i][0]) return scales[i];
    }
    return [1, ""];
  }

  /**
   * Trend chart. Composition of the three billed components stacked against the
   * token axis, the total on top as a reference line, each day's amount as bars
   * against the money axis, calls in the tooltip. A day with no usage is a real
   * zero — stacking has to see it, or the bands would bridge into fake wedges —
   * while the tooltip still names it.
   */
  function buildChartOption(t, unit, trend) {
    var days = Object.keys(trend.days || {}).sort();
    var valueOf = function (day, key) {
      var bucket = trend.days[day];
      return bucket === undefined ? 0 : bucket[key] || 0;
    };
    var peak = 0;
    for (var index = 0; index < days.length; index++) {
      var bucket = trend.days[days[index]];
      if (bucket !== undefined && (bucket.calls || 0) > 0 && bucket.total > peak) peak = bucket.total;
    }
    var scale = axisScale(peak, unit);
    var dot = function (color) {
      return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + ';margin-right:6px;vertical-align:middle"></span>';
    };
    return {
      animation: false,
      grid: { left: 6, right: 6, top: 38, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: "rgba(77,107,254,.35)", width: 1, type: "dashed" } },
        borderWidth: 0,
        padding: [8, 10],
        extraCssText: "border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);",
        textStyle: { fontSize: 12 },
        formatter: function (params) {
          if (!params || params.length === 0) return "";
          var day = days[params[0].dataIndex];
          var bucket = trend.days[day];
          var head = '<div style="font-size:12px;margin-bottom:4px">' + day + " · " + t("cost") + " <b>" + fmtMoney(bucket === undefined ? 0 : bucket.cost) + "</b></div>";
          if (bucket === undefined || (bucket.calls || 0) === 0) return head + '<div style="font-size:12px;opacity:.7">' + t("trendNoData") + "</div>";
          var rows = CHART_SERIES.filter(function (s) { return s.kind !== "bar"; }).map(function (s) {
            return '<div style="font-size:12px">' + dot(s.color) + t(s.label) + " <b>" + fmtValue(bucket[s.key] || 0, unit) + "</b></div>";
          }).join("");
          return head + rows + '<div style="font-size:12px">' + dot("#f43f5e") + t("calls") + " <b>" + bucket.calls + "</b></div>";
        }
      },
      legend: {
        top: 0,
        right: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 14,
        textStyle: { fontSize: 12 },
        data: [t("total"), t("cacheRead"), t("output"), t("input"), t("cost")]
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: days.map(function (d) { return d.slice(5); }),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "rgba(0,0,0,.08)" } },
        axisLabel: { margin: 10, hideOverlap: true }
      },
      yAxis: [
        {
          type: "value",
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { formatter: function (v) { return v === 0 ? "0" : trimNum(v / scale[0], v / scale[0] < 10 ? 1 : 0) + scale[1]; }, margin: 10 },
          splitLine: { lineStyle: { color: "rgba(0,0,0,.07)", type: "dashed" } }
        },
        {
          type: "value",
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { formatter: function (v) { return fmtMoney(v); }, margin: 8 },
          splitLine: { show: false }
        }
      ],
      series: CHART_SERIES.map(function (s) {
        var data = days.map(function (d) { return valueOf(d, s.key); });
        if (s.kind === "bar") {
          return {
            name: t(s.label),
            type: "bar",
            yAxisIndex: s.axis,
            z: s.z,
            barWidth: "44%",
            itemStyle: { color: s.color, borderColor: "rgba(77,107,254,.30)", borderWidth: 1, borderRadius: [2, 2, 0, 0] },
            data: data
          };
        }
        return {
          name: t(s.label),
          type: "line",
          yAxisIndex: s.axis,
          z: s.z,
          stack: s.stack,
          smooth: 0.25,
          smoothMonotone: "x",
          showSymbol: false,
          symbol: "circle",
          connectNulls: true,
          lineStyle: { width: s.width || 1.5, color: s.color, cap: "round" },
          itemStyle: { color: s.color, borderWidth: 0 },
          emphasis: { focus: "series", scale: 1.4 },
          areaStyle: s.stack === undefined ? undefined : { color: s.fill, opacity: 1 },
          data: data
        };
      })
    };
  }

  function TrendChart(props) {
    var t = props.t;
    var unit = props.unit;
    var trend = props.trend || { days: {} };
    var range = props.range;
    var holder = react.useRef(null);
    var chart = react.useRef(null);
    var all = Object.keys(trend.days || {}).sort();
    var days = range > 0 ? all.slice(-range) : all;
    var shown = { from: days[0] || trend.from, to: days[days.length - 1] || trend.to, days: {} };
    days.forEach(function (day) { shown.days[day] = trend.days[day]; });
    var cost = days.reduce(function (sum, day) { return sum + ((trend.days[day] || {}).cost || 0); }, 0);

    useEffect(function () {
      var echarts = globalThis.__DSHTU_ECHARTS__;
      if (!echarts || !holder.current || days.length < 2) return undefined;
      if (chart.current === null) chart.current = echarts.init(holder.current, null, { renderer: "canvas" });
      chart.current.setOption(buildChartOption(t, unit, shown), true);
      var onResize = function () { if (chart.current) chart.current.resize(); };
      window.addEventListener("resize", onResize);
      return function () { window.removeEventListener("resize", onResize); };
    }, [t, unit, trend, range, days.length]);

    useEffect(function () {
      return function () {
        if (chart.current) {
          chart.current.dispose();
          chart.current = null;
        }
      };
    }, []);

    if (days.length < 2) {
      return h("div", { className: "dshtu_card dshtu_meta" }, t("trendEmpty"));
    }
    var rangeButton = function (value) {
      return h(chip, {
        key: value,
        active: range === value,
        onClick: function () { if (props.onRange !== undefined) props.onRange(value); }
      }, value + t("daysSuffix"));
    };
    return h("div", { className: "dshtu_card" },
      h("div", { className: "dshtu_bar" },
        h("span", { className: "dshtu_meta dshtu_cardTitle" },
          iconTrend === null ? null : h("span", { className: "dshtu_metaIcon" }, h(iconTrend, {})),
          t("trend") + " · " + shown.from + " ~ " + shown.to + " · " + t("cost") + " " + fmtMoney(cost)),
        h("span", { style: { flex: "1" } }),
        h("span", { className: "dshtu_chips" }, rangeButton(7), rangeButton(30), rangeButton(90))),
      h("div", { className: "dshtu_chart", ref: holder }));
  }

  /** Money stat card: the headline amount plus the ⓘ that reveals the notes. */
  function moneyBox(t, label, value, notes) {
    return h("div", { className: "dshtu_stat", "data-main": true },
      h("b", null, fmtMoney(value)),
      h("span", { className: "dshtu_statLabel" }, label, noteTrigger(t, notes)));
  }

  /** Rate line behind one model's amount: cache-hit / cache-miss / output. */
  function priceTip(t, entry) {
    var rates = function (price) { return fmtMoney(price.off) + "/" + fmtMoney(price.peak); };
    return entry.label + " · " + t("costTip") + " — " + t("cacheRead") + " " + rates(entry.hit)
      + " · " + t("input") + " " + rates(entry.miss) + " · " + t("output") + " " + rates(entry.out)
      + " /1M (" + t("unitOffPeak") + "/" + t("unitPeak") + ")";
  }

  /** Per-row money cells for the model table: a rate tooltip, or why there is none. */
  function modelNotes(t, pricing) {
    var notes = {};
    Object.keys(pricing || {}).forEach(function (name) {
      var entry = pricing[name];
      if (entry.status === "priced") {
        notes[name] = { tip: priceTip(t, entry) };
      } else {
        notes[name] = { blank: true, tip: (entry.status === "excluded" ? t("reasonExcluded") : t("reasonUnmatched")) + " · " + t("notPriced") };
      }
    });
    return notes;
  }

  /**
   * Where the amounts come from, and what they leave out. Returns both the
   * rendered lines (for the hover layer) and the same text flattened, which is
   * what the layer's copy button puts on the clipboard.
   */
  function pricingNotes(t, data) {
    var pricing = data.pricing || {};
    var notes = data.modelPricing || {};
    var nodes = [];
    var texts = [];
    var push = function (key, node, text, spaced) {
      nodes.push(h("div", { key: key, style: spaced === true ? { marginTop: "5px" } : undefined }, node));
      texts.push(text);
    };
    var bits = [];
    if (pricing.builtIn === true) {
      var offline = pricing.error ? t("priceBuiltIn").replace("{error}", pricing.error) : t("priceOffline");
      bits.push({ node: h("span", { key: "src" }, offline), text: offline });
    } else if (pricing.source) {
      var shown = String(pricing.source).replace(/^https?:\/\//, "");
      bits.push({ node: h("span", { key: "src" }, t("priceSource") + " " + shown), text: t("priceSource") + " " + pricing.source });
    }
    if (pricing.fetchedAt > 0) {
      var fetched = t("priceFetched").replace("{time}", fmtTime(pricing.fetchedAt));
      bits.push({ node: h("span", { key: "at" }, fetched), text: fetched });
    }
    if (pricing.nextRefreshAt > 0) {
      var next = t("priceNext").replace("{time}", fmtTime(pricing.nextRefreshAt));
      bits.push({ node: h("span", { key: "next" }, next), text: next });
    }
    if (pricing.peak) {
      var peak = t("pricePeak").replace("{ranges}", pricing.peak.hoursUtc.map(function (range) { return range[0] + "-" + range[1]; }).join(" / "));
      bits.push({ node: h("span", { key: "peak" }, peak), text: peak });
    }
    if (pricing.peakParsed === false) {
      bits.push({ node: h("span", { key: "peakAssumed" }, t("pricePeakAssumed")), text: t("pricePeakAssumed") });
    }
    var meta = [];
    bits.forEach(function (bit, index) {
      if (index > 0) meta.push(h("span", { className: "dshtu_sep", key: "sep" + index }, "·"));
      meta.push(bit.node);
    });
    push("text", t("costTipLong"), t("costTipLong"));
    push("meta", meta, bits.map(function (bit) { return bit.text; }).join(" · "), true);
    var skipped = Object.keys(notes).filter(function (name) { return notes[name].status !== "priced"; });
    if (skipped.length > 0) {
      var reason = function (name) { return notes[name].status === "excluded" ? t("reasonExcluded") : t("reasonUnmatched"); };
      push("skipped", t("notPriced") + "：" + skipped.map(function (name) {
        return name + "（" + reason(name) + "）";
      }).join("、"), t("notPriced") + ": " + skipped.map(function (name) {
        return name + " (" + reason(name) + ")";
      }).join(", "), true);
    }
    var auxiliary = data.auxiliary;
    if (auxiliary && auxiliary.total > 0) {
      var detail = [];
      if (auxiliary.search > 0) detail.push(t("auxSearch") + " " + auxiliary.search);
      if (auxiliary.title > 0) detail.push(t("auxTitle") + " " + auxiliary.title);
      var auxiliaryText = t("auxiliaryNote").replace("{count}", auxiliary.total).replace("{detail}", detail.join(" / "));
      push("auxiliary", auxiliaryText, auxiliaryText, true);
    }
    return { node: nodes, text: texts.join("\n") };
  }

  /**
   * Calendar heatmap: one column per week, one cell per day, drawn from the
   * per-day series the endpoint already ships for the trend chart. Levels are
   * quartiles of the non-zero days, so a quiet stretch still shows contrast.
   * Detail rides the cell's native `title` — 366 shell tooltips would cost far
   * more than the information is worth.
   */
  var HEAT_LEVELS = [
    null,
    "color-mix(in srgb, var(--dsw-alias-state-business-primary) 22%, transparent)",
    "color-mix(in srgb, var(--dsw-alias-state-business-primary) 45%, transparent)",
    "color-mix(in srgb, var(--dsw-alias-state-business-primary) 70%, transparent)",
    "var(--dsw-alias-state-business-primary)"
  ];
  var EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /** `9月` in Chinese, `Sep` in English — the panel's own unit switch decides. */
  function monthLabel(day, unit) {
    var month = Number(day.slice(5, 7));
    return unit === "en" ? EN_MONTHS[month - 1] : month + "月";
  }

  /** Day number since the epoch, so calendar maths never meets a timezone. */
  function dayNumber(day) {
    var parts = day.split("-").map(Number);
    return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
  }

  function heatCells(trend, metric) {
    var days = Object.keys(trend || {}).sort();
    if (days.length === 0) return { weeks: [], limits: [0, 0, 0] };
    var valueOf = function (day) {
      var bucket = trend[day] || {};
      return metric === "cost" ? (bucket.cost || 0) : (bucket.total || 0);
    };
    var numbers = days.map(valueOf).filter(function (value) { return value > 0; }).sort(function (a, b) { return a - b; });
    var at = function (q) { return numbers.length === 0 ? 0 : numbers[Math.min(numbers.length - 1, Math.floor(numbers.length * q))]; };
    var limits = [at(0.25), at(0.5), at(0.75)];
    // 1970-01-01 was a Thursday, so Monday-first rows start at offset 3.
    var first = dayNumber(days[0]);
    var last = dayNumber(days[days.length - 1]);
    var offset = (first + 3) % 7;
    var weeks = []
    for (var week = 0; week * 7 < last - first + 1 + offset; week++) {
      var column = [];
      for (var row = 0; row < 7; row++) {
        var number = first - offset + week * 7 + row;
        column.push(number >= first && number <= last ? days[number - first] : (number > last ? "future" : null));
      }
      weeks.push(column);
    }
    return { weeks: weeks, limits: limits, valueOf: valueOf };
  }

  /** `少 ▢▢▢▢ 多` — the colour key, shown in the card header. */
  function heatLegend(t) {
    return h("span", { className: "dshtu_heatLegend" }, [
      h("span", { key: "less" }, t("heatLess")),
      h("i", { key: "l0" }),
      h("i", { key: "l1", style: { background: HEAT_LEVELS[1] } }),
      h("i", { key: "l2", style: { background: HEAT_LEVELS[2] } }),
      h("i", { key: "l3", style: { background: HEAT_LEVELS[3] } }),
      h("i", { key: "l4", style: { background: HEAT_LEVELS[4] } }),
      h("span", { key: "more" }, t("heatMore"))
    ]);
  }

  function Heatmap(props) {
    var t = props.t;
    var unit = props.unit;
    // The newest day is the interesting one: open scrolled to the right edge,
    // the way a calendar heatmap is normally read.
    var scroller = useRef(null);
    useEffect(function () {
      if (scroller.current !== null) scroller.current.scrollLeft = scroller.current.scrollWidth;
    }, [props.metric]);
    var grid = heatCells(props.trend, props.metric);
    if (grid.weeks.length === 0) return h("div", { className: "dshtu_meta" }, t("heatEmpty"));
    var levelOf = function (value) {
      if (value <= 0) return 0;
      if (value <= grid.limits[0]) return 1;
      if (value <= grid.limits[1]) return 2;
      if (value <= grid.limits[2]) return 3;
      return 4;
    };
    var titled = function (day) {
      var bucket = props.trend[day] || {};
      return t("heatCell")
        .replace("{day}", day)
        .replace("{total}", fmtValue(bucket.total || 0, unit))
        .replace("{cost}", fmtMoney(bucket.cost || 0))
        .replace("{calls}", String(bucket.calls || 0));
    };
    var labeled = null;
    // The month label lives inside its own week column (absolutely positioned, so
    // it can overflow without widening the 11px column), which keeps it aligned
    // with the cells underneath no matter how the row is scrolled or sized.
    var columns = grid.weeks.map(function (column, index) {
      var firstDay = column.filter(function (day) { return day !== null && day !== "future"; })[0];
      var label = "";
      if (firstDay !== undefined) {
        var month = firstDay.slice(0, 7);
        if (month !== labeled) {
          labeled = month;
          label = monthLabel(firstDay, unit);
        }
      }
      var head = h("div", { className: "dshtu_heatColHead", key: "h" + index },
        label === "" ? null : h("span", { className: "dshtu_heatColLabel" }, label));
      return h("div", { className: "dshtu_heatCol", key: "w" + index }, [head].concat(column.map(function (day, row) {
        if (day === null) return h("div", { className: "dshtu_heatCell", key: "p" + index + "-" + row });
        if (day === "future") return h("div", { className: "dshtu_heatCell", key: "f" + index + "-" + row, "data-future": "true" });
        var value = grid.valueOf(day);
        return h("div", {
          key: day,
          className: "dshtu_heatCell",
          title: titled(day),
          style: { background: value > 0 ? HEAT_LEVELS[levelOf(value)] : undefined }
        });
      })));
    });
    return h("div", { className: "dshtu_heatCard" },
      h("div", { className: "dshtu_heatScroll", ref: scroller },
        h("div", { className: "dshtu_heatBody" },
          h("div", { className: "dshtu_heatDays" }, [
            h("span", { className: "dshtu_heatColHead", key: "head" }),
            h("span", { className: "dshtu_heatDay", key: "1" }, "一"),
            h("span", { className: "dshtu_heatDay", key: "2" }),
            h("span", { className: "dshtu_heatDay", key: "3" }, "三"),
            h("span", { className: "dshtu_heatDay", key: "4" }),
            h("span", { className: "dshtu_heatDay", key: "5" }, "五"),
            h("span", { className: "dshtu_heatDay", key: "6" }),
            h("span", { className: "dshtu_heatDay", key: "7" }, "日")
          ]),
          h("div", { className: "dshtu_heat" }, columns))));
  }

  /** Replace one probe row in a bundle-probe list. */
  function updateRow(list, name, patch) {
    return list.map(function (row) {
      return row.name === name ? { name: row.name, status: patch.status, detail: patch.detail } : row;
    });
  }

  /** `628 KB` — only when the response actually declares its length. */
  function sizeText(response) {
    var length = response.headers.get("content-length");
    if (length === null) return "";
    var kb = Math.round(Number(length) / 1024);
    return Number.isFinite(kb) && kb > 0 ? " · " + kb + " KB" : "";
  }

  /**
   * The self-check report: what this endpoint answers, what the browser can
   * actually load, and what the host found wrong inside the profile. The client
   * bundle check has to live here — the served URL carries a build revision that
   * only the boot manifest knows, so the browser is the only honest prober.
   */
  function HealthPanel(props) {
    var t = props.t;
    var health = props.health;
    var harness = props.harness;
    var bundles = props.bundles;
    if (health === null && harness === null) {
      return h("div", { className: "dshtu_card dshtu_meta" }, t("healthChecking"));
    }
    var checks = harness === null ? [] : (harness.checks || []);
    var bundleRows = bundles === null ? [] : bundles;
    var statuses = checks.map(function (check) { return check.status; }).concat(bundleRows.map(function (row) { return row.status; }));
    if (health !== null && health.state === "error") statuses.push("error");
    var tone = statuses.indexOf("error") !== -1 ? "bad" : statuses.indexOf("warn") !== -1 ? "warn" : health === null || health.state === "running" ? "idle" : "ok";
    var toneLabel = tone === "bad" ? t("healthToneError") : tone === "warn" ? t("healthToneWarn") : tone === "ok" ? t("healthToneOk") : t("healthToneIdle");
    var row = function (key, label, value, status) {
      return [
        h("dt", { key: key }, label),
        h("dd", { key: key + "v" },
          status === undefined ? null : h("span", { className: "dshtu_state", "data-tone": status === "ok" ? "ok" : status === "error" ? "bad" : "warn" },
            status === "ok" ? (iconCheck === null ? null : h(iconCheck, {})) : status === "error" ? (iconWarn === null ? null : h(iconWarn, {})) : (iconClock === null ? null : h(iconClock, {})),
            " "),
          value)
      ];
    };
    var endpointRows = [];
    if (health !== null && health.state === "ok") {
      var scan = health.data.scan;
      var pricing = health.data.pricing || {};
      endpointRows = endpointRows.concat(row("latency", t("healthLatency"), health.ms + " ms", "ok"));
      endpointRows = endpointRows.concat(row("version", t("healthEndpoint"), health.data.version, health.data.version === props.version ? "ok" : "warn"));
      endpointRows = endpointRows.concat(row("scan", t("healthScan"),
        scan === null ? "—" : scan.error !== undefined && scan.error !== null ? t("healthScanFailed") : scan.done
          ? t("healthScanDone").replace("{sessions}", scan.sessions).replace("{files}", scan.files).replace("{ms}", scan.ms)
          : t("healthScanRunning"),
        scan === null ? "warn" : scan.error !== undefined && scan.error !== null ? "error" : "ok"));
      endpointRows = endpointRows.concat(row("pricing", t("healthPricing"),
        t("healthPricingValue").replace("{source}", pricing.source || "—").replace("{time}", fmtTime(pricing.fetchedAt || 0)),
        (pricing.fetchedAt || 0) > 0 ? "ok" : "warn"));
      endpointRows = endpointRows.concat(row("buckets", t("healthBuckets"),
        t("healthBucketsValue").replace("{days}", String(Object.keys(health.data.byDay || {}).length)).replace("{models}", String((health.data.models || []).length)),
        "ok"));
      endpointRows = endpointRows.concat(row("updated", t("healthUpdated"), fmtTime(health.data.updatedAt), "ok"));
    } else if (health !== null && health.state === "error") {
      endpointRows = endpointRows.concat(row("failed", t("healthFail"), health.error, "error"));
    }
    var checkLabel = {
      profile: "checkProfile",
      plugins: "checkPlugins",
      deps: "checkDeps",
      cordis: "checkCordis",
      versions: "checkVersions"
    };
    /** The host reports structure; every sentence is composed here. */
    var summaryOf = function (check) {
      var data = check.data || {};
      if (check.id === "profile") {
        return data.name === undefined
          ? t("hintNoProfile").replace("{root}", data.root || "")
          : t("healthSummaryProfile").replace("{name}", data.name).replace("{dir}", data.dir);
      }
      if (check.id === "plugins") return t("healthSummaryPlugins").replace("{ok}", String(data.ok)).replace("{total}", String(data.total));
      if (check.id === "deps") return t("healthSummaryDeps").replace("{count}", String(data.count));
      if (check.id === "cordis") return t("healthSummaryCordis").replace("{copies}", String(data.copies));
      if (check.id === "versions") return data.commandVersion === null ? t("versionUnknown") : t("healthSummaryVersions").replace("{version}", data.commandVersion);
      return "";
    };
    var codeText = function (item) {
      if (item.code === undefined || item.code === null) return item.detail;
      return item.code.split("+").map(function (code) {
        var key = "code" + code.charAt(0).toUpperCase() + code.slice(1).replace(/-([a-z])/g, function (all, letter) { return letter.toUpperCase(); });
        return t(key).replace("{detail}", item.detail === null || item.detail === undefined ? "" : item.detail);
      }).join("；");
    };
    var hintText = function (hint, name) {
      if (hint === undefined || hint === null) return null;
      var key = "hint" + hint.charAt(0).toUpperCase() + hint.slice(1).replace(/-([a-z])/g, function (all, letter) { return letter.toUpperCase(); });
      return t(key).replace("{name}", name === undefined ? "" : name);
    };
    var detailLine = function (item, index) {
      var text = codeText(item);
      return h("li", { key: (item.name || "") + index, className: "dshtu_meta" },
        item.name === undefined || item.name === "" ? null : item.name + " — ",
        text.length === 0 ? null : text,
        hintText(item.hint, item.name) === null ? null : h("span", null, " · " + t("healthHint").replace("{hint}", hintText(item.hint, item.name))));
    };
    return h("div", { className: "dshtu_card" },
      h("div", { className: "dshtu_head" },
        iconCheck === null ? null : h(iconCheck, {}),
        h("h3", null, t("healthResults")),
        h("span", { style: { flex: "1" } }),
        h("span", { className: "dshtu_state", "data-tone": tone }, toneLabel)),
      endpointRows.length === 0 ? null : h("div", null,
        h("div", { className: "dshtu_meta" }, t("healthSectionEndpoint")),
        h("dl", { className: "dshtu_health" }, endpointRows)),
      bundleRows.length === 0 ? null : h("div", null,
        h("div", { className: "dshtu_meta", style: { marginTop: "10px" } }, t("healthSectionClient")),
        h("dl", { className: "dshtu_health" }, bundleRows.map(function (entry) {
          return [h("dt", { key: entry.name }, entry.name), h("dd", { key: entry.name + "v" }, h("span", { className: "dshtu_state", "data-tone": entry.status === "ok" ? "ok" : entry.status === "error" ? "bad" : "warn" }, entry.detail))];
        }).reduce(function (flat, pair) { return flat.concat(pair); }, []))),
      checks.length === 0 ? null : h("div", null,
        h("div", { className: "dshtu_meta", style: { marginTop: "10px" } }, t("healthSectionHarness")),
        h("dl", { className: "dshtu_health" }, checks.map(function (check) {
          var glyph = check.status === "ok" ? iconCheck : check.status === "error" ? iconWarn : iconClock;
          var failing = (check.items || []).filter(function (item) { return item.status !== "ok"; });
          var hint = hintText(check.hint, undefined);
          return [
            h("dt", { key: check.id }, checkLabel[check.id] === undefined ? check.id : t(checkLabel[check.id])),
            h("dd", { key: check.id + "v" },
              h("span", { className: "dshtu_state", "data-tone": check.status === "ok" ? "ok" : check.status === "error" ? "bad" : "warn" },
                glyph === null ? null : h(glyph, {}),
                " ",
                summaryOf(check)),
              failing.length === 0 ? null : h("ul", { className: "dshtu_checkList" }, failing.slice(0, 8).map(detailLine)),
              hint === null || check.status === "ok" ? null : h("div", { className: "dshtu_meta" }, t("healthHint").replace("{hint}", hint)))
          ];
        }).reduce(function (flat, pair) { return flat.concat(pair); }, []))));
  }

  /** `已安装 / 最新 / 状态` for one tracked package. */
  function versionRow(t, entry) {
    var tone = entry.status === "current" ? "ok" : (entry.status === "outdated" ? "warn" : "idle");
    var label = entry.status === "current" ? t("versionCurrent")
      : entry.status === "outdated" ? t("versionOutdated")
      : entry.status === "ahead" ? t("versionAhead") : t("versionUnknown");
    var glyph = entry.status === "current" ? iconCheck : (entry.status === "outdated" ? iconWarn : iconClock);
    return h("tr", { key: entry.id },
      h("td", null,
        h("span", { className: "dshtu_statLabel" },
          h("b", null, entry.label),
          entry.channel !== "stable" ? h("span", { className: "dshtu_nd" }, " · " + t("versionChannel").replace("{channel}", entry.channel)) : null)),
      h("td", { className: "dshtu_verCell" }, entry.installed === null ? "—" : entry.installed),
      h("td", { className: "dshtu_verCell" }, entry.latest === null ? "—" : entry.latest),
      // The status stays a real table cell so its column lines up with the
      // header; the inline-flex badge lives inside it.
      h("td", null, h("span", { className: "dshtu_state", "data-tone": tone },
        glyph === null ? null : h(glyph, {}),
        entry.error === null ? label : label + "（" + entry.error + "）")));
  }

  /** Uptime as `2d 3h` / `45m`, whichever reads better at this scale. */
  function uptimeText(t, seconds) {
    var total = seconds || 0;
    if (total < 3600) return t("runtimeUptimeShort").replace("{minutes}", String(Math.max(1, Math.round(total / 60))));
    return t("runtimeUptimeValue").replace("{days}", String(Math.floor(total / 86400))).replace("{hours}", String(Math.floor((total % 86400) / 3600)));
  }

  /**
   * The configuration tab: what is installed against what the registry offers,
   * the runtime facts of the process serving this page, and the two buttons that
   * act on it — a real health check and a confirmed restart.
   */
  function ConfigPanel(props) {
    var t = props.t;
    var config = props.config;
    if (config === null) {
      return h("div", { className: "dshtu_card dshtu_meta" }, props.error === null ? t("loading") : t("error") + ": " + props.error);
    }
    var runtime = config.platform || {};
    var health = props.health;
    var rows = [];
    if (health && health.state === "ok") {
      var pricing = health.data.pricing || {};
      var scan = health.data.scan;
      var scanText = scan === null ? "—"
        : scan.error !== undefined && scan.error !== null ? t("healthScanFailed")
        : scan.done ? t("healthScanDone").replace("{sessions}", scan.sessions).replace("{files}", scan.files).replace("{ms}", scan.ms)
        : t("healthScanRunning");
      rows.push(["healthLatency", health.ms + " ms"]);
      rows.push(["healthEndpoint", health.data.version]);
      rows.push(["healthScan", scanText]);
      rows.push(["healthPricing", t("healthPricingValue").replace("{source}", pricing.source || "—").replace("{time}", fmtTime(pricing.fetchedAt || 0))]);
      rows.push(["healthBuckets", t("healthBucketsValue").replace("{days}", String(Object.keys(health.data.byDay || {}).length)).replace("{models}", String((health.data.models || []).length))]);
      rows.push(["healthUpdated", fmtTime(health.data.updatedAt)]);
    }
    var tone = health === null ? "idle" : health.state === "ok" ? "ok" : health.state === "error" ? "bad" : "idle";
    var healthLabel = health === null ? null : health.state === "ok" ? t("healthOk") : health.state === "error" ? t("healthFail") + "：" + health.error : t("healthRunning");
    return h("div", { className: "dshtu_stack" },
      h("div", { className: "dshtu_card" },
        h("div", { className: "dshtu_head" }, iconApi === null ? null : h(iconApi, {}), h("h3", null, t("configVersions"))),
        h("table", { className: "dshtu_table" },
          h("thead", null, h("tr", null,
            h("th", null, t("versionPackage")),
            h("th", null, t("versionInstalled")),
            h("th", null, t("versionLatest")),
            h("th", null, t("versionState")))),
          h("tbody", null, (config.packages || []).map(function (entry) { return versionRow(t, entry); }))),
        h("div", { className: "dshtu_bar dshtu_tblBar" },
          h("span", { className: "dshtu_meta" }, config.checkedAt > 0 ? t("versionChecked").replace("{time}", fmtTime(config.checkedAt)) : ""),
          h("span", { style: { flex: "1" } }),
          h(button, {
            variant: "outline",
            size: "sm",
            icon: iconRefresh === null ? null : h(iconRefresh, {}),
            onClick: props.onRefresh
          }, t("versionRefresh")))),
      h("div", { className: "dshtu_card" },
        h("div", { className: "dshtu_head" }, iconGauge === null ? null : h(iconGauge, {}), h("h3", null, t("configRuntime"))),
        h("dl", { className: "dshtu_kv" }, [
          ["runtimePlatform", runtime.osName === undefined ? "—" : runtime.osName + " (" + (runtime.arch || "") + ")"],
          ["runtimeNode", runtime.node || "—"],
          ["runtimePid", runtime.pid === undefined ? "—" : String(runtime.pid)],
          ["runtimePort", runtime.port === null || runtime.port === undefined ? "—" : String(runtime.port)],
          ["runtimeUptime", runtime.uptimeSec === undefined ? "—" : uptimeText(t, runtime.uptimeSec)],
          ["runtimeHome", runtime.dshHome || "—"]
        ].map(function (pair) {
          return [h("dt", { key: pair[0] }, t(pair[0])), h("dd", { key: pair[0] + "v" }, pair[1])];
        }).reduce(function (flat, pair) { return flat.concat(pair); }, [])),
        h("div", { className: "dshtu_acts" },
          h(button, {
            variant: "outline",
            size: "sm",
            icon: iconCheck === null ? null : h(iconCheck, {}),
            disabled: health !== null && health.state === "running",
            onClick: props.onHealth
          }, t("healthCheck")),
          config.restartable === false
            ? h("span", { className: "dshtu_meta" }, t("restartBlocked"))
            : h(button, {
              variant: "primary",
              size: "sm",
              icon: iconRefresh === null ? null : h(iconRefresh, {}),
              disabled: props.restart !== null && props.restart.state !== "error",
              onClick: props.onRestart
            }, t("restart")),
          healthLabel === null ? null : h("span", { className: "dshtu_state", "data-tone": tone },
            health.state === "running" && iconLoading !== null ? h(iconLoading, {}) : null,
            healthLabel)),
        props.restart === null ? null : h("div", { className: "dshtu_meta", style: { marginTop: "10px" } },
          props.restart.state === "pending" ? t("restartPending")
            : props.restart.state === "done" ? t("restartDone")
            : t("restartFailed").replace("{error}", props.restart.error))),
      h(HealthPanel, {
        key: "health",
        t: t,
        health: health,
        harness: props.harness,
        bundles: props.bundles,
        version: config.version
      }));

  }

  function Tab(props) {
    var t = props.t;
    var _a = useState(null), data = _a[0], setData = _a[1];
    var _b = useState(null), error = _b[0], setError = _b[1];
    var _c = useState(0), tick = _c[0], setTick = _c[1];
    var _d = useState("day"), mode = _d[0], setMode = _d[1];
    var _e = useState(today()), day = _e[0], setDay = _e[1];
    var _f = useState(thisMonth()), month = _f[0], setMonth = _f[1];
    var _g = useState(""), model = _g[0], setModel = _g[1];
    var _h = useState(function () {
      try { return localStorage.getItem("dshtu.unit") === "en" ? "en" : "zh"; } catch (err) { return "zh"; }
    }), unit = _h[0], setUnit = _h[1];
    var _i = useState(function () {
      // 7 days is the default; only an explicit 30/90 pick is remembered.
      try {
        var stored = Number(localStorage.getItem("dshtu.trendDays"));
        return stored === 30 || stored === 90 ? stored : 7;
      } catch (err) { return 7; }
    }), chartDays = _i[0], setChartDays = _i[1];
    // The custom span starts as today → today, i.e. the same window as By day.
    var _j = useState(today()), from = _j[0], setFrom = _j[1];
    var _k = useState(today()), to = _k[0], setTo = _k[1];
    var _l = useState(thisYear()), year = _l[0], setYear = _l[1];
    var _m = useState(function () {
      try {
        var stored = localStorage.getItem("dshtu.tab");
        return stored === "models" || stored === "projects" || stored === "config" ? stored : "overview";
      } catch (err) { return "overview"; }
    }), tab = _m[0], setTab = _m[1];
    var _n = useState("total"), heatMetric = _n[0], setHeatMetric = _n[1];
    var _o = useState(null), config = _o[0], setConfig = _o[1];
    var _p = useState(null), configError = _p[0], setConfigError = _p[1];
    var _q = useState(0), configTick = _q[0], setConfigTick = _q[1];
    var _r = useState(null), health = _r[0], setHealth = _r[1];
    var _s = useState(null), restart = _s[0], setRestart = _s[1];
    var _t = useState(false), confirming = _t[0], setConfirming = _t[1];
    var _u = useState(null), harness = _u[0], setHarness = _u[1];
    var _v = useState(null), bundles = _v[0], setBundles = _v[1];

    var switchTab = function (value) {
      setTab(value);
      try { localStorage.setItem("dshtu.tab", value); } catch (err) {}
    };

    var switchDays = function (value) {
      setChartDays(value);
      try { localStorage.setItem("dshtu.trendDays", String(value)); } catch (err) {}
    };

    /**
     * The custom span's two ends stay ordered: moving one past the other drags
     * the other along, so the request is never a backwards window (the endpoint
     * rejects those). An emptied field is ignored instead of sent as "".
     */
    var pickSpanEnd = function (value, which) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
      if (which === "from") {
        setFrom(value);
        if (to < value) setTo(value);
      } else {
        setTo(value);
        if (value < from) setFrom(value);
      }
      setTick(tick + 1);
    };

    var parts = [];
    if (mode === "day") parts.push("day=" + day);
    if (mode === "month") parts.push("month=" + month);
    if (mode === "year") parts.push("year=" + year);
    if (mode === "range") parts.push("from=" + from, "to=" + to);
    if (model) parts.push("model=" + encodeURIComponent(model));
    var query = parts.length > 0 ? "?" + parts.join("&") : "";

    useEffect(function () {
      var stopped = false;
      var controller = null;
      var load = function () {
        if (controller) controller.abort();
        controller = new AbortController();
        fetch("/dsh-token-use" + query, { signal: controller.signal })
          .then(function (res) {
            if (res.status === 403) throw new Error(t("remoteDenied"));
            if (!res.ok) throw new Error("http " + res.status);
            return res.json();
          })
          .then(function (json) {
            if (!stopped) { setData(json); setError(null); }
          })
          .catch(function (err) {
            if (!stopped && err.name !== "AbortError") setError(String(err));
          });
      };
      load();
      var timer = setInterval(function () {
        if (!document.hidden) load();
      }, 5000);
      var onVisible = function () { if (!document.hidden) load(); };
      document.addEventListener("visibilitychange", onVisible);
      return function () {
        stopped = true;
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
        if (controller) controller.abort();
      };
    }, [query, tick]);

    /**
     * The config tab is the only view that needs a second endpoint, so it is
     * fetched when (and only when) that tab is open — the versions report is
     * cache-backed on the host side, so re-entering the tab is cheap.
     */
    useEffect(function () {
      if (tab !== "config") return undefined;
      var stopped = false;
      fetch("/dsh-token-use/config", { cache: "no-store" })
        .then(function (res) {
          if (res.status === 403) throw new Error(t("remoteDenied"));
          if (!res.ok) throw new Error("http " + res.status);
          return res.json();
        })
        .then(function (json) {
          if (!stopped) { setConfig(json); setConfigError(null); }
        })
        .catch(function (err) {
          if (!stopped) setConfigError(String(err));
        });
      return function () { stopped = true; };
    }, [tab, configTick]);

    /**
     * The self-check: one timed snapshot call, the host's harness walk, and a
     * probe of every client bundle the server published for the profile's
     * plugins. The bundle URLs are build-revisioned, so only the boot manifest
     * of *this* page can address them — hence the probe runs here.
     */
    var runHealth = function () {
      var now = function () { return typeof performance !== "undefined" ? performance.now() : Date.now(); };
      var started = now();
      setHealth({ state: "running" });
      setHarness(null);
      setBundles(null);
      fetch("/dsh-token-use" + query, { cache: "no-store" })
        .then(function (res) {
          if (!res.ok) throw new Error("http " + res.status);
          return res.json();
        })
        .then(function (json) {
          setHealth({ state: "ok", ms: Math.round(now() - started), data: json });
        })
        .catch(function (err) {
          setHealth({ state: "error", error: String(err) });
        });
      fetch("/dsh-token-use/health", { cache: "no-store" })
        .then(function (res) {
          if (!res.ok) throw new Error("http " + res.status);
          return res.json();
        })
        .then(function (json) {
          setHarness(json);
          var plugins = (json.checks || []).filter(function (check) { return check.id === "plugins"; })[0];
          var wanted = (plugins === undefined ? [] : plugins.items || []).filter(function (item) { return item.client === true; });
          var boot = typeof window === "undefined" ? null : window.__DSH_BOOT__;
          var entries = (boot === null || boot === undefined ? [] : boot.entries || []);
          setBundles(wanted.map(function (item) {
            return { name: item.name, status: "warn", detail: t("healthChecking") };
          }));
          wanted.forEach(function (item) {
            var entry = entries.filter(function (candidate) { return candidate.id === item.name; })[0];
            if (entry === undefined) {
              setBundles(function (list) { return updateRow(list, item.name, { status: "error", detail: t("bundleNoEntry") }); });
              return;
            }
            fetch(entry.url, { cache: "no-store" })
              .then(function (res) {
                if (!res.ok) throw new Error(t("bundleFailed").replace("{status}", String(res.status)));
                var detail = t("bundleOk") + sizeText(res);
                setBundles(function (list) { return updateRow(list, item.name, { status: "ok", detail: detail }); });
              })
              .catch(function (err) {
                setBundles(function (list) { return updateRow(list, item.name, { status: "error", detail: String(err && err.message ? err.message : err) }); });
              });
          });
        })
        .catch(function (err) {
          setHarness({ ok: false, checks: [], error: String(err) });
        });
    };

    /**
     * Restart: the host answers first and runs a detached script that stops and
     * relaunches the very same command. Polling only starts once the service has
     * had time to go down (the script waits two seconds), so the first success
     * cannot be the old process answering.
     */
    var doRestart = function () {
      setConfirming(false);
      setRestart({ state: "pending" });
      fetch("/dsh-token-use/restart", { method: "POST", headers: { accept: "application/json" } })
        .then(function (res) {
          return res.json().then(function (json) {
            if (!res.ok) throw new Error(json && json.error ? json.error : "http " + res.status);
            return json;
          });
        })
        .then(function () {
          var attempts = 0;
          setTimeout(function () {
            var timer = setInterval(function () {
              attempts++;
              fetch("/dsh-token-use", { cache: "no-store" })
                .then(function (res) {
                  if (!res.ok) return;
                  clearInterval(timer);
                  setRestart({ state: "done" });
                  setTimeout(function () { location.reload(); }, 800);
                })
                .catch(function () {});
              if (attempts > 90) clearInterval(timer);
            }, 2000);
          }, 6000);
        })
        .catch(function (err) {
          setRestart({ state: "error", error: String(err) });
        });
    };

    useEffect(function () {
      // Publish this fiber's stylesheet every mount: a hot reload replaces the
      // component, and the previous fiber's <style> would otherwise keep
      // winning because it is found by id and skipped.
      var el = document.createElement("style");
      el.id = "dshtu-style";
      el.textContent = css;
      document.head.appendChild(el);
      return function () { el.remove(); };
    }, []);

    var switchUnit = function (next) {
      setUnit(next);
      try { localStorage.setItem("dshtu.unit", next); } catch (err) {}
    };

    if (error) {
      return h("div", { className: "dshtu_wrap" },
        h("div", { className: "dshtu_card dshtu_err" },
          h("span", null, t("error") + ": " + error),
          h(button, {
            variant: "outline",
            size: "sm",
            icon: iconRefresh === null ? null : h(iconRefresh, {}),
            onClick: function () { setError(null); setTick(tick + 1); }
          }, t("retry"))));
    }
    if (!data) {
      return h("div", { className: "dshtu_wrap" },
        h("div", { className: "dshtu_card dshtu_meta" }, t("loading")));
    }
    var totals = data.totals || {};
    var models = (data.models && data.models.length > 0 ? data.models : Object.keys(data.byModel || {}));
    // Newest year first, and always offer the current one even on an empty log.
    var years = (data.years && data.years.length > 0 ? data.years : [thisYear()]).slice().reverse();
    var pricing = data.pricing || {};
    setSymbol(pricing.symbol);
    var metaParts = [];
    if (data.scan && data.scan.done) {
      metaParts.push(t("scanDone").replace("{sessions}", data.scan.sessions).replace("{files}", data.scan.files).replace("{ms}", data.scan.ms));
    } else if (data.scan && data.scan.error) {
      metaParts.push(t("scanFailed").replace("{error}", data.scan.error));
    } else {
      metaParts.push(t("scanPending"));
    }
    metaParts.push(t("updated").replace("{time}", fmtTime(data.updatedAt)));
    var scanState = data.scan && data.scan.error ? "error" : (data.scan && data.scan.done ? "done" : "ongoing");
    var rangeItems = [
      { id: "day", label: t("filterDay") },
      { id: "month", label: t("filterMonth") },
      { id: "year", label: t("filterYear") },
      { id: "range", label: t("filterRange") },
      { id: "all", label: t("filterAll") }
    ];
    /** Every view keeps the same window controls; only the tables below differ. */
    var rangeControls = [
      h("label", { key: "label" }, t("filterLabel")),
      h(Dropdown, {
        key: "mode",
        value: mode,
        items: rangeItems,
        onChange: function (value) { setMode(value); setTick(tick + 1); }
      }),
      mode === "day" ? h(input, { key: "day", type: "date", value: day, onChange: function (event) { setDay(event.target.value); setTick(tick + 1); } }) : null,
      mode === "month" ? h(input, { key: "month", type: "month", value: month, onChange: function (event) { setMonth(event.target.value); setTick(tick + 1); } }) : null,
      mode === "year" ? h(Dropdown, {
        key: "year",
        value: year,
        items: years.map(function (value) { return { id: value, label: value }; }),
        onChange: function (value) { setYear(value); setTick(tick + 1); }
      }) : null,
      mode === "range" ? h("span", { key: "range", className: "dshtu_range" },
        h(input, { type: "date", value: from, onChange: function (event) { pickSpanEnd(event.target.value, "from"); } }),
        h("em", null, "→"),
        h(input, { type: "date", value: to, onChange: function (event) { pickSpanEnd(event.target.value, "to"); } })) : null
    ];
    var modelControl = h("span", { className: "dshtu_field" },
      h("label", null, t("modelLabel")),
      h(Dropdown, {
        value: model,
        items: [{ id: "", label: t("modelAll") }].concat(models.map(function (name) {
          return { id: name, label: name };
        })),
        onChange: function (value) { setModel(value); setTick(tick + 1); }
      }));
    var projects = shortenProjects(data.byProject);
    var tabBar = h("div", { className: "dshtu_tabRow" },
      h("div", { className: "dshtu_tabs" }, [
        { id: "overview", label: t("tabOverview") },
        { id: "models", label: t("tabModels") },
        { id: "projects", label: t("tabProjects") },
        { id: "config", label: t("tabConfig") }
      ].map(function (entry) {
        return h("button", {
          key: entry.id,
          type: "button",
          "data-on": String(tab === entry.id),
          onClick: function () { switchTab(entry.id); }
        }, entry.label);
      })),
      h("label", null, t("unitLabel")),
      h("span", { className: "dshtu_chips" }, chips([
        { value: "zh", label: t("unitZh") },
        { value: "en", label: t("unitEn") }
      ], unit, switchUnit)));
    var overview = [
      h("div", { className: "dshtu_card", key: "totals" },
        h("div", { className: "dshtu_bar" }, rangeControls.concat([modelControl])),
        h("div", { className: "dshtu_bar dshtu_subBar" },
          h("span", { className: "dshtu_meta" },
            iconGauge === null ? null : h("span", { className: "dshtu_metaIcon" }, h(iconGauge, {})),
            t("totals"))),
        h("div", { className: "dshtu_grid" },
          statBox(t, t("total"), totals.total, unit, true),
          statBox(t, t("input"), totals.input, unit),
          statBox(t, t("output"), totals.output, unit),
          statBox(t, t("cacheRead"), totals.cacheRead, unit),
          statBox(t, t("cacheWrite"), totals.cacheWrite, unit),
          statBox(t, t("reasoning"), totals.reasoning, unit),
          statBox(t, t("calls"), totals.calls, unit),
          moneyBox(t, t("costTotal"), totals.cost, pricingNotes(t, data)))),
      h(TrendChart, { key: "trend", t: t, unit: unit, trend: data.trend, range: chartDays, onRange: switchDays }),
      h("div", { className: "dshtu_card", key: "heat" },
        h("div", { className: "dshtu_heatHead" },
          h("span", { className: "dshtu_cardTitle" },
            iconTrend === null ? null : h("span", { className: "dshtu_metaIcon" }, h(iconTrend, {})),
            h("b", null, t("heatmap"))),
          h("span", { className: "dshtu_meta" }, t("heatmapNote")),
          h("span", { style: { flex: "1" } }),
          heatLegend(t),
          h("span", { className: "dshtu_chips" }, chips([
            { value: "total", label: t("total") },
            { value: "cost", label: t("cost") }
          ], heatMetric, function (value) { setHeatMetric(value); }))),
        h(Heatmap, { t: t, unit: unit, trend: data.trend.days, metric: heatMetric }))
    ];
    var scoped = h("div", { className: "dshtu_card dshtu_slim" }, h("div", { className: "dshtu_bar" }, rangeControls));
    var views = tab === "overview" ? overview
      : tab === "models" ? [scoped, table(t, t("byModel"), data.byModel, unit, undefined, modelNotes(t, data.modelPricing))]
      : tab === "projects" ? [scoped, table(t, t("byProject"), projects.rows, unit, projects.titles)]
      : [h(ConfigPanel, {
        key: "config",
        t: t,
        config: config,
        error: configError,
        health: health,
        restart: restart,
        harness: harness,
        bundles: bundles,
        onHealth: runHealth,
        onRestart: function () { setConfirming(true); },
        onRefresh: function () { setConfigTick(configTick + 1); }
      })];
    return h("div", { className: "dshtu_wrap" },
      tabBar,
      views,
      modal === null ? null : h(modal, {
        open: confirming,
        onClose: function () { setConfirming(false); },
        title: t("restartTitle"),
        closeLabel: t("close"),
        footer: h("div", { className: "dshtu_modalFoot" },
          h(button, { variant: "ghost", size: "sm", onClick: function () { setConfirming(false); } }, t("restartCancel")),
          h(button, { variant: "primary", size: "sm", onClick: doRestart }, t("restartConfirm")))
      }, h("div", { className: "dshtu_modalBody" },
        t("restartBody").replace("{pid}", config === null || config.platform === undefined ? "?" : String(config.platform.pid)))),
      h("div", { className: "dshtu_foot" },
        stateDot === null ? null : h(stateDot, { state: scanState, size: 8 }),
        h("span", { className: "dshtu_meta" }, metaParts.join(" · "))));
  }

  /**
   * The settings rail draws its glyph per section id and uses the same settings
   * gear for every id it does not know — the market plugin's row and ours look
   * alike because of that fallback, and a slot registration cannot name an icon.
   * The label therefore carries `.dshtu_navlabel`, and this stylesheet swaps the
   * gear for a bar-chart glyph: the structure-only selector (no shell class
   * names, so it survives their hashing) only matches while the fallback gear is
   * still rendered next to that label, which keeps the failure mode to "gear
   * stays as it was" rather than two glyphs.
   */
  var NAV_GLYPH = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2016%2016'%3E%3Cpath%20d='M2.5%2013.5h2V9h-2v4.5Zm4.5%200h2V4H7v9.5Zm4.5%200h2V6.5h-2v7Z'/%3E%3C/svg%3E";

  var navGlyphCss = "*:has(>span>.dshtu_navlabel)>svg{display:none}"
    + "*:has(>span>.dshtu_navlabel)::before{content:'';flex:0 0 auto;box-sizing:border-box;width:16px;height:16px;background-color:currentColor;opacity:.9"
    + ";mask:url(\"" + NAV_GLYPH + "\") center/16px 16px no-repeat;"
    + "-webkit-mask:url(\"" + NAV_GLYPH + "\") center/16px 16px no-repeat}";

  /**
   * Handles the newest fiber owns. A client-plugin hot reload re-applies this
   * module, and the replacement fiber must take the rail style and the settings
   * slot over from the fiber it replaces — otherwise the section would vanish
   * after every rebuild until the page is reloaded.
   */
  var railStyle = null;
  var sectionOwner = null;
  var localeOwner = null;

  function apply(ctx) {
    ctx.effect(function () {
      // A reloaded fiber replaces the dictionary it finds: re-registering the
      // same namespace on top of a still-registered one is what makes a hot
      // reload fail, and a failure here would take the whole panel down with it.
      if (localeOwner !== null) {
        try { localeOwner(); } catch (ignored) {}
        localeOwner = null;
      }
      var dispose = null;
      try {
        dispose = ctx.locale.register(NS, { zh: zh, en: en });
      } catch (error) {
        console.error("[dsh-token-use] dictionary registration failed", error);
      }
      localeOwner = typeof dispose === "function" ? dispose : null;
      return function () {
        if (localeOwner === dispose) localeOwner = null;
        if (typeof dispose === "function") dispose();
      };
    }, "dsh-token-use: dictionaries");
    ctx.effect(function () {
      var style = document.createElement("style");
      style.id = "dshtu-nav-style";
      style.textContent = navGlyphCss;
      document.head.appendChild(style);
      railStyle = style;
      return function () {
        style.remove();
        if (railStyle === style) railStyle = null;
      };
    }, "dsh-token-use: rail glyph");
    var t = ctx.locale.bind(NS);
    ctx.slots.inject("settings.section", function () {
      var register = function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "token-usage",
          order: 90,
          // The settings rail picks its glyph by section id (`navIcon(id)`) and
          // falls back to the settings gear for every id it does not know, so
          // this label carries a marker the stylesheet hangs our own chart glyph
          // on: `navGlyphCss` hides the gear and masks a bar chart into its place.
          // If a future shell changes that markup the selector stops matching and
          // the gear simply stays — never two glyphs at once.
          label: function () { return h("span", { className: "dshtu_navlabel" }, t("tab")); },
          locale: NS,
          inject: function () { return { t: t }; }
        }, function (props) { return h(Tab, props); });
      };
      var dispose;
      try {
        dispose = register();
      } catch (error) {
        // The reloaded fiber can land while the previous registration is still
        // on the ledger: retire it and claim the slot for this fiber.
        if (sectionOwner !== null) {
          try { sectionOwner(); } catch (ignored) {}
          sectionOwner = null;
        }
        dispose = register();
      }
      sectionOwner = dispose;
      return function () {
        if (sectionOwner === dispose) sectionOwner = null;
        dispose();
      };
    });
  }

  exports.NS = NS;
  exports.apply = apply;
  exports.inject = inject;
  return module.exports;
} });
