window.__ModuleLoader__.load({ id: "dsh-token-use", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  var react = require("react");
  var useEffect = react.useEffect;
  var useState = react.useState;
  var h = react.createElement;

  /**
   * The app's own floating tooltip, when this build exposes it: it positions in
   * viewport coordinates, clamps to the window and flips sides, so it is never
   * clipped by the settings panel. Older builds fall back to the title
   * attribute, which the browser draws itself.
   */
  var tooltip = null;
  try {
    var primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    if (primitives !== null && typeof primitives === "object" && typeof primitives.Tooltip === "function") tooltip = primitives.Tooltip;
  } catch (error) {
    tooltip = null;
  }

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
    filterMonth: "按月",
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
    retry: "重试"
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
    filterMonth: "By month",
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
    retry: "Retry"
  };

  var css = ".dshtu_wrap{max-width:860px;display:flex;flex-direction:column;gap:14px;padding:2px 2px 4px;color:var(--dsw-alias-label-primary);font-size:13px}.dshtu_card{background:var(--dsw-alias-bg-layer-3);border-radius:14px;box-shadow:var(--dsw-elevation-stroke);padding:14px 16px}.dshtu_bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dshtu_bar label{color:var(--dsw-alias-label-tertiary);font-size:12px}.dshtu_bar select,.dshtu_bar input{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:4px 8px;font-size:12.5px}.dshtu_bar select{width:168px;text-overflow:ellipsis;white-space:nowrap}.dshtu_field{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.dshtu_seg{display:inline-flex;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;overflow:hidden}.dshtu_seg button{border:0;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;padding:4px 10px;font-size:12.5px}.dshtu_seg button[data-on=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dshtu_totalsMeta{margin-top:12px}.dshtu_grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:8px}.dshtu_stat{background:var(--dsw-alias-bg-module-platform);border-radius:10px;padding:10px 12px}.dshtu_stat b{display:block;font-size:16px;line-height:24px;font-variant-numeric:tabular-nums}.dshtu_stat span{color:var(--dsw-alias-label-tertiary);font-size:12px}.dshtu_stat[data-main=true]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,var(--dsw-alias-bg-module-platform))}.dshtu_stat[data-main=true] b{color:var(--dsw-alias-state-business-primary);font-size:20px}.dshtu_table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}.dshtu_table th,.dshtu_table td{text-align:right;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l2);font-weight:400}.dshtu_table th:first-child,.dshtu_table td:first-child{text-align:left}.dshtu_table th{color:var(--dsw-alias-label-tertiary);font-size:12px;white-space:nowrap}.dshtu_table td:first-child{overflow-wrap:anywhere;max-width:300px;color:var(--dsw-alias-label-secondary)}.dshtu_meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.dshtu_err{color:var(--dsw-alias-state-error-primary);display:flex;align-items:center;gap:10px}.dshtu_err button{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:4px 10px}.dshtu_chart{width:100%;height:260px}.dshtu_info{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:15px;height:15px;margin-left:5px;border:.5px solid var(--dsw-alias-border-l3);border-radius:50%;color:var(--dsw-alias-label-tertiary);font-size:9px;font-style:normal;line-height:1;cursor:help}.dshtu_info:hover{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}.dshtu_pop{display:block;max-width:420px;font-size:12px;font-weight:400;line-height:18px;text-align:left;white-space:normal}.dshtu_pop .dshtu_sep{margin:0 5px;opacity:.55}.dshtu_nd{color:var(--dsw-alias-label-tertiary)}";

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
            h("th", { title: t("costTipLong") }, t("cost") + "*"),
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
          return h("tr", { key: key },
            h("td", { title: titles !== undefined && titles[key] !== undefined ? titles[key] : undefined }, key),
            h("td", { className: blank ? "dshtu_nd" : undefined, title: note === undefined ? t("costTip") : note.tip }, blank ? "—" : fmtMoney(row.cost)),
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
      return h("button", {
        key: value,
        "data-on": range === value,
        onClick: function () { if (props.onRange !== undefined) props.onRange(value); }
      }, value + t("daysSuffix"));
    };
    return h("div", { className: "dshtu_card" },
      h("div", { className: "dshtu_bar" },
        h("span", { className: "dshtu_meta" }, t("trend") + " · " + shown.from + " ~ " + shown.to + " · " + t("cost") + " " + fmtMoney(cost)),
        h("span", { style: { flex: "1" } }),
        h("span", { className: "dshtu_seg" }, rangeButton(7), rangeButton(30), rangeButton(90))),
      h("div", { className: "dshtu_chart", ref: holder }));
  }

  /** Money stat card: the headline amount plus the info icon that reveals the notes. */
  function moneyBox(t, label, value, notes) {
    var icon = h("i", { className: "dshtu_info", "aria-label": t("costTip") }, "i");
    var trigger = tooltip === null
      ? h("i", { className: "dshtu_info", title: t("costTipLong") }, "i")
      : h(tooltip, { label: h("div", { className: "dshtu_pop" }, notes), side: "top", delayMs: 120, maxWidth: 420 }, icon);
    return h("div", { className: "dshtu_stat", "data-main": true },
      h("b", null, fmtMoney(value)),
      h("span", null, label, trigger));
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

  /** Where the amounts come from, and what they leave out — the money card's hover notes. */
  function pricingNotes(t, data) {
    var pricing = data.pricing || {};
    var notes = data.modelPricing || {};
    var bits = [];
    if (pricing.builtIn === true) {
      bits.push(h("span", { key: "src" }, pricing.error ? t("priceBuiltIn").replace("{error}", pricing.error) : t("priceOffline")));
    } else if (pricing.source) {
      bits.push(h("span", { key: "src" }, t("priceSource") + " " + String(pricing.source).replace(/^https?:\/\//, "")));
    }
    if (pricing.fetchedAt > 0) bits.push(h("span", { key: "at" }, t("priceFetched").replace("{time}", fmtTime(pricing.fetchedAt))));
    if (pricing.nextRefreshAt > 0) bits.push(h("span", { key: "next" }, t("priceNext").replace("{time}", fmtTime(pricing.nextRefreshAt))));
    if (pricing.peak) {
      bits.push(h("span", { key: "peak" }, t("pricePeak").replace("{ranges}", pricing.peak.hoursUtc.map(function (range) { return range[0] + "-" + range[1]; }).join(" / "))));
    }
    if (pricing.peakParsed === false) bits.push(h("span", { key: "peakAssumed" }, t("pricePeakAssumed")));
    var meta = [];
    bits.forEach(function (bit, index) {
      if (index > 0) meta.push(h("span", { className: "dshtu_sep", key: "sep" + index }, "·"));
      meta.push(bit);
    });
    var skipped = Object.keys(notes).filter(function (name) { return notes[name].status !== "priced"; });
    var lines = [
      h("div", { key: "text" }, t("costTipLong")),
      h("div", { key: "meta", style: { marginTop: "5px" } }, meta),
    ];
    if (skipped.length > 0) {
      lines.push(h("div", { key: "skipped", style: { marginTop: "5px" } }, t("notPriced") + "：" + skipped.map(function (name) {
        return name + "（" + (notes[name].status === "excluded" ? t("reasonExcluded") : t("reasonUnmatched")) + "）";
      }).join("、")));
    }
    var auxiliary = data.auxiliary;
    if (auxiliary && auxiliary.total > 0) {
      var detail = [];
      if (auxiliary.search > 0) detail.push(t("auxSearch") + " " + auxiliary.search);
      if (auxiliary.title > 0) detail.push(t("auxTitle") + " " + auxiliary.title);
      lines.push(h("div", { key: "auxiliary", style: { marginTop: "5px" } }, t("auxiliaryNote").replace("{count}", auxiliary.total).replace("{detail}", detail.join(" / "))));
    }
    return lines;
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

    var switchDays = function (value) {
      setChartDays(value);
      try { localStorage.setItem("dshtu.trendDays", String(value)); } catch (err) {}
    };

    var parts = [];
    if (mode === "day") parts.push("day=" + day);
    if (mode === "month") parts.push("month=" + month);
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

    useEffect(function () {
      var el = document.getElementById("dshtu-style");
      if (!el) {
        el = document.createElement("style");
        el.id = "dshtu-style";
        el.textContent = css;
        document.head.appendChild(el);
      }
    }, []);

    var switchUnit = function (next) {
      setUnit(next);
      try { localStorage.setItem("dshtu.unit", next); } catch (err) {}
    };

    var seg = function (value, label) {
      return h("button", { key: value, "data-on": unit === value, onClick: function () { switchUnit(value); } }, label);
    };

    var modeTab = function (value, label) {
      return h("button", { key: value, "data-on": mode === value, onClick: function () { setMode(value); setTick(tick + 1); } }, label);
    };

    if (error) {
      return h("div", { className: "dshtu_wrap" },
        h("div", { className: "dshtu_card dshtu_err" },
          h("span", null, t("error") + ": " + error),
          h("button", { onClick: function () { setError(null); setTick(tick + 1); } }, t("retry"))));
    }
    if (!data) {
      return h("div", { className: "dshtu_wrap" },
        h("div", { className: "dshtu_card dshtu_meta" }, t("loading")));
    }
    var totals = data.totals || {};
    var models = (data.models && data.models.length > 0 ? data.models : Object.keys(data.byModel || {}));
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
    return h("div", { className: "dshtu_wrap" },
      h("div", { className: "dshtu_card" },
        h("div", { className: "dshtu_bar" },
          h("label", null, t("filterLabel")),
          h("span", { className: "dshtu_seg" },
            modeTab("day", t("filterDay")),
            modeTab("month", t("filterMonth")),
            modeTab("all", t("filterAll"))),
          mode === "day" ? h("input", { type: "date", value: day, onChange: function (e) { setDay(e.target.value); setTick(tick + 1); } }) : null,
          mode === "month" ? h("input", { type: "month", value: month, onChange: function (e) { setMonth(e.target.value); setTick(tick + 1); } }) : null,
          h("span", { className: "dshtu_field" },
            h("label", null, t("modelLabel")),
            h("select", { value: model, onChange: function (e) { setModel(e.target.value); setTick(tick + 1); } },
              h("option", { value: "" }, t("modelAll")),
              models.map(function (name) { return h("option", { key: name, value: name }, name); }))),
          h("span", { style: { flex: "1" } }),
          h("label", null, t("unitLabel")),
          h("span", { className: "dshtu_seg" }, seg("zh", t("unitZh")), seg("en", t("unitEn")))),
        h("div", { className: "dshtu_meta dshtu_totalsMeta" }, t("totals")),
        h("div", { className: "dshtu_grid" },
          statBox(t, t("total"), totals.total, unit, true),
          statBox(t, t("input"), totals.input, unit),
          statBox(t, t("output"), totals.output, unit),
          statBox(t, t("cacheRead"), totals.cacheRead, unit),
          statBox(t, t("cacheWrite"), totals.cacheWrite, unit),
          statBox(t, t("reasoning"), totals.reasoning, unit),
          statBox(t, t("calls"), totals.calls, unit),
          moneyBox(t, t("costTotal"), totals.cost, pricingNotes(t, data)))),
      h(TrendChart, { t: t, unit: unit, trend: data.trend, range: chartDays, onRange: switchDays }),
      table(t, t("byModel"), data.byModel, unit, undefined, modelNotes(t, data.modelPricing)),
      table(t, t("byDay"), data.byDay, unit),
      (function () {
        var projects = shortenProjects(data.byProject);
        return table(t, t("byProject"), projects.rows, unit, projects.titles);
      })(),
      h("div", { className: "dshtu_meta" }, metaParts.join(" · ")));
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

  function apply(ctx) {
    ctx.effect(function () {
      ctx.locale.register(NS, { zh: zh, en: en });
    }, "dsh-token-use: dictionaries");
    ctx.effect(function () {
      var existing = document.getElementById("dshtu-nav-style");
      if (existing !== null) return function () {};
      var style = document.createElement("style");
      style.id = "dshtu-nav-style";
      style.textContent = navGlyphCss;
      document.head.appendChild(style);
      return function () { style.remove(); };
    }, "dsh-token-use: rail glyph");
    var t = ctx.locale.bind(NS);
    ctx.slots.inject("settings.section", function () {
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
    });
  }

  exports.NS = NS;
  exports.apply = apply;
  exports.inject = inject;
  return module.exports;
} });
