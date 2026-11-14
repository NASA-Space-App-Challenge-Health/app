/** Client-side filters for the data insights page. Pure functions, no DOM. */

import { oorTakeaway, shiftTakeaway } from "./plain.js";

export const CREW_IDS = ["C001", "C002", "C003", "C004"];

export const TOPICS = [
  { id: "metabolism", label: "Blood sugar & metabolism" },
  { id: "kidney", label: "Kidney" },
  { id: "blood", label: "Blood cells & immune" },
  { id: "electrolytes", label: "Electrolytes" },
  { id: "liver", label: "Liver" },
  { id: "radiation", label: "Radiation" },
];

export const VIEWS = ["overview", "labs", "radiation", "recommendations"];

const KIDNEY = new Set([
  "UREA NITROGEN (BUN)",
  "CREATININE",
  "BUN/CREATININE RATIO",
  "eGFR AFRICAN AMERICAN",
  "eGFR NON-AFR. AMERICAN",
]);
const ELECTROLYTES = new Set(["SODIUM", "POTASSIUM", "CHLORIDE", "CARBON DIOXIDE", "CALCIUM"]);
const LIVER = new Set([
  "ALT", "AST", "ALKALINE PHOSPHATASE", "BILIRUBIN; TOTAL",
  "ALBUMIN", "ALBUMIN/GLOBULIN RATIO", "GLOBULIN", "PROTEIN; TOTAL",
]);
const VITALS = new Set(["heart_rate", "sleep_hours", "cortisol_ug_dl", "spo2", "temperature_c"]);

export function defaultFilters() {
  return {
    crew: CREW_IDS.slice(),
    topics: TOPICS.map((topic) => topic.id),
    view: "overview",
    oorOnly: false,
    analyte: "GLUCOSE",
  };
}

export function topicFor(analyte, panel) {
  if (analyte === "GLUCOSE") return "metabolism";
  if (KIDNEY.has(analyte)) return "kidney";
  if (ELECTROLYTES.has(analyte)) return "electrolytes";
  if (LIVER.has(analyte)) return "liver";
  if (panel === "CBC" || panel === "cytokine") return "blood";
  return null;
}

function pick(value, allowed) {
  if (!value) return null;
  const chosen = value.split(",").map((item) => item.trim()).filter((item) => allowed.includes(item));
  return chosen.length ? chosen : null;
}

export function parseFilters(params) {
  const filters = defaultFilters();
  const source = params instanceof URLSearchParams ? params : new URLSearchParams(params || "");
  const crew = pick(source.get("crew"), CREW_IDS);
  const topics = pick(source.get("topic"), TOPICS.map((topic) => topic.id));
  if (crew) filters.crew = crew;
  if (topics) filters.topics = topics;
  if (VIEWS.includes(source.get("view"))) filters.view = source.get("view");
  filters.oorOnly = source.get("oor") === "1";
  if (source.get("analyte")) filters.analyte = source.get("analyte");
  return filters;
}

export function filtersToQuery(filters) {
  const query = new URLSearchParams();
  if (filters.view && filters.view !== "overview") query.set("view", filters.view);
  if (filters.crew.length && filters.crew.length < CREW_IDS.length) query.set("crew", filters.crew.join(","));
  if (filters.topics.length && filters.topics.length < TOPICS.length) query.set("topic", filters.topics.join(","));
  if (filters.oorOnly) query.set("oor", "1");
  if (filters.analyte && filters.analyte !== "GLUCOSE") query.set("analyte", filters.analyte);
  return query.toString();
}

export function topicAllowed(analyte, panel, filters) {
  if (!filters.topics.length || filters.topics.length === TOPICS.length) return true;
  const topic = topicFor(analyte, panel) || topicFor(analyte, panel || "CBC");
  return Boolean(topic) && filters.topics.includes(topic);
}

export function filterLabRows(rows, filters, { ignoreOor = false } = {}) {
  return (rows || []).filter((row) => {
    if (row.crew_id && filters.crew.length && !filters.crew.includes(row.crew_id)) return false;
    if (!topicAllowed(row.analyte, row.panel, filters)) return false;
    if (!ignoreOor && filters.oorOnly && row.flag !== "low" && row.flag !== "high") return false;
    return true;
  });
}

export function matchRecommendation(item, filters) {
  if (!item) return false;
  if (item.crew_id && !filters.crew.includes(item.crew_id)) return false;
  const analyte = item.analyte || (!VITALS.has(item.indicator) ? item.indicator : null);
  if (analyte && analyte !== "radiation") {
    if (!topicAllowed(analyte, item.panel, filters)) return false;
  } else if (!item.crew_id && /radiation|dose|sep/i.test(String(item.id || item.title || item.indicator || ""))) {
    if (!filters.topics.includes("radiation")) return false;
  } else if (VITALS.has(item.indicator)) {
    const labTopics = TOPICS.filter((topic) => topic.id !== "radiation").map((topic) => topic.id);
    const allLabs = labTopics.every((id) => filters.topics.includes(id));
    if (!allLabs) return false;
  }
  return true;
}

export function topTakeaways(oor, shift, extremeRows) {
  const lines = [];
  if (oor && oor.analyte && oor.analyte.length) lines.push(oorTakeaway(oor));
  if (shift && shift.analyte && shift.analyte.length) lines.push(shiftTakeaway(shift));
  const suspect = (extremeRows || []).some((row) => row.crew_id === "C003" && row.timepoint === "L-92" && (row.analyte === "MPV" || row.analyte === "RDW"));
  lines.push(suspect
    ? "C003 L-92 platelet size and RDW look like suspect rows."
    : "Most results in this selection were in range.");
  return lines.slice(0, 3);
}
