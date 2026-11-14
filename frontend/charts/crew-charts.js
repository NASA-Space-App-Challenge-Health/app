/* Shared Plotly theme for the crew health board.
   Load vendor/plotly.min.js first, then this file. It sets window.CrewCharts. */
(function (global) {
  var CYAN = "#00E5FF";
  var PURPLE = "#7851A9";
  var LILAC = "#C9B6E8";
  var MINT = "#7EE0C8";
  var AMBER = "#F0C36A";
  var ROSE = "#F2A3C7";
  var TEXT = "#e8eef7";
  var MUTED = "#b7c3d6";
  var GRID = "rgba(49, 65, 88, 0.55)";
  var SERIES = [CYAN, LILAC, PURPLE, MINT, AMBER, ROSE];

  var CONFIG = { responsive: true, displayModeBar: false, displaylogo: false };

  function reduced() {
    return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function plotly() {
    if (!global.Plotly) throw new Error("Plotly did not load. Include plotly.min.js before crew-charts.js.");
    return global.Plotly;
  }

  function baseLayout(extra) {
    var layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "Geist, ui-sans-serif, system-ui, sans-serif", color: TEXT, size: 13 },
      colorway: SERIES,
      height: 340,
      margin: { l: 56, r: 18, t: 28, b: 48 },
      hoverlabel: {
        bgcolor: "#121826",
        bordercolor: "#314158",
        font: { family: "Geist, ui-sans-serif, system-ui, sans-serif", color: TEXT, size: 13 },
      },
      legend: { orientation: "h", y: 1.12, font: { color: MUTED, size: 12 } },
      xaxis: { gridcolor: GRID, zeroline: false, color: MUTED },
      yaxis: { gridcolor: GRID, zeroline: false, color: MUTED },
    };
    Object.keys(extra || {}).forEach(function (key) { layout[key] = extra[key]; });
    return layout;
  }

  function name(el, label) {
    if (el && label) el.setAttribute("aria-label", label);
  }

  async function draw(el, data, layout, animate) {
    var Plotly = plotly();
    name(el, layout && layout.meta && layout.meta.label);
    var quiet = reduced() || animate === "none";
    var initial = quiet ? data : startFrom(data, animate);
    await Plotly.newPlot(el, initial, layout, CONFIG);
    if (quiet) return;
    try {
      await Plotly.animate(el, [{ data: frameOf(data, animate) }], {
        transition: { duration: 650, easing: "cubic-in-out" },
        frame: { duration: 650, redraw: false },
      });
    } catch (error) {
      await Plotly.react(el, data, layout, CONFIG);
    }
  }

  function startFrom(data, animate) {
    return data.map(function (trace) {
      if (animate === "gauge") return Object.assign({}, trace, { value: 0 });
      if (!Array.isArray(trace.y)) return trace;
      if (animate === "bar") return Object.assign({}, trace, { y: trace.y.map(function () { return 0; }) });
      var first = trace.y.find(function (value) { return value != null; });
      return Object.assign({}, trace, { y: trace.y.map(function () { return first == null ? 0 : first; }) });
    });
  }

  function frameOf(data, animate) {
    return data.map(function (trace) {
      if (animate === "gauge") return { value: trace.value };
      return { y: trace.y };
    });
  }

  function axisTitle(text) {
    return text ? { text: text, font: { color: MUTED, size: 12 } } : undefined;
  }

  async function lineChart(el, opts) {
    opts = opts || {};
    var data = (opts.traces || []).map(function (trace, index) {
      var color = SERIES[index % SERIES.length];
      return {
        type: "scatter",
        mode: "lines+markers",
        name: trace.name,
        x: trace.x,
        y: trace.y,
        line: { color: color, width: 2.6 },
        marker: { size: 7, color: color },
      };
    });
    var layout = baseLayout({
      meta: { label: opts.label || "Line chart" },
      yaxis: Object.assign({}, baseLayout().yaxis, { title: axisTitle(opts.yTitle) }),
      xaxis: Object.assign({}, baseLayout().xaxis, { title: axisTitle(opts.xTitle) }),
      shapes: opts.band ? [{
        type: "rect", xref: "paper", x0: 0, x1: 1,
        y0: opts.band.low, y1: opts.band.high,
        fillcolor: "rgba(0, 229, 255, 0.12)", line: { width: 0 },
      }] : [],
    });
    if (opts.ribbon && opts.traces && opts.traces[0]) {
      var x = opts.traces[0].x || [];
      var low = opts.ribbon.low || [];
      var high = opts.ribbon.high || [];
      data.unshift({
        type: "scatter",
        name: opts.ribbon.name || "Likely range",
        x: x.concat(x.slice().reverse()),
        y: high.concat(low.slice().reverse()),
        fill: "toself",
        fillcolor: "rgba(0, 229, 255, 0.16)",
        line: { color: "rgba(0,0,0,0)" },
        hoverinfo: "skip",
      });
    }
    await draw(el, data, layout, "none");
  }

  async function barChart(el, opts) {
    opts = opts || {};
    var horizontal = Boolean(opts.horizontal);
    var data = (opts.series || []).map(function (series) {
      return {
        type: "bar",
        name: series.name,
        x: horizontal ? series.values : opts.categories,
        y: horizontal ? opts.categories : series.values,
        orientation: horizontal ? "h" : "v",
        marker: { color: series.color || CYAN, line: { width: 0 } },
        hovertemplate: horizontal
          ? "%{y}<br>%{x}<extra>%{fullData.name}</extra>"
          : "%{x}<br>%{y}<extra>%{fullData.name}</extra>",
      };
    });
    var layout = baseLayout({
      meta: { label: opts.label || "Bar chart" },
      barmode: opts.stacked === false ? "group" : "stack",
      height: horizontal ? Math.max(340, (opts.categories || []).length * 36) : 340,
      margin: horizontal ? { l: 280, r: 24, t: 28, b: 48 } : { l: 56, r: 16, t: 28, b: 96 },
      xaxis: Object.assign({}, baseLayout().xaxis, {
        title: axisTitle(horizontal ? opts.valueTitle : ""),
        tickangle: horizontal ? 0 : -28,
      }),
      yaxis: Object.assign({}, baseLayout().yaxis, { automargin: true }),
    });
    await draw(el, data, layout, "none");
  }

  async function sankeyChart(el, opts) {
    opts = opts || {};
    var labels = opts.labels || [];
    var palette = {
      "pre-flight": CYAN, "Before flight": CYAN,
      "just after flight": LILAC, "Day after landing": LILAC,
      recovery: PURPLE, Recovery: PURPLE,
      C001: CYAN, C002: LILAC, C003: PURPLE, C004: MINT,
      low: AMBER, Low: AMBER,
      normal: MINT, "In range": MINT,
      high: ROSE, High: ROSE,
    };
    var data = [{
      type: "sankey",
      arrangement: "snap",
      node: {
        label: labels,
        pad: 16,
        thickness: 16,
        line: { color: "#070b14", width: 0.4 },
        color: labels.map(function (label) { return palette[label] || CYAN; }),
      },
      link: {
        source: opts.source,
        target: opts.target,
        value: opts.value,
        color: (opts.source || []).map(function (index) {
          return hexAlpha(palette[labels[index]] || CYAN, 0.45);
        }),
      },
    }];
    await draw(el, data, baseLayout({
      meta: { label: opts.label || "Sankey diagram" },
      height: 420,
      margin: { l: 12, r: 12, t: 16, b: 12 },
    }), "none");
  }

  async function sunburstChart(el, opts) {
    opts = opts || {};
    var labels = opts.labels || [];
    var data = [{
      type: "sunburst",
      labels: labels,
      parents: opts.parents,
      values: opts.values,
      branchvalues: "total",
      insidetextorientation: "radial",
      textfont: { color: TEXT, size: 12 },
      marker: {
        line: { color: "#070b14", width: 1.4 },
        colors: labels.map(function (_label, index) {
          return [ "#1a2233", CYAN, LILAC, PURPLE, MINT, AMBER, ROSE ][index % 7];
        }),
      },
    }];
    await draw(el, data, baseLayout({
      meta: { label: opts.label || "Sunburst" },
      height: 460,
      margin: { l: 8, r: 8, t: 8, b: 8 },
    }), "none");
  }

  async function gaugeChart(el, opts) {
    opts = opts || {};
    var min = opts.min == null ? 0 : opts.min;
    var max = opts.max == null ? 100 : opts.max;
    var span = max - min;
    var data = [{
      type: "indicator",
      mode: "gauge+number",
      value: opts.value,
      number: { suffix: opts.suffix || "", font: { color: TEXT, size: 28, family: "Geist, sans-serif" } },
      title: { text: opts.title || "", font: { color: MUTED, size: 13 } },
      gauge: {
        axis: { range: [min, max], tickcolor: MUTED, tickfont: { color: MUTED } },
        bar: { color: CYAN, thickness: 0.28 },
        bgcolor: "#1a2233",
        borderwidth: 0,
        steps: [
          { range: [min, min + span * 0.6], color: "rgba(126, 224, 200, 0.16)" },
          { range: [min + span * 0.6, min + span * 0.85], color: "rgba(240, 195, 106, 0.16)" },
          { range: [min + span * 0.85, max], color: "rgba(242, 163, 199, 0.18)" },
        ],
      },
    }];
    await draw(el, data, baseLayout({
      meta: { label: opts.label || opts.title || "Gauge" },
      height: 220,
      margin: { l: 28, r: 28, t: 36, b: 12 },
    }), "gauge");
  }

  function bigNumber(el, opts) {
    opts = opts || {};
    el.classList.add("crew-kpi");
    el.replaceChildren();
    var label = document.createElement("p");
    label.className = "crew-kpi-label";
    label.textContent = opts.label || "";
    var value = document.createElement("p");
    value.className = "crew-kpi-value";
    value.textContent = opts.value == null ? "—" : String(opts.value);
    var note = document.createElement("p");
    note.className = "crew-kpi-note";
    note.textContent = opts.note || "";
    el.append(label, value, note);
    if (opts.statusLabel) {
      var pill = document.createElement("p");
      pill.className = "status-pill status-" + (opts.status || "watch");
      pill.textContent = opts.statusLabel;
      el.append(pill);
    }
  }

  function purge(el) {
    if (global.Plotly && el) global.Plotly.purge(el);
  }

  function hexAlpha(hex, alpha) {
    var raw = String(hex).replace("#", "");
    var r = parseInt(raw.slice(0, 2), 16);
    var g = parseInt(raw.slice(2, 4), 16);
    var b = parseInt(raw.slice(4, 6), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  }

  global.CrewCharts = {
    lineChart: lineChart,
    barChart: barChart,
    sankeyChart: sankeyChart,
    sunburstChart: sunburstChart,
    gaugeChart: gaugeChart,
    bigNumber: bigNumber,
    purge: purge,
    colors: { cyan: CYAN, purple: PURPLE, lilac: LILAC, mint: MINT, amber: AMBER, rose: ROSE, series: SERIES },
  };
})(window);
