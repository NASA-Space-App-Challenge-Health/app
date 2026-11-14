/** Plain-language labels for astronauts. Not a diagnosis. */

const CSA = {
  title: "CSA infographic — how space affects the human body",
  url: "https://www.asc-csa.gc.ca/eng/multimedia/search/image/8056",
};
const HRP = { title: "5 Hazards of Human Spaceflight", url: "https://www.nasa.gov/hrp/hazards/" };
const CMP = { title: "OSD-575 Inspiration4 metabolic panel", url: "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575" };
const CBC = { title: "OSD-569 Inspiration4 blood count", url: "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569/" };

const NAMES = {
  GLUCOSE: "Blood sugar (glucose)",
  "UREA NITROGEN (BUN)": "Kidney waste (urea nitrogen, BUN)",
  "ABSOLUTE MONOCYTES": "Infection-fighting white cells (absolute monocytes)",
  "ABSOLUTE LYMPHOCYTES": "Immune white cells (absolute lymphocytes)",
  "ABSOLUTE NEUTROPHILS": "Infection-fighting white cells (absolute neutrophils)",
  AST: "Liver enzyme (AST)",
  ALT: "Liver enzyme (ALT)",
  "BUN/CREATININE RATIO": "Kidney waste ratio (BUN/creatinine)",
  POTASSIUM: "Potassium",
  SODIUM: "Sodium",
  "ALKALINE PHOSPHATASE": "Liver and bone enzyme (alkaline phosphatase)",
  HEMOGLOBIN: "Oxygen-carrying protein (hemoglobin)",
  HEMATOCRIT: "Red-cell share of blood (hematocrit)",
  EOSINOPHILS: "Allergy-related white cells (eosinophils)",
  MONOCYTES: "White-cell share (monocytes)",
  "WHITE BLOOD CELL COUNT": "White blood cells",
  "PLATELET COUNT": "Clotting cells (platelets)",
  CREATININE: "Kidney filter marker (creatinine)",
  MCHC: "Red-cell hemoglobin amount (MCHC)",
  "PROTEIN; TOTAL": "Total blood protein",
  MPV: "Platelet size (MPV)",
  RDW: "Red-cell size spread (RDW)",
  "RED BLOOD CELL COUNT": "Red blood cells",
};

const CARDS = {
  GLUCOSE: {
    means: "Blood sugar (glucose) is the fuel measured in the blood. A high or low flag means that sample sat outside the range printed on the NASA row.",
    why: "The Canadian Space Agency notes that weightlessness can come with insulin resistance. High blood sugar, together with that change, is one reason clinicians watch for a Type 2 diabetes pattern. This file cannot say that anyone developed diabetes.",
    todo: "Tell the crew medical officer or the flight surgeon. Do not change food, medicine, or exercise from this chart.",
    sources: [CSA, CMP, HRP],
  },
  POTASSIUM: {
    means: "Potassium helps muscles and the heart rhythm. In this file, crew C003 was 3.3 mmol/L three days before launch and 3.0 the day after. Both are below the 3.5–5.3 range printed on the row.",
    why: "Fluid shifts in weightlessness can move salts like potassium. A value that is already low, then lower, is a reason for a clinician to look before the next blood draw.",
    todo: "Ask for a recheck. Tell the flight surgeon. Do not start supplements from this screen.",
    sources: [CMP, HRP],
  },
  HEMOGLOBIN: {
    means: "Hemoglobin carries oxygen in red blood cells. A low flag means that sample was under the range printed on the row.",
    why: "The Canadian Space Agency describes less red-cell production in spaceflight, which can look like anemia. One flag in this short mission is not that diagnosis.",
    todo: "Let the crew medical officer compare it with the rest of the blood count. Do not treat it yourself.",
    sources: [CSA, CBC],
  },
  "WHITE BLOOD CELL COUNT": {
    means: "White blood cells are part of how the body responds to infection. A flag means the count sat outside the printed range.",
    why: "The Canadian Space Agency notes that fewer white cells can leave someone more open to infection and more sensitive to radiation. This chart does not say that happened here.",
    todo: "Tell the crew medical officer. Keep the radiation procedure separate: the crew hears a generic notice, not this lab value.",
    sources: [CSA, CBC, HRP],
  },
  "UREA NITROGEN (BUN)": {
    means: "Urea nitrogen is a waste marker the kidneys clear. A high flag means that sample was above the printed range.",
    why: "Body fluid shifts in space can change kidney waste numbers. A high result is a prompt to look at hydration and the rest of the chemistry panel, not a kidney diagnosis.",
    todo: "Show the chemistry panel to the flight surgeon. Do not restrict fluids on your own.",
    sources: [CMP, HRP],
  },
  "BUN/CREATININE RATIO": {
    means: "This ratio compares two kidney-related waste markers. It can move when one of them moves, including when a value was missing or unusual.",
    why: "It is a clue next to urea nitrogen and creatinine, not a standalone picture of kidney health in space.",
    todo: "Read it with the other kidney markers and a clinician. Do not act on the ratio alone.",
    sources: [CMP],
  },
  AST: {
    means: "AST is an enzyme often checked with the liver. A high flag means that sample was above the printed range.",
    why: "A single enzyme bump is a reason to look at the rest of the liver panel. It is not, by itself, a liver diagnosis.",
    todo: "Ask the flight surgeon to read AST with ALT and the other chemistry results.",
    sources: [CMP],
  },
  "ALKALINE PHOSPHATASE": {
    means: "Alkaline phosphatase is an enzyme linked with liver and bone. A flag means the sample sat outside the printed range.",
    why: "Bone and liver both change in longer spaceflight. This 3-day mission’s lab file cannot show bone loss. The flag is still worth a clinician’s look.",
    todo: "Let the flight surgeon decide if it needs a repeat. Do not infer a bone or liver condition from this chart.",
    sources: [CSA, CMP],
  },
  "ABSOLUTE MONOCYTES": {
    means: "Monocytes are a kind of white blood cell. “Absolute” means a count, not a percent.",
    why: "White-cell counts are part of the infection and radiation story the Canadian Space Agency describes. One cell type sitting high is not an infection diagnosis.",
    todo: "Compare it with the full white-cell count and tell the crew medical officer.",
    sources: [CSA, CBC],
  },
  EOSINOPHILS: {
    means: "Eosinophils are a small share of white blood cells, often discussed with allergies. A percent can jump a lot when the starting number is tiny.",
    why: "A large percent change on a small base is easy to over-read. Look at the unit before treating the bar as a big medical change.",
    todo: "Ask a clinician to read the percent next to the absolute count. Do not treat an allergy from this chart.",
    sources: [CBC],
  },
  MPV: {
    means: "MPV is a measure of platelet size. C003 at L-92 is far from that same person’s later draws, so this row looks like a source-file problem.",
    why: "A number this far off the later scale should not drive a medical story about clotting in space.",
    todo: "Do not make a decision from it. Ask whether the row used a different unit or a bad transcription.",
    sources: [CBC],
  },
  RDW: {
    means: "RDW describes how much red blood cells vary in size. C003 at L-92 is far from that person’s later draws.",
    why: "Like the platelet-size row beside it, this looks like a suspect source value, not a finding about spaceflight anemia.",
    todo: "Set it aside for a data check. Use the later hemoglobin and red-cell results if a clinician reviews the file.",
    sources: [CBC],
  },
};

export function plainName(analyte) {
  if (!analyte) return "This test";
  return NAMES[analyte] || `Lab test (${analyte})`;
}

export function statusForFlag(low, high) {
  if (low && high) return { status: "out", label: "High and low" };
  if (high) return { status: "out", label: "High" };
  if (low) return { status: "watch", label: "Low" };
  return { status: "in", label: "In range" };
}

export function flagCard(analyte, low, high) {
  const name = plainName(analyte);
  const known = CARDS[analyte] || {};
  const count = (low || 0) + (high || 0);
  const tone = statusForFlag(low, high);
  const side = low && high ? "sometimes low and sometimes high" : low ? "low" : "high";
  return {
    title: name,
    status: tone.status,
    statusLabel: tone.label,
    what_it_means: known.means || `${name} comes from the published Inspiration4 blood tables. “${tone.label}” means ${count} sample${count === 1 ? "" : "s"} sat ${side} of the range printed on the NASA row. That is not a diagnosis.`,
    why_it_matters_in_space: known.why || "Spaceflight changes fluid, muscle, bone, and metabolism. A flag is a reason to look. It is not a conclusion about this person.",
    what_to_do: known.todo || "Show it to the crew medical officer or flight surgeon. Do not start a treatment from this screen.",
    who_is_notified: "Crew medical officer and flight surgeon. This does not go out as a crew-wide alert.",
    sources: known.sources || [CMP, CBC],
    count,
  };
}

export function oorTakeaway(oor) {
  if (!oor || !oor.analyte || !oor.analyte.length) return "No out-of-range blood results were in this file.";
  const count = (oor.low[0] || 0) + (oor.high[0] || 0);
  return `${plainName(oor.analyte[0])} was the most common out-of-range result (${count} samples).`;
}

export function shiftTakeaway(shift) {
  if (!shift || !shift.analyte || !shift.analyte.length) return "No before-versus-after comparison was available.";
  const pct = shift.mean_percent[0];
  const dir = pct < 0 ? "fell" : "rose";
  const shown = (pct > 0 ? "+" : "") + pct + "%";
  return `From three days before launch to the day after landing, ${plainName(shift.analyte[0])} ${dir} the most on average (${shown}).`;
}

export function trendTakeaway(analyte) {
  return `Each line is one astronaut’s ${plainName(analyte)}. The shade is the reference range printed on the NASA row.`;
}

export function monthTakeaway(sep) {
  const x = (sep && sep.x) || [];
  const y = (sep && sep.y) || [];
  if (!x.length) return "No solar-particle reports were in this file.";
  let best = 0;
  y.forEach((value, index) => { if (value > y[best]) best = index; });
  const [year, month] = String(x[best]).split("-");
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const label = names[Number(month) - 1] ? `${names[Number(month) - 1]} ${year}` : x[best];
  return `${label} had the most solar-particle reports in this file (${y[best]} instrument rows, not ${y[best]} separate storms).`;
}

export function friendlyFlowLabel(label) {
  const map = {
    "pre-flight": "Before flight",
    "just after flight": "Day after landing",
    recovery: "Recovery",
    low: "Low",
    normal: "In range",
    high: "High",
  };
  return map[label] || label;
}

export function friendlySunburst(sun) {
  const used = new Map();
  function rename(label) {
    if (!label) return "";
    if (used.has(label)) return used.get(label);
    let next = label;
    if (label === "Out of range") next = "Outside range";
    else if (label === "blood/immune") next = "Blood and immune cells";
    else if (label === "cardiovascular/metabolic") next = "Heart and metabolism";
    else if (label === "kidney/electrolytes") next = "Kidneys and salts";
    else if (label === "liver") next = "Liver";
    else if (NAMES[label]) next = NAMES[label];
    else if (label.includes(" / ")) {
      const [system, panel] = label.split(" / ");
      const panelName = panel === "CBC" ? "blood count" : panel === "CMP" ? "chemistry" : panel;
      next = `${rename(system)} · ${panelName}`;
    }
    if ([...used.values()].includes(next) && next !== label) next = `${next} [${label}]`;
    used.set(label, next);
    return next;
  }
  return {
    labels: (sun.labels || []).map(rename),
    parents: (sun.parents || []).map(rename),
    values: sun.values,
  };
}

export function monthLabel(stamp) {
  const [year, month] = String(stamp).split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const name = names[Number(month) - 1];
  return name ? `${name} ${year}` : stamp;
}
