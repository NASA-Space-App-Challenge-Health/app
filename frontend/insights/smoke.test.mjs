import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseCsv } from "./csv.js";
import { buildLocal, trends } from "./eda.js";
import { oorTakeaway, plainName } from "./plain.js";
import { filterLabRows, filtersToQuery, matchRecommendation, parseFilters, topTakeaways } from "./filters.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(name) {
  return parseCsv(readFileSync(join(root, "data", name), "utf8"));
}

const model = buildLocal({
  labs: read("labs_long.csv"),
  doses: read("radiation_iss.csv"),
  seps: read("donki_sep.csv"),
  referenceRanges: read("reference_ranges.csv"),
  datasets: read("datasets.csv"),
});

test("overview matches the published EDA counts", () => {
  assert.equal(model.overview.crew_count, 4);
  assert.equal(model.overview.lab_rows, 13249);
  assert.equal(model.overview.analytes, 524);
  assert.equal(model.overview.out_of_range_rows, 44);
  assert.equal(model.overview.sep_events, 119);
  assert.equal(model.overview.pct_out_of_range, 4.14);
});

test("glucose is the most common out-of-range analyte", () => {
  assert.equal(model.outOfRange.analyte[0], "GLUCOSE");
  assert.equal(model.outOfRange.low[0], 5);
  assert.equal(model.outOfRange.high[0], 2);
  assert.equal(plainName("GLUCOSE"), "Blood sugar (glucose)");
  assert.match(oorTakeaway(model.outOfRange), /Blood sugar \(glucose\) was the most common out-of-range result/);
});

test("C003 potassium falls from L-3 to R+1", () => {
  const trend = trends(read("labs_long.csv"), "POTASSIUM");
  const crew = trend.traces.find((item) => item.name === "C003");
  assert.equal(crew.y[crew.x.indexOf("L-3")], 3.3);
  assert.equal(crew.y[crew.x.indexOf("R+1")], 3.0);
});

test("the largest L-3 to R+1 percent shift is eosinophils", () => {
  assert.equal(model.shift.analyte[0], "EOSINOPHILS");
  assert.ok(Math.abs(model.shift.mean_percent[0] - 51.9) < 0.05);
});

test("sunburst totals the 44 out-of-range rows and keeps unique labels", () => {
  assert.equal(model.sunburst.values[0], 44);
  assert.equal(new Set(model.sunburst.labels).size, model.sunburst.labels.length);
});

test("flow covers every ranged CBC/CMP row", () => {
  const total = model.flow.phase_to_status.value.reduce((sum, value) => sum + value, 0);
  assert.equal(total, model.overview.rows_with_reference);
});

test("extremes flag the suspect C003 L-92 rows at the top", () => {
  const top = model.extremes.rows[0];
  assert.equal(top.crew_id, "C003");
  assert.equal(top.timepoint, "L-92");
  assert.ok(top.analyte === "MPV" || top.analyte === "RDW");
});

test("filters keep one crew and one topic, and round-trip through the query string", () => {
  const filters = parseFilters("crew=C003&topic=metabolism&view=labs&oor=1&analyte=GLUCOSE");
  assert.deepEqual(filters.crew, ["C003"]);
  assert.deepEqual(filters.topics, ["metabolism"]);
  assert.equal(filters.view, "labs");
  assert.equal(filters.oorOnly, true);
  const rows = filterLabRows(model.labs ? [] : [], filters);
  assert.equal(rows.length, 0);
  const labs = filterLabRows([
    { crew_id: "C003", analyte: "GLUCOSE", panel: "CMP", flag: "high" },
    { crew_id: "C003", analyte: "GLUCOSE", panel: "CMP", flag: "normal" },
    { crew_id: "C001", analyte: "GLUCOSE", panel: "CMP", flag: "high" },
    { crew_id: "C003", analyte: "POTASSIUM", panel: "CMP", flag: "low" },
  ], filters);
  assert.equal(labs.length, 1);
  assert.equal(labs[0].crew_id, "C003");
  assert.equal(labs[0].flag, "high");
  const again = parseFilters(filtersToQuery(filters));
  assert.deepEqual(again.crew, ["C003"]);
  assert.equal(again.view, "labs");
  assert.equal(again.oorOnly, true);
});

test("recommendations follow crew and topic", () => {
  const filters = parseFilters("crew=C003&topic=metabolism");
  assert.equal(matchRecommendation({ crew_id: "C003", indicator: "GLUCOSE", title: "Blood sugar" }, filters), true);
  assert.equal(matchRecommendation({ crew_id: "C001", indicator: "GLUCOSE", title: "Blood sugar" }, filters), false);
  assert.equal(matchRecommendation({ crew_id: "C003", indicator: "POTASSIUM", title: "Potassium" }, filters), false);
  assert.equal(matchRecommendation({ crew_id: null, id: "predict_radiation_with_sep", title: "Radiation" }, filters), false);
});

test("overview offers at most three takeaways", () => {
  const lines = topTakeaways(model.outOfRange, model.shift, model.extremes.rows);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /Blood sugar/);
});

test("an empty API base stays same-origin instead of falling back to localhost", () => {
  const source = readFileSync(join(root, "frontend", "insights.js"), "utf8");
  assert.match(source, /typeof window\.CREW_HEALTH_API_BASE === "string"/);
  assert.doesNotMatch(source, /CREW_HEALTH_API_BASE \|\| "http:\/\/127\.0\.0\.1:8080"/);
});

test("the insights page is linked once from the existing nav", () => {
  const html = readFileSync(join(root, "frontend", "index.html"), "utf8");
  const matches = html.match(/insights\.html/g) || [];
  assert.equal(matches.length, 1);
});
