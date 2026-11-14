/** Same shapes as GET /eda/…, computed from the NASA CSVs when the API is down. */

import { num } from "./csv.js";

const TIMEPOINTS = ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"];
const KIDNEY = new Set([
  "SODIUM", "POTASSIUM", "CHLORIDE", "CARBON DIOXIDE", "CALCIUM",
  "CREATININE", "UREA NITROGEN (BUN)", "BUN/CREATININE RATIO",
  "eGFR AFRICAN AMERICAN", "eGFR NON-AFR. AMERICAN",
]);
const LIVER = new Set([
  "ALT", "AST", "ALKALINE PHOSPHATASE", "BILIRUBIN; TOTAL",
  "ALBUMIN", "ALBUMIN/GLOBULIN RATIO", "GLOBULIN", "PROTEIN; TOTAL",
]);
const FLAGS = ["low", "normal", "high"];

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clinical(row) {
  return row.panel === "CBC" || row.panel === "CMP";
}

export function systemOf(row) {
  if (row.panel === "cytokine") return "inflammation/cytokines";
  if (row.analyte === "GLUCOSE") return "cardiovascular/metabolic";
  if (KIDNEY.has(row.analyte)) return "kidney/electrolytes";
  if (LIVER.has(row.analyte)) return "liver";
  if (row.panel === "CBC") return "blood/immune";
  return "other";
}

export function phaseOf(row) {
  const days = Number(row.days_from_launch);
  if (days < 0) return "pre-flight";
  if (row.timepoint === "R+1") return "just after flight";
  return "recovery";
}

export function overview({ labs, doses, seps, referenceRanges, datasets }) {
  const outRows = labs.filter((row) => row.flag === "low" || row.flag === "high");
  const ranged = labs.filter((row) => FLAGS.includes(row.flag));
  const days = new Set((doses || []).map((row) => String(row.timestamp || "").slice(0, 10)).filter(Boolean));
  return {
    crew_count: 4,
    analytes: new Set(labs.map((row) => row.analyte)).size,
    lab_rows: labs.length,
    timepoints: new Set(labs.map((row) => row.timepoint)).size,
    timepoint_labels: TIMEPOINTS,
    radiation_days: days.size,
    sep_events: (seps || []).length,
    out_of_range_rows: outRows.length,
    rows_with_reference: ranged.length,
    pct_out_of_range: ranged.length ? roundTo((100 * outRows.length) / ranged.length, 2) : 0,
    flagged_analytes: new Set(outRows.map((row) => row.analyte)).size,
    reference_range_rows: referenceRanges ? referenceRanges.length : null,
    dataset_catalog_rows: datasets ? datasets.length : null,
    scope:
      "Four Inspiration4 civilians, pre/post labs from a 3-day flight, one ISS DosTel week in June 2024, and DONKI SEP events for calendar 2024. Not a long-duration ISS crew dataset.",
  };
}

export function outOfRange(labs, limit = 12) {
  const counts = new Map();
  labs.forEach((row) => {
    if (!clinical(row) || (row.flag !== "low" && row.flag !== "high")) return;
    const current = counts.get(row.analyte) || { low: 0, high: 0 };
    current[row.flag] += 1;
    counts.set(row.analyte, current);
  });
  const top = [...counts.entries()]
    .map(([analyte, count]) => ({ analyte, ...count }))
    .sort((a, b) => b.low + b.high - (a.low + a.high) || a.analyte.localeCompare(b.analyte))
    .slice(0, limit);
  return {
    analyte: top.map((row) => row.analyte),
    low: top.map((row) => row.low),
    high: top.map((row) => row.high),
    note: "Counts of CBC/CMP rows whose own reference range flagged low or high. Cytokine assays have no clinical range in this extract.",
  };
}

export function analyteList(labs) {
  const counts = new Map();
  labs.forEach((row) => {
    if (!clinical(row) || num(row.value) == null) return;
    const key = `${row.panel}\0${row.analyte}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return {
    analytes: [...counts.entries()]
      .map(([key, rows]) => {
        const [panel, analyte] = key.split("\0");
        return { analyte, panel, rows };
      })
      .sort((a, b) => a.panel.localeCompare(b.panel) || a.analyte.localeCompare(b.analyte)),
  };
}

export function trends(labs, analyte) {
  const matches = labs.filter((row) => row.analyte === analyte && num(row.value) != null);
  const grouped = new Map();
  matches
    .slice()
    .sort((a, b) => String(a.crew_id).localeCompare(String(b.crew_id)) || Number(a.days_from_launch) - Number(b.days_from_launch))
    .forEach((row) => {
      const trace = grouped.get(row.crew_id) || { name: row.crew_id, x: [], y: [], ref_low: [], ref_high: [] };
      trace.x.push(row.timepoint);
      trace.y.push(num(row.value));
      trace.ref_low.push(num(row.ref_low));
      trace.ref_high.push(num(row.ref_high));
      grouped.set(row.crew_id, trace);
    });
  return {
    analyte,
    unit: matches[0] ? matches[0].unit : "",
    timepoints: TIMEPOINTS,
    traces: [...grouped.values()],
    reference_note: "ref_low and ref_high are the range stored on each NASA row, not an app threshold.",
  };
}

export function referenceBand(traces) {
  const lows = [];
  const highs = [];
  (traces || []).forEach((trace) => {
    (trace.ref_low || []).forEach((value) => { if (value != null) lows.push(value); });
    (trace.ref_high || []).forEach((value) => { if (value != null) highs.push(value); });
  });
  if (!lows.length || !highs.length) return null;
  lows.sort((a, b) => a - b);
  highs.sort((a, b) => a - b);
  return { low: lows[Math.floor(lows.length / 2)], high: highs[Math.floor(highs.length / 2)] };
}

export function shift(labs, limit = 12) {
  const grouped = new Map();
  labs.forEach((row) => {
    if (!clinical(row) || (row.timepoint !== "L-3" && row.timepoint !== "R+1")) return;
    const value = num(row.value);
    if (value == null) return;
    const key = `${row.analyte}\0${row.unit || ""}`;
    const bucket = grouped.get(key) || { analyte: row.analyte, unit: row.unit || "", pre: [], post: [] };
    (row.timepoint === "L-3" ? bucket.pre : bucket.post).push(value);
    grouped.set(key, bucket);
  });
  const rows = [];
  grouped.forEach((bucket) => {
    if (!bucket.pre.length || !bucket.post.length) return;
    const pre = bucket.pre.reduce((sum, value) => sum + value, 0) / bucket.pre.length;
    const post = bucket.post.reduce((sum, value) => sum + value, 0) / bucket.post.length;
    const meanDelta = post - pre;
    rows.push({
      analyte: bucket.analyte,
      unit: bucket.unit,
      mean_delta: roundTo(meanDelta, 3),
      mean_percent: pre === 0 ? null : roundTo((100 * meanDelta) / pre, 2),
    });
  });
  rows.sort((a, b) => Math.abs(b.mean_percent || 0) - Math.abs(a.mean_percent || 0));
  const top = rows.slice(0, limit);
  return {
    analyte: top.map((row) => row.analyte),
    unit: top.map((row) => row.unit),
    mean_delta: top.map((row) => row.mean_delta),
    mean_percent: top.map((row) => row.mean_percent),
    note: "Crew-mean R+1 minus crew-mean L-3. Ranked by absolute percent change. There is no in-flight sample in this extract; R+1 is the first post-flight draw.",
  };
}

export function sunburst(labs) {
  const systems = new Map();
  const panels = new Map();
  const leaves = new Map();
  let total = 0;
  labs
    .filter((row) => row.flag === "low" || row.flag === "high")
    .forEach((row) => {
      const system = systemOf(row);
      const panelLabel = `${system} / ${row.panel}`;
      total += 1;
      systems.set(system, (systems.get(system) || 0) + 1);
      panels.set(`${system}\0${panelLabel}`, (panels.get(`${system}\0${panelLabel}`) || 0) + 1);
      const leaf = `${panelLabel}\0${row.analyte}`;
      leaves.set(leaf, (leaves.get(leaf) || 0) + 1);
    });
  const labels = ["Out of range"];
  const parents = [""];
  const values = [total];
  leaves.forEach((count, key) => {
    const [parent, label] = key.split("\0");
    labels.push(label);
    parents.push(parent);
    values.push(count);
  });
  panels.forEach((count, key) => {
    const [, label] = key.split("\0");
    const system = label.split(" / ")[0];
    labels.push(label);
    parents.push(system);
    values.push(count);
  });
  systems.forEach((count, system) => {
    labels.push(system);
    parents.push("Out of range");
    values.push(count);
  });
  return {
    labels,
    parents,
    values,
    note: "Value is the count of low or high flags. Cytokines have no reference flags in this file, so they do not appear.",
  };
}

export function flow(labs) {
  const phaseLabels = ["pre-flight", "just after flight", "recovery", "low", "normal", "high"];
  const phaseIndex = Object.fromEntries(phaseLabels.map((label, index) => [label, index]));
  const phaseCounts = new Map();
  const crewCounts = new Map();
  const crewIds = [];
  labs.forEach((row) => {
    if (!clinical(row) || !FLAGS.includes(row.flag)) return;
    const phaseKey = `${phaseOf(row)}\0${row.flag}`;
    phaseCounts.set(phaseKey, (phaseCounts.get(phaseKey) || 0) + 1);
    crewCounts.set(`${row.crew_id}\0${row.flag}`, (crewCounts.get(`${row.crew_id}\0${row.flag}`) || 0) + 1);
    if (!crewIds.includes(row.crew_id)) crewIds.push(row.crew_id);
  });
  crewIds.sort();
  const phaseSource = [];
  const phaseTarget = [];
  const phaseValue = [];
  phaseCounts.forEach((count, key) => {
    const [phase, status] = key.split("\0");
    phaseSource.push(phaseIndex[phase]);
    phaseTarget.push(phaseIndex[status]);
    phaseValue.push(count);
  });
  const crewSource = [];
  const crewTarget = [];
  const crewValue = [];
  crewCounts.forEach((count, key) => {
    const [crew, status] = key.split("\0");
    crewSource.push(crewIds.indexOf(crew));
    crewTarget.push(crewIds.length + ["low", "normal", "high"].indexOf(status));
    crewValue.push(count);
  });
  return {
    phase_to_status: { label: phaseLabels, source: phaseSource, target: phaseTarget, value: phaseValue },
    crew_to_status: {
      label: crewIds.concat(["low", "normal", "high"]),
      source: crewSource,
      target: crewTarget,
      value: crewValue,
    },
    note: "CBC/CMP rows with a reference flag. There is no in-flight draw; 'just after flight' is R+1.",
  };
}

export function radiationSeries(doses, seps) {
  const buckets = new Map();
  const daily = new Map();
  (doses || []).forEach((row) => {
    const rate = num(row.absorbed_dose_rate);
    const stamp = row.timestamp || "";
    if (rate == null || stamp.length < 13) return;
    const hour = `${stamp.slice(0, 13)}:00`;
    const instrument = row.instrument_id || "DosTel";
    const key = `${instrument}\0${hour}`;
    const bucket = buckets.get(key) || { instrument, hour, sum: 0, n: 0 };
    bucket.sum += rate;
    bucket.n += 1;
    buckets.set(key, bucket);
    const day = stamp.slice(0, 10);
    const dayBucket = daily.get(day) || { day, sum: 0, n: 0, max: rate };
    dayBucket.sum += rate;
    dayBucket.n += 1;
    dayBucket.max = Math.max(dayBucket.max, rate);
    daily.set(day, dayBucket);
  });
  const traces = new Map();
  [...buckets.values()]
    .sort((a, b) => a.hour.localeCompare(b.hour) || a.instrument.localeCompare(b.instrument))
    .forEach((bucket) => {
      const trace = traces.get(bucket.instrument) || { name: bucket.instrument, x: [], y: [] };
      trace.x.push(bucket.hour);
      trace.y.push(roundTo(bucket.sum / bucket.n, 3));
      traces.set(bucket.instrument, trace);
    });
  const days = [...daily.values()].sort((a, b) => a.day.localeCompare(b.day));
  const months = new Map();
  (seps || []).forEach((row) => {
    const month = String(row.eventTime || "").slice(0, 7);
    if (month.length === 7) months.set(month, (months.get(month) || 0) + 1);
  });
  const monthKeys = [...months.keys()].sort();
  return {
    series: [...traces.values()],
    series_note: "Hourly mean absorbed dose rate in μGy/h from the June 2024 DosTel extract. Not a personal dose.",
    daily: {
      x: days.map((row) => row.day),
      mean_ugy_h: days.map((row) => roundTo(row.sum / row.n, 3)),
      max_ugy_h: days.map((row) => roundTo(row.max, 3)),
    },
    sep_by_month: { x: monthKeys, y: monthKeys.map((key) => months.get(key)) },
  };
}

export function extremes(labs, limit = 15) {
  const ranked = [];
  labs.forEach((row) => {
    if (!clinical(row)) return;
    const value = num(row.value);
    const low = num(row.ref_low);
    const high = num(row.ref_high);
    if (value == null || low == null || high == null || high <= low) return;
    const z = (value - (low + high) / 2) / ((high - low) / 4);
    ranked.push({
      crew_id: row.crew_id,
      analyte: row.analyte,
      timepoint: row.timepoint,
      panel: row.panel,
      value,
      unit: row.unit,
      ref_low: low,
      ref_high: high,
      flag: row.flag,
      z_score: roundTo(z, 2),
    });
  });
  ranked.sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));
  return {
    rows: ranked.slice(0, limit),
    note: "z uses the reference span as if low-to-high were about four standard deviations. It is a ranking aid, not a clinical z-score. C003 L-92 MPV and RDW are far off the scale of that crew member's later draws and should be treated as suspect source rows.",
  };
}

export function buildLocal({ labs, doses, seps, referenceRanges, datasets }) {
  return {
    labs,
    overview: overview({ labs, doses, seps, referenceRanges, datasets }),
    outOfRange: outOfRange(labs),
    analytes: analyteList(labs),
    shift: shift(labs),
    sunburst: sunburst(labs),
    flow: flow(labs),
    radiation: radiationSeries(doses, seps),
    extremes: extremes(labs),
  };
}
