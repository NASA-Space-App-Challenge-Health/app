import { parseCsv } from "./insights/csv.js";
import { buildLocal, referenceBand, trends } from "./insights/eda.js";
import {
  flagCard,
  friendlyFlowLabel,
  friendlySunburst,
  monthLabel,
  monthTakeaway,
  oorTakeaway,
  plainName,
  shiftTakeaway,
  trendTakeaway,
} from "./insights/plain.js";
import {
  CREW_IDS,
  TOPICS,
  defaultFilters,
  filterLabRows,
  filtersToQuery,
  matchRecommendation,
  parseFilters,
  topicAllowed,
  topTakeaways,
} from "./insights/filters.js";

const charts = window.CrewCharts;
const statusNode = document.querySelector("#status");
const errorNode = document.querySelector("#error");
const state = {
  source: "",
  bundle: null,
  model: null,
  analyte: "GLUCOSE",
  trendToken: 0,
  filters: defaultFilters(),
  recPayload: null,
  forecastPayloads: [],
};

function apiBase() {
  const fromQuery = new URLSearchParams(window.location.search).get("api");
  if (fromQuery) return fromQuery.replace(/\/$/, "");
  // config.js sets "" on Vercel so requests stay on this origin. An empty
  // string is that choice, not a missing value.
  if (typeof window.CREW_HEALTH_API_BASE === "string") {
    return window.CREW_HEALTH_API_BASE.replace(/\/$/, "");
  }
  return "http://127.0.0.1:8080";
}

function text(id, value) {
  const node = document.querySelector(id);
  if (node) node.textContent = value || "";
}

async function getJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(apiBase() + path, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadApi() {
  const analyte = encodeURIComponent(state.analyte);
  const [overview, oor, analytes, shift, sunburst, flow, radiation, extremes, trend] = await Promise.all([
    getJson("/eda/overview"),
    getJson("/eda/labs/out_of_range"),
    getJson("/eda/labs/analytes"),
    getJson("/eda/labs/shift"),
    getJson("/eda/labs/sunburst"),
    getJson("/eda/labs/flow"),
    getJson("/eda/radiation/series"),
    getJson("/eda/extremes"),
    getJson("/eda/labs/trends?analyte=" + analyte),
  ]);
  if (!overview || overview.lab_rows == null) return null;
  return {
    overview, outOfRange: oor, analytes, shift, sunburst, flow, radiation, extremes,
    trend,
  };
}

async function loadCsv() {
  const names = ["labs_long.csv", "radiation_iss.csv", "donki_sep.csv", "reference_ranges.csv", "datasets.csv"];
  const files = await Promise.all(names.map(async (name) => {
    const response = await fetch("/data/" + name);
    if (!response.ok) throw new Error(name);
    return parseCsv(await response.text());
  }));
  const local = buildLocal({
    labs: files[0],
    doses: files[1],
    seps: files[2],
    referenceRanges: files[3],
    datasets: files[4],
  });
  state.bundle = {
    labs: files[0],
    doses: files[1],
    seps: files[2],
    referenceRanges: files[3],
    datasets: files[4],
  };
  state.labs = files[0];
  return {
    overview: local.overview,
    outOfRange: local.outOfRange,
    analytes: local.analytes,
    shift: local.shift,
    sunburst: local.sunburst,
    flow: local.flow,
    radiation: local.radiation,
    extremes: local.extremes,
    trend: trends(files[0], state.analyte),
  };
}

function kpi(id, label, value, note, status, statusLabel) {
  const node = document.createElement("div");
  node.id = id;
  charts.bigNumber(node, { label, value, note, status, statusLabel });
  return node;
}

function tipButton(explanation) {
  const wrap = document.createElement("span");
  wrap.className = "tip-wrap";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tip";
  button.textContent = "?";
  button.setAttribute("aria-label", "Plain-language explanation");
  const bubble = document.createElement("span");
  bubble.className = "tip-bubble";
  bubble.role = "tooltip";
  bubble.textContent = explanation;
  wrap.append(button, bubble);
  return wrap;
}

function peakDose(radiation) {
  const values = radiation && radiation.daily && radiation.daily.max_ugy_h;
  if (!values || !values.length) return null;
  return Math.max(...values);
}

function renderKpis(model) {
  const overview = model.overview;
  const host = document.querySelector("#kpis");
  const peak = peakDose(model.radiation);
  const pct = overview.pct_out_of_range;
  text("#kpi-takeaway", `About ${pct}% of lab results that have a reference range fell outside it. Most results were in range.`);
  host.replaceChildren(
    kpi("kpi-crew", "Astronauts", overview.crew_count, "De-identified Inspiration4 IDs", "in", "Research file"),
    kpi("kpi-rows", "Lab results", Number(overview.lab_rows).toLocaleString(), "Blood count, chemistry, and immune signals", "in", "Real NASA"),
    kpi("kpi-oor", "Outside the usual range", overview.out_of_range_rows, pct + "% of results that have a range", pct < 10 ? "in" : "watch", pct < 10 ? "Mostly in range" : "Watch"),
    kpi("kpi-sep", "Solar-particle reports", state.filters.topics.includes("radiation") ? overview.sep_events : "—", "DONKI instrument rows for 2024, not separate storms", "watch", state.filters.topics.includes("radiation") ? "Space weather" : "Filtered out"),
    kpi("kpi-dose", "Highest station radiation", state.filters.topics.includes("radiation") && peak != null ? peak.toFixed(1) : "—", "μGy/h that week. A vehicle reading, not a personal dose.", "watch", state.filters.topics.includes("radiation") ? "Not personal" : "Filtered out"),
  );
  text("#gauge-note", "Share of results that have a printed range and sit outside it. The gauge runs 0–20% so this small share stays visible. Green means mostly in range. Real NASA rows.");
  return charts.gaugeChart(document.querySelector("#gauge"), {
    title: "Outside the reference range",
    label: "Percent of ranged lab rows outside their reference range",
    value: overview.pct_out_of_range,
    min: 0,
    max: 20,
    suffix: "%",
  });
}

function renderBars(model) {
  const oor = model.outOfRange || { analyte: [], low: [], high: [], note: "" };
  text("#oor-takeaway", oorTakeaway(oor));
  text("#oor-note", "Amber is low. Red is high. Counts use each row’s own reference range. Immune-signal assays have no clinical range here, so they are not in this chart. Real NASA.");
  const shift = model.shift || { analyte: [], mean_percent: [], unit: [], note: "" };
  text("#shift-takeaway", shiftTakeaway(shift));
  text("#shift-note", "A big percent on a small starting number (such as a rare white cell) can look dramatic. Read the test name before treating bar length as importance. " + (shift.note || ""));
  const order = (oor.analyte || []).map((_, index) => index).reverse();
  const percents = shift.mean_percent || [];
  renderFlagCards(model);
  return Promise.all([
    charts.barChart(document.querySelector("#oor"), {
      label: "Most common out-of-range blood results. Amber means low, red means high.",
      categories: order.map((index) => plainName(oor.analyte[index])),
      horizontal: true,
      stacked: true,
      valueTitle: "Samples outside the printed range",
      series: [
        { name: "Low", values: order.map((index) => oor.low[index]), color: "#F0C36A" },
        { name: "High", values: order.map((index) => oor.high[index]), color: "#F2A3C7" },
      ],
    }),
    charts.barChart(document.querySelector("#shift"), {
      label: "Average percent change from three days before launch to the day after landing",
      categories: (shift.analyte || []).map(plainName),
      horizontal: true,
      stacked: false,
      valueTitle: "Average percent change",
      series: [{
        name: "Change",
        values: percents,
        color: percents.map((value) => (value < 0 ? "#7851A9" : "#00E5FF")),
      }],
    }),
  ]);
}

function renderFlagCards(model) {
  const oor = model.outOfRange || { analyte: [], low: [], high: [] };
  const host = document.querySelector("#flag-cards");
  host.replaceChildren();
  (oor.analyte || []).slice(0, 8).forEach((analyte, index) => {
    host.append(infoCard(flagCard(analyte, oor.low[index], oor.high[index])));
  });
  (model.extremes && model.extremes.rows || []).filter(suspect).forEach((row) => {
    const card = flagCard(row.analyte, row.flag === "low" ? 1 : 0, row.flag === "high" ? 1 : 0);
    card.status = "out";
    card.statusLabel = "Suspect row";
    host.append(infoCard(card));
  });
  if (!state.filters.topics.includes("radiation")) return;
  host.append(infoCard({
    title: "Station radiation",
    status: "watch",
    statusLabel: "Not personal",
    what_it_means: "The radiation chart is the space station’s measured dose rate for 1–7 June 2024. It is not a dosimeter worn by one of these four astronauts.",
    why_it_matters_in_space: "NASA lists radiation as one of the main hazards of spaceflight. A high vehicle rate plus a solar-particle notice is why the whole crew can get a generic “follow procedures” alert, with no one’s name and no diagnosis.",
    what_to_do: "Follow the radiation procedure. The dose number stays with you, the crew medical officer, and the flight surgeon.",
    who_is_notified: "The whole crew hears the generic contingency. The number is not the public text.",
    sources: [{ title: "5 Hazards of Human Spaceflight", url: "https://www.nasa.gov/hrp/hazards/" }],
  }));
}

function infoCard(card) {
  const article = document.createElement("article");
  article.className = "info-card";
  const title = document.createElement("h3");
  title.textContent = card.title || "Note";
  title.append(tipButton(card.what_it_means || ""));
  const pill = document.createElement("p");
  pill.className = "status-pill status-" + (card.status || "watch");
  pill.textContent = card.statusLabel || "Watch";
  article.append(title, pill);
  [
    ["What it means", card.what_it_means],
    ["Why it matters in space", card.why_it_matters_in_space],
    ["What to do", card.what_to_do],
    ["Who is told", card.who_is_notified],
  ].forEach(([heading, body]) => {
    if (!body) return;
    const p = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = heading + ". ";
    p.append(strong, document.createTextNode(body));
    article.append(p);
  });
  if (card.confidence != null && card.confidence !== "") {
    const p = document.createElement("p");
    p.textContent = "Confidence: " + card.confidence + ". This is not a diagnosis.";
    article.append(p);
  } else {
    const p = document.createElement("p");
    p.textContent = "Not a diagnosis.";
    article.append(p);
  }
  const sources = card.sources || [];
  if (sources.length) {
    const p = document.createElement("p");
    sources.forEach((source, index) => {
      if (index) p.append(document.createTextNode(" · "));
      const link = document.createElement("a");
      link.href = source.url || source.href || "#";
      link.textContent = source.title || source.url || "Source";
      link.rel = "noreferrer";
      link.target = "_blank";
      p.append(link);
    });
    article.append(p);
  }
  return article;
}

async function renderTrend(model) {
  const token = ++state.trendToken;
  let payload = model.trend;
  if (state.source === "api") {
    payload = await getJson("/eda/labs/trends?analyte=" + encodeURIComponent(state.analyte));
  } else if (state.labs) {
    payload = trends(state.labs, state.analyte);
  }
  if (token !== state.trendToken || !payload) return;
  const band = referenceBand(payload.traces);
  text("#trend-takeaway", trendTakeaway(payload.analyte || state.analyte));
  text("#trend-note", (payload.reference_note || "The shade is the range stored on each NASA row, not an app limit.") + (payload.unit ? " Unit: " + payload.unit + "." : "") + " Real NASA.");
  await charts.lineChart(document.querySelector("#trend"), {
    label: plainName(payload.analyte || state.analyte) + " for each astronaut",
    yTitle: payload.unit || "",
    traces: payload.traces || [],
    band,
  });
}

function fillAnalytes(model) {
  const select = document.querySelector("#analyte");
  const items = (model.analytes && model.analytes.analytes) || [];
  select.replaceChildren();
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.analyte;
    option.textContent = plainName(item.analyte);
    select.append(option);
  });
  const preferred = state.filters.analyte;
  if ([...select.options].some((option) => option.value === preferred)) select.value = preferred;
  else if ([...select.options].some((option) => option.value === "GLUCOSE")) select.value = "GLUCOSE";
  state.analyte = select.value || preferred || "GLUCOSE";
  state.filters.analyte = state.analyte;
}

function suspect(row) {
  return row.crew_id === "C003" && row.timepoint === "L-92" && (row.analyte === "MPV" || row.analyte === "RDW");
}

function renderExtremes(model) {
  const payload = model.extremes || { rows: [], note: "" };
  text("#ext-takeaway", "The biggest scores are suspect lab rows for C003 before launch (platelet size and red-cell size spread). Do not treat them as the medical finding.");
  text("#ext-note", payload.note || "");
  const body = document.querySelector("#extremes");
  body.replaceChildren();
  let found = false;
  (payload.rows || []).forEach((row) => {
    const flagged = suspect(row);
    if (flagged) found = true;
    const tr = document.createElement("tr");
    if (flagged) tr.className = "suspect-row";
    const cells = [
      row.crew_id,
      plainName(row.analyte),
      row.timepoint,
      row.value + " " + (row.unit || ""),
      (row.ref_low ?? "—") + " – " + (row.ref_high ?? "—"),
      null,
      row.z_score == null ? "—" : String(row.z_score),
    ];
    cells.forEach((value, index) => {
      const td = document.createElement("td");
      if (index === 5) {
        const pill = document.createElement("span");
        const flag = row.flag || "";
        pill.className = "status-pill " + (flag === "high" ? "status-out" : flag === "low" ? "status-watch" : "status-in");
        pill.textContent = flag === "high" ? "High" : flag === "low" ? "Low" : (flag || "In range");
        td.append(pill);
      } else {
        td.textContent = value;
      }
      tr.append(td);
    });
    const note = document.createElement("td");
    if (flagged) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "Suspect source row";
      note.append(tag);
    } else {
      note.textContent = "Real NASA row";
    }
    tr.append(note);
    body.append(tr);
  });
  const banner = document.querySelector("#suspect");
  const flaggedRows = (payload.rows || []).filter(suspect);
  banner.hidden = flaggedRows.length === 0;
  banner.textContent = flaggedRows.length
    ? "Suspect source rows: " + flaggedRows.map((row) => row.crew_id + " " + row.analyte + " at " + row.timepoint + " is " + row.value + " " + (row.unit || "")).join("; ") + ". They are far from that crew member's later draws, so they are not the medical finding. The familiar extremes are the very low glucose values at R+45."
    : "";
}

function renderRest(model) {
  const sun = friendlySunburst(model.sunburst || { labels: [], parents: [], values: [] });
  const phase = model.flow.phase_to_status;
  const crew = model.flow.crew_to_status;
  text("#sun-note", (model.sunburst && model.sunburst.note) || "");
  text("#flow-note", (model.flow && model.flow.note) || "");
  text("#rad-note", "Hourly average absorbed dose rate. " + ((model.radiation && model.radiation.series_note) || "Not a personal dosimeter."));
  text("#sep-takeaway", monthTakeaway(model.radiation && model.radiation.sep_by_month));
  const view = state.filters.view;
  const jobs = [];
  if (view === "labs") jobs.push(
    charts.sunburstChart(document.querySelector("#sun"), {
      label: "Outside-range results by body system, lab panel, and test",
      labels: sun.labels,
      parents: sun.parents,
      values: sun.values,
    }),
    charts.sankeyChart(document.querySelector("#sankey-phase"), {
      label: "Samples flowing from mission phase to in range, low, or high",
      labels: (phase.label || []).map(friendlyFlowLabel),
      source: phase.source,
      target: phase.target,
      value: phase.value,
    }),
    charts.sankeyChart(document.querySelector("#sankey-crew"), {
      label: "Samples flowing from each astronaut to in range, low, or high",
      labels: (crew.label || []).map(friendlyFlowLabel),
      source: crew.source,
      target: crew.target,
      value: crew.value,
    }),
  );
  if (view === "radiation" && state.filters.topics.includes("radiation")) jobs.push(
    charts.lineChart(document.querySelector("#dose"), {
      label: "Hourly space-station radiation, June 2024",
      yTitle: "Station dose rate (μGy/h)",
      traces: model.radiation.series || [],
    }),
    charts.barChart(document.querySelector("#sep"), {
      label: "Solar-particle instrument reports by month",
      categories: ((model.radiation.sep_by_month && model.radiation.sep_by_month.x) || []).map(monthLabel),
      stacked: false,
      series: [{
        name: "Reports",
        values: (model.radiation.sep_by_month && model.radiation.sep_by_month.y) || [],
        color: charts.colors.lilac,
      }],
    }),
  );
  if (view === "labs") renderExtremes(model);
  return Promise.all(jobs);
}

function showError(message) {
  errorNode.hidden = false;
  errorNode.replaceChildren();
  const copy = document.createElement("span");
  copy.textContent = message + " ";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Retry";
  retry.addEventListener("click", () => {
    errorNode.hidden = true;
    boot();
  });
  errorNode.append(copy, retry);
}

function guidanceList(payload) {
  if (!payload) return [];
  const list = Array.isArray(payload)
    ? payload
    : payload.recommendations || payload.forecasts || payload.items || payload.results || [];
  return list.filter((item) => item && (item.title || item.what_it_means));
}

async function loadGuidance() {
  if (state.recPayload !== null) return;
  const [recs, predict, predictLabs] = await Promise.all([
    getJson("/recommendations"),
    getJson("/predict"),
    getJson("/predict/labs"),
  ]);
  state.recPayload = recs;
  state.forecastPayloads = [predict, predictLabs];
}

async function renderGuidance() {
  await loadGuidance();
  const recs = state.recPayload;
  const [predict, predictLabs] = state.forecastPayloads;
  const recList = guidanceList(recs).filter((item) => matchRecommendation(item, state.filters));
  const host = document.querySelector("#recs");
  if (!recList.length) {
    const note = document.createElement("p");
    note.className = "caption";
    note.textContent = "Extra guidance from the medical API is not loaded yet. The cards under the blood chart explain the real flags in plain language. Nothing here is a diagnosis.";
    host.replaceChildren(note);
  } else {
    text("#recs-takeaway", "These cards came from the guidance API. They are still not a diagnosis.");
    host.replaceChildren(...recList.map((item) => infoCard({
      title: item.title,
      status: "watch",
      statusLabel: "Guidance",
      what_it_means: item.what_it_means,
      why_it_matters_in_space: item.why_it_matters_in_space,
      what_to_do: item.what_to_do,
      who_is_notified: item.who_is_notified,
      confidence: item.confidence,
      sources: item.sources,
    })));
  }
  const forecasts = guidanceList(predict).concat(guidanceList(predictLabs)).filter((item) => matchRecommendation(item, state.filters)).slice(0, 3);
  const box = document.querySelector("#forecasts");
  if (!forecasts.length) {
    box.replaceChildren();
    return;
  }
  text("#forecast-takeaway", "The shaded band is a likely range from the forecast API, not a promise and not a diagnosis.");
  box.replaceChildren();
  for (const item of forecasts) {
    const block = document.createElement("div");
    block.append(infoCard({
      title: item.title || "Forecast",
      status: "watch",
      statusLabel: "Forecast",
      what_it_means: item.what_it_means,
      why_it_matters_in_space: item.why_it_matters_in_space,
      what_to_do: item.what_to_do,
      who_is_notified: item.who_is_notified,
      confidence: item.confidence,
      sources: item.sources,
    }));
    const points = Array.isArray(item.forecasts) ? item.forecasts : null;
    const y = points ? points.map((point) => point.yhat) : (item.y || item.values);
    const x = points ? points.map((point) => point.label) : (item.x || item.time || (Array.isArray(y) ? y.map((_, index) => index + 1) : null));
    if (!item.title && item.analyte) item.title = plainName(item.analyte) + (item.crew_id ? " · " + item.crew_id : "");
    if (Array.isArray(y) && Array.isArray(x)) {
      const plot = document.createElement("div");
      plot.className = "plot";
      block.append(plot);
      const low = points ? points.map((point) => point.pi95_low) : (item.lower || item.low || item.interval_low);
      const high = points ? points.map((point) => point.pi95_high) : (item.upper || item.high || item.interval_high);
      await charts.lineChart(plot, {
        label: (item.title || "Forecast") + " with likely range",
        yTitle: item.unit || "",
        traces: [{ name: item.title || "Forecast", x, y }],
        ribbon: Array.isArray(low) && Array.isArray(high) ? { low, high, name: "Likely range" } : undefined,
      });
    }
    box.append(block);
  }
}

function readForm() {
  const crew = [...document.querySelectorAll("input[name=crew]:checked")].map((input) => input.value);
  const topics = [...document.querySelectorAll("input[name=topic]:checked")].map((input) => input.value);
  state.filters = {
    crew: crew.length ? crew : CREW_IDS.slice(),
    topics: topics.length ? topics : TOPICS.map((topic) => topic.id),
    view: document.querySelector("#view").value || "overview",
    oorOnly: document.querySelector("#oor-only").checked,
    analyte: state.filters.analyte || "GLUCOSE",
  };
}

function writeForm() {
  const filters = state.filters;
  document.querySelectorAll("input[name=crew]").forEach((input) => {
    input.checked = filters.crew.includes(input.value);
  });
  document.querySelectorAll("input[name=topic]").forEach((input) => {
    input.checked = filters.topics.includes(input.value);
  });
  document.querySelector("#view").value = filters.view;
  document.querySelector("#oor-only").checked = filters.oorOnly;
}

function rememberFilters() {
  const query = filtersToQuery(state.filters);
  const next = query ? `${location.pathname}?${query}` : location.pathname;
  history.replaceState(null, "", next);
}

function showView(view) {
  document.querySelectorAll("[data-view]").forEach((section) => {
    section.hidden = section.dataset.view !== view;
  });
  const videos = document.querySelector("#flow-videos");
  if (videos) {
    const narrowed = state.filters.crew.length < CREW_IDS.length || state.filters.topics.length < TOPICS.length || state.filters.oorOnly;
    videos.hidden = narrowed;
  }
}

function modelFor(filters) {
  const bundle = state.bundle;
  const counted = filterLabRows(bundle.labs, filters, { ignoreOor: true });
  const shown = filterLabRows(bundle.labs, filters);
  const base = buildLocal({ ...bundle, labs: counted });
  const focused = filters.oorOnly ? buildLocal({ ...bundle, labs: shown }) : base;
  return {
    overview: base.overview,
    outOfRange: focused.outOfRange,
    analytes: focused.analytes,
    shift: focused.shift,
    sunburst: focused.sunburst,
    flow: focused.flow,
    radiation: base.radiation,
    extremes: focused.extremes,
    trend: null,
  };
}

function paintHighlights(model) {
  const lines = topTakeaways(model.outOfRange, model.shift, model.extremes.rows);
  text("#kpi-takeaway", lines[0] || "Most results in this selection were in range.");
  const list = document.querySelector("#highlights");
  list.replaceChildren();
  lines.slice(1).forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    list.append(item);
  });
}

async function applyFilters() {
  if (!state.bundle) return;
  state.analyte = state.filters.analyte;
  const model = modelFor(state.filters);
  const names = (model.analytes.analytes || []).map((item) => item.analyte);
  if (names.length && !names.includes(state.filters.analyte)) {
    state.filters.analyte = names.includes("GLUCOSE") ? "GLUCOSE" : names[0];
    state.analyte = state.filters.analyte;
  }
  state.model = model;
  text("#scope", model.overview.scope || "");
  showView(state.filters.view);
  writeForm();
  if (state.filters.view === "overview") {
    paintHighlights(model);
    await renderKpis(model);
    return;
  }
  if (state.filters.view === "labs") {
    fillAnalytes(model);
    if (document.querySelector("#analyte").value) state.filters.analyte = document.querySelector("#analyte").value;
    await Promise.all([renderBars(model), renderTrend(model), renderRest(model)]);
    return;
  }
  if (state.filters.view === "radiation") {
    if (!state.filters.topics.includes("radiation")) {
      text("#rad-takeaway", "Radiation is turned off in Topics. Check Radiation to see the station dose.");
      return;
    }
    text("#rad-takeaway", "This line is the space station’s radiation for one week in June 2024, not a personal dose.");
    await renderRest(model);
    return;
  }
  await renderGuidance();
}

function onFilterInput(event) {
  if (event.target.id === "analyte") return;
  readForm();
  rememberFilters();
  applyFilters();
}

document.querySelector("#filters").addEventListener("change", onFilterInput);
document.querySelector("#reset").addEventListener("click", (event) => {
  event.preventDefault();
  state.filters = defaultFilters();
  rememberFilters();
  writeForm();
  applyFilters();
});

document.querySelector("#analyte").addEventListener("change", (event) => {
  state.filters.analyte = event.target.value;
  state.analyte = event.target.value;
  rememberFilters();
  if (state.model) renderTrend(state.model);
});

async function boot() {
  statusNode.textContent = "Loading the short version.";
  state.filters = parseFilters(location.search);
  writeForm();
  try {
    const api = await loadApi();
    await loadCsv();
    state.source = api ? "api" : "csv";
    statusNode.textContent = api
      ? "Live totals match /eda. Filters run in this browser, with no reload."
      : "The API did not respond. These numbers were computed in the browser from data/*.csv, using the same definitions as /eda.";
    await applyFilters();
  } catch (error) {
    statusNode.textContent = "Charts did not load.";
    showError("Start the API for /eda, or serve this folder with /data pointing at the NASA CSVs.");
  }
}

boot();
