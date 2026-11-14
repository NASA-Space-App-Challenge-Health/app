# Crew charts

Small Plotly helpers for the astronaut health board. One dark theme: Geist,
Arctic Cyan (`#00E5FF`), and Royal Purple (`#7851A9`). Motion eases in, and
turns off when the visitor prefers reduced motion.

The Data insights page (`frontend/insights.html`) is the worked example.

## Load

```html
<script src="vendor/plotly.min.js"></script>
<script src="charts/crew-charts.js"></script>
<link rel="stylesheet" href="charts/charts.css" />
```

`crew-charts.js` sets `window.CrewCharts`. It does not pick colors inside
your layout. Give each chart a div that is already in the document.

## Helpers

```js
const { lineChart, barChart, sankeyChart, sunburstChart, gaugeChart, bigNumber, purge } = CrewCharts;

bigNumber(document.querySelector("#crew"), {
  label: "Crew in the file",
  value: "4",
  note: "Inspiration4, de-identified",
});

await lineChart(document.querySelector("#trend"), {
  label: "Glucose by crew",
  yTitle: "mg/dL",
  traces: [
    { name: "C001", x: ["L-3", "R+1"], y: [80, 90] },
  ],
  band: { low: 65, high: 99 },
});

await barChart(document.querySelector("#flags"), {
  label: "Out of range counts",
  categories: ["GLUCOSE", "POTASSIUM"],
  stacked: true,
  series: [
    { name: "Low", values: [5, 2], color: CrewCharts.colors.amber },
    { name: "High", values: [2, 1], color: CrewCharts.colors.rose },
  ],
});

await sankeyChart(document.querySelector("#flow"), {
  label: "Phase to status",
  labels: ["pre-flight", "recovery", "low", "normal", "high"],
  source: [0, 1],
  target: [3, 4],
  value: [40, 3],
});

await sunburstChart(document.querySelector("#burst"), {
  label: "Out of range by system",
  labels: ["Out of range", "blood/immune", "HEMOGLOBIN"],
  parents: ["", "Out of range", "blood/immune"],
  values: [2, 2, 2],
});

await gaugeChart(document.querySelector("#share"), {
  title: "Outside the reference range",
  label: "Percent of ranged rows outside the reference range",
  value: 4.14,
  min: 0,
  max: 20,
  suffix: "%",
});

purge(document.querySelector("#trend"));
```

`band` draws one shaded reference interval across a line chart. `ribbon`
draws a time-varying likely range (`{ low: number[], high: number[] }`) for a
forecast. Bar charts are drawn at their real height. Starting them at zero
and animating left the axis clipped.

```js
await lineChart(document.querySelector("#forecast"), {
  label: "Forecast with a likely range",
  traces: [{ name: "Forecast", x: ["Mon", "Tue"], y: [1, 2] }],
  ribbon: { low: [0.5, 1.2], high: [1.4, 2.6], name: "Likely range" },
});
```

`bigNumber` accepts `status` (`in`, `watch`, or `out`) and `statusLabel`.
The pill always includes the words, not color alone.

Sankey link
colors are a flat mix of the source color. Plotly does not paint a gradient
along a link. True gradient clips for phase → status and crew → status live
on the insights page and were rendered with the Python package
`gradient-sankey` (see `scripts/render_gradient_sankey.py`).
