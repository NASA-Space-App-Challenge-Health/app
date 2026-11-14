"""Astronaut-facing words for a forecast. Numbers stay in `technical`.

Citations are the pages already listed in rules.yaml. No new clinical cutoff.
Confidence is low or medium: these series have at most seven points.
"""

from __future__ import annotations

from typing import Any

# Phrase that can follow "Your ". A comma inside the phrase marks a short gloss.
NAMES = {
    "GLUCOSE": "blood sugar (glucose)",
    "POTASSIUM": "potassium",
    "SODIUM": "sodium, a blood salt",
    "CHLORIDE": "chloride, a blood salt",
    "CALCIUM": "calcium",
    "CARBON DIOXIDE": "carbon dioxide in the blood",
    "UREA NITROGEN (BUN)": "urea nitrogen (BUN), a kidney-related marker",
    "CREATININE": "creatinine, a kidney-related marker",
    "BUN/CREATININE RATIO": "BUN-to-creatinine balance, two kidney-related markers",
    "eGFR AFRICAN AMERICAN": "kidney-filter estimate (eGFR)",
    "eGFR NON-AFR. AMERICAN": "kidney-filter estimate (eGFR)",
    "WHITE BLOOD CELL COUNT": "white blood cell count",
    "ABSOLUTE NEUTROPHILS": "neutrophil count, a type of white blood cell",
    "ABSOLUTE LYMPHOCYTES": "lymphocyte count, a type of white blood cell",
    "ABSOLUTE MONOCYTES": "monocyte count, a type of white blood cell",
    "ABSOLUTE EOSINOPHILS": "eosinophil count, a type of white blood cell",
    "ABSOLUTE BASOPHILS": "basophil count, a type of white blood cell",
    "NEUTROPHILS": "neutrophil percentage, a type of white blood cell",
    "LYMPHOCYTES": "lymphocyte percentage, a type of white blood cell",
    "MONOCYTES": "monocyte percentage, a type of white blood cell",
    "EOSINOPHILS": "eosinophil percentage, a type of white blood cell",
    "BASOPHILS": "basophil percentage, a type of white blood cell",
    "HEMOGLOBIN": "hemoglobin, the oxygen-carrying part of red blood cells",
    "HEMATOCRIT": "hematocrit, the share of blood that is red cells",
    "RED BLOOD CELL COUNT": "red blood cell count",
    "PLATELET COUNT": "platelet count, the cells that help blood clot",
    "MPV": "platelet size (MPV)",
    "RDW": "red-cell size spread (RDW)",
    "MCHC": "red-cell concentration (MCHC)",
    "MCH": "hemoglobin per red cell (MCH)",
    "MCV": "red-cell size (MCV)",
    "AST": "AST, a liver enzyme",
    "ALT": "ALT, a liver enzyme",
    "ALKALINE PHOSPHATASE": "alkaline phosphatase, a liver and bone enzyme",
    "BILIRUBIN; TOTAL": "bilirubin, a liver-related pigment",
    "ALBUMIN": "albumin, a protein made by the liver",
    "GLOBULIN": "globulin, a blood protein",
    "PROTEIN; TOTAL": "total blood protein",
}

WHITE = {
    "WHITE BLOOD CELL COUNT", "ABSOLUTE NEUTROPHILS", "ABSOLUTE LYMPHOCYTES",
    "ABSOLUTE MONOCYTES", "ABSOLUTE EOSINOPHILS", "ABSOLUTE BASOPHILS",
    "NEUTROPHILS", "LYMPHOCYTES", "MONOCYTES", "EOSINOPHILS", "BASOPHILS",
}
RED = {"HEMOGLOBIN", "HEMATOCRIT", "RED BLOOD CELL COUNT", "RDW", "MCHC", "MCH", "MCV"}
KIDNEY = {
    "UREA NITROGEN (BUN)", "CREATININE", "BUN/CREATININE RATIO",
    "eGFR AFRICAN AMERICAN", "eGFR NON-AFR. AMERICAN",
}
ELECTROLYTE = {"POTASSIUM", "SODIUM", "CHLORIDE", "CALCIUM", "CARBON DIOXIDE"}
LIVER = {"AST", "ALT", "ALKALINE PHOSPHATASE", "BILIRUBIN; TOTAL", "ALBUMIN", "GLOBULIN", "PROTEIN; TOTAL"}

WHO = {
    "self": "You, the crew medical officer, and the flight surgeon can see this. It is not announced to the whole crew.",
    "cmo": "You, the crew medical officer, and the flight surgeon can see this. It is not announced to the whole crew.",
    "flight_surgeon": "The flight surgeon sees this in private. The crew medical officer does not. It is not announced to the crew.",
    "emergency": "The whole crew gets a short procedure notice. It does not name a person or a diagnosis.",
}


def plain_name(analyte: str) -> str:
    return NAMES.get(analyte, analyte.lower())


def _your(name: str, rest: str) -> str:
    """'Your potassium dipped' or 'Your BUN, a kidney marker, dipped'."""
    if "," in name:
        return f"Your {name}, {rest}"
    return f"Your {name} {rest}"


def _subject(name: str) -> str:
    subject = name[:1].upper() + name[1:]
    if "," in name:
        return subject + ","
    return subject


def family(analyte: str) -> str:
    if analyte == "GLUCOSE":
        return "glucose"
    if analyte in WHITE:
        return "white"
    if analyte in RED:
        return "red"
    if analyte in KIDNEY:
        return "kidney"
    if analyte in ELECTROLYTE:
        return "electrolyte"
    if analyte in LIVER:
        return "liver"
    return "other"


def _suspect(item: dict[str, Any]) -> bool:
    ys = [float(y) for y in item.get("history", {}).get("y") or []]
    if len(ys) < 3:
        return False
    nxt = item["forecasts"][0]["yhat"]
    ordered = sorted(ys)
    med = ordered[len(ordered) // 2]
    if med > 0 and nxt < 0:
        return True
    second = ordered[-2]
    peak = ordered[-1]
    if second > 0 and peak > 2 * second and peak > second + 10:
        return True
    return False


def _direction(item: dict[str, Any]) -> str:
    last = item["last"]
    sides = {row.get("flag") for row in item.get("excursions") or []}
    if _suspect(item):
        return "suspect"
    if last.get("flag") == "high":
        return "high"
    if last.get("flag") == "low":
        return "low"
    if "high" in sides and "low" in sides:
        return "both"
    if "high" in sides:
        return "was_high"
    if "low" in sides:
        return "was_low"
    slope = item.get("fit", {}).get("slope_per_day") or 0
    if "trending_toward_out_of_range" in item.get("flags", []):
        return "rising" if slope > 0 else "falling"
    return "steady"


def _confidence(item: dict[str, Any], direction: str) -> tuple[str, str]:
    n = item.get("n") or 0
    reason = (
        f"Only {n} blood draws, from a 3-day civilian flight. "
        "The shaded band is a wide prediction interval, so this is a heads-up, not a precise forecast."
    )
    if direction == "suspect":
        return "low", reason + " One early point is far off the later draws, so the straight line is not usable."
    if direction in {"high", "low"}:
        return "medium", (
            "The latest blood draw itself is outside the range printed on the lab report. "
            + reason
        )
    return "low", reason


def _title(name: str, direction: str) -> str:
    short = name.split(",")[0]
    titles = {
        "high": _your(name, "is above the usual range"),
        "low": _your(name, "is below the usual range"),
        "both": _your(name, "has been both above and below the usual range"),
        "was_high": _your(name, "was above the usual range earlier in this series"),
        "was_low": _your(name, "dipped below the usual range earlier in this series"),
        "rising": _your(name, "is trending toward the edge of the usual range"),
        "falling": _your(name, "is trending toward the edge of the usual range"),
        "suspect": f"One early {short} result looks off the scale of the later draws",
        "steady": _your(name, "is inside the usual range"),
    }
    return titles[direction]


def _means(name: str, direction: str, kind: str) -> str:
    if direction == "suspect":
        short = name.split(",")[0]
        return (
            f"A straight line through the {short} points runs to a number that does not make sense as a next blood draw. "
            "Ask the CMO to recheck that early result before anyone treats the line as a forecast."
        )
    if direction == "steady":
        return (
            f"The latest {name} result is inside the range printed on the lab report. "
            "The line through a handful of draws is only a sketch."
        )
    if direction == "both":
        return (
            f"{_subject(name)} went both above and below the usual range in this short set of draws, and the latest result is back inside. "
            "That is worth checking with the CMO, and it is not a diagnosis."
        )
    if direction in {"was_high", "was_low"}:
        side = "above" if direction == "was_high" else "below"
        return (
            f"{_subject(name)} went {side} the usual range earlier, and the latest draw is back inside. "
            "The line past the last draw is uncertain, and this is not a diagnosis."
        )
    short = name.split(",")[0]
    if direction == "high":
        if kind == "kidney":
            return (
                f"The latest {short} result is above the range on the lab report, and food or fluids can move it. "
                "Ask the CMO for a repeat check — this is not a diagnosis, and it does not mean your kidneys are failing."
            )
        return (
            f"The latest {short} result is above the range on the lab report. "
            "A repeat check with the CMO is worth it, and this is not a diagnosis."
        )
    if direction == "low":
        return (
            f"The latest {short} result is below the range on the lab report. "
            "A repeat check with the CMO is worth it, and this is not a diagnosis."
        )
    return (
        f"The straight line for {name} points toward the edge of the usual range. "
        "With this few draws the band around that line is wide. This is not a diagnosis."
    )


def _why(kind: str, direction: str) -> str:
    if kind == "glucose":
        return (
            "The Canadian Space Agency notes that astronauts can develop insulin resistance, which may lead to Type 2 diabetes. "
            "A short series could raise that as something to watch with the CMO. It does not mean you have diabetes."
        )
    if kind == "white":
        low_note = (
            "The Canadian Space Agency notes that a low white blood cell count can leave someone more open to infection "
            "and is linked with more sensitivity to radiation."
        )
        if direction == "low":
            return low_note + " That is a reason to tell the CMO. It does not mean you have an infection."
        if direction in {"high", "was_high"}:
            return low_note + " Your result is on the high side, not the low side, so that note is context rather than a match. Ask the CMO."
        return low_note + " Yours is not a low result on the latest draw. Keep it on the CMO's list if an earlier draw left the range."
    if kind == "red":
        return (
            "The Canadian Space Agency notes that reduced red blood cells can cause anemia. "
            "A value outside the usual range could raise that as something to watch. It does not mean you have anemia."
        )
    if kind == "kidney":
        return (
            "Urea nitrogen (BUN) and creatinine are kidney-related markers on the Inspiration4 metabolic panel. "
            "A result outside the usual range can come from food or fluids and does not mean your kidneys are failing. NASA notes medical care is harder to reach farther from Earth, so ask the CMO while you can."
        )
    if kind == "electrolyte":
        return (
            "This is a blood salt on the Inspiration4 metabolic panel. "
            "NASA lists distance from Earth as a hazard because medical care is harder to reach, so a repeat check belongs with the CMO before anyone changes food or supplements. "
            "This note is not a heart or kidney diagnosis."
        )
    if kind == "liver":
        return (
            "This is a liver-related result on the Inspiration4 metabolic panel. "
            "A value outside the usual range is a reason to ask the CMO, not a diagnosis."
        )
    return (
        "NASA lists distance from Earth as a hazard because medical care, supplies, and a second opinion get harder to reach. "
        "A result outside the usual range is something to check with the CMO while you still can. It is not a diagnosis."
    )


def _actions(kind: str) -> str:
    if kind == "glucose":
        return (
            "Keep your planned meals and your exercise. Protect your sleep. "
            "Tell the CMO and ask whether to repeat the blood sugar test. Do not start medicine or supplements on your own."
        )
    if kind == "kidney":
        return (
            "Stay with the nutrition and fluid plan you already have. Keep sleep and exercise on the crew plan. "
            "Ask the CMO to look at the kidney-related numbers. Do not start supplements on your own."
        )
    if kind == "white":
        return (
            "Tell the CMO. Keep the usual hygiene and sleep routine. "
            "Do not treat this as an infection, and do not start medicine on your own."
        )
    if kind == "red":
        return (
            "Keep your exercise and meals on the crew plan. Tell the CMO and ask whether to repeat the blood count. "
            "Do not start iron or other supplements on your own."
        )
    if kind == "electrolyte":
        return (
            "Do not start supplements on your own. Keep the planned meals. "
            "Ask the CMO to recheck this before the next blood draw."
        )
    return (
        "Repeat the scheduled test and talk with the CMO. Keep sleep, meals, and exercise on the crew plan. "
        "Do not start a new medicine or supplement on your own."
    )


def _trend_sentence(item: dict[str, Any]) -> str:
    last = item["last"]
    low, high = last.get("ref_low"), last.get("ref_high")
    span = "no range on the row" if low is None or high is None else f"usual range {low}–{high}"
    unit = last.get("unit") or ""
    nxt = item["forecasts"][0]
    pair = (item.get("worsening_pairs") or [None])[0]
    bits = [
        f"Latest {last.get('value')} {unit} at {last.get('timepoint')} ({span}, lab flag {last.get('flag')}).",
        f"Straight-line next step {nxt['yhat']} {unit}, 95% band {nxt['pi95_low']} to {nxt['pi95_high']}.",
    ]
    if pair:
        bits.append(
            f"One step already outside the range moved further out: {pair['earlier_timepoint']} {pair['earlier_value']} to {pair['later_timepoint']} {pair['later_value']}."
        )
    elif item.get("excursions"):
        shown = ", ".join(f"{row['timepoint']} {row['value']} {row['flag']}" for row in item["excursions"][:4])
        bits.append(f"Draws outside the range in this series: {shown}.")
    return " ".join(bits)


def lab_card(item: dict[str, Any], *, analyte: str, sources: list[dict[str, str]], tier: str | None = None) -> dict[str, Any]:
    kind = family(analyte)
    direction = _direction(item)
    name = plain_name(analyte)
    level, reason = _confidence(item, direction)
    who = WHO.get(tier or "", "You, the crew medical officer, and the flight surgeon can see this. It is not announced to the whole crew.")
    last = item["last"]
    return {
        "title": _title(name, direction),
        "what_it_means": _means(name, direction, kind),
        "why_it_matters_in_space": _why(kind, direction),
        "what_to_do": _actions(kind),
        "who_is_notified": who,
        "confidence": level,
        "confidence_reason": reason,
        "sources": sources,
        "technical": {
            "analyte": analyte,
            "plain_name": name,
            "value": last.get("value"),
            "unit": last.get("unit"),
            "timepoint": last.get("timepoint"),
            "reference_range": {"low": last.get("ref_low"), "high": last.get("ref_high")},
            "flag": last.get("flag"),
            "trend": _trend_sentence(item),
            "next_step": item["forecasts"][0],
            "flags": item.get("flags") or [],
            "n": item.get("n"),
        },
    }


def needs_lab_recommendation(item: dict[str, Any]) -> bool:
    if item.get("flags"):
        return True
    if item.get("last", {}).get("flag") in {"low", "high"}:
        return True
    return bool(item.get("excursions"))


def lab_tier(item: dict[str, Any]) -> str:
    if _suspect(item):
        return "self"
    if "already_out_and_worsening" in item.get("flags", []) or item.get("last", {}).get("flag") in {"low", "high"}:
        return "cmo"
    return "self"


def radiation_card(forecast: dict[str, Any], sources: list[dict[str, str]]) -> dict[str, Any]:
    peak = forecast.get("peak") or {}
    cumulative = (forecast.get("cumulative") or [{}])[0]
    sep = (forecast.get("sep_after_peak") or [{}])[0]
    return {
        "title": "The vehicle radiation monitor saw a high reading",
        "what_it_means": (
            "A cabin monitor recorded a high area dose rate, and a solar particle event was logged in the days after. "
            "This is a vehicle reading, not a dose measured on your body, and it is not a diagnosis."
        ),
        "why_it_matters_in_space": (
            "NASA calls space radiation one of the most hazardous parts of spaceflight. "
            "The Canadian Space Agency notes that overexposure can damage DNA, raise the risk of cancer, and cause cataracts. "
            "Distance from Earth also makes medical help slower to arrive."
        ),
        "what_to_do": "Follow the radiation procedure. Stay with the plan the crew medical officer gives you.",
        "who_is_notified": WHO["emergency"],
        "confidence": "medium",
        "confidence_reason": (
            "The monitor reading and the solar event are real records. They are not the same timestamp, "
            "and this is an area dose rate, not a personal dose. The 24-hour smoothing forecast stays near the recent average and will miss a short spike."
        ),
        "sources": sources,
        "technical": {
            "value": peak.get("absorbed_dose_rate"),
            "unit": "μGy/h",
            "reference_range": {"low": None, "high": forecast.get("spike_threshold_ugy_h"), "note": "App setting in rules.yaml, not a NASA career limit."},
            "trend": (
                f"Week mean about {cumulative.get('mean_rate_ugy_h')} μGy/h. "
                f"If that mean repeated, the area dose would be about {cumulative.get('area_dose_ugy')} μGy over {cumulative.get('days')} days. "
                f"Next solar event in the app window: {sep.get('sep_id')}."
            ),
            "label": "Area dose rate, not a personal dose.",
        },
    }


def radiation_public_card() -> dict[str, str]:
    return {
        "what_it_means": (
            "The vehicle radiation monitor saw a high reading, and a solar particle event was logged in the days after. "
            "This notice does not name a person or a diagnosis."
        ),
        "why_it_matters_in_space": (
            "NASA calls space radiation one of the most hazardous parts of spaceflight. "
            "Follow the procedure. This is not a personal dose."
        ),
        "what_to_do": "Follow the radiation procedure.",
        "who_is_notified": "The whole crew gets this short notice. It does not name a person or a diagnosis.",
        "confidence": "medium",
        "confidence_reason": "A real monitor reading and a real solar event are in the record. The crew notice leaves the numbers with the CMO and the flight surgeon.",
    }


VITAL_NAMES = {
    "heart_rate": "heart rate",
    "sleep_hours": "sleep",
    "cortisol_ug_dl": "a stress-hormone marker (cortisol)",
    "hydration_liters": "fluids",
    "hygiene_hour": "hygiene timing",
}


def vital_card(item: dict[str, Any]) -> dict[str, Any]:
    indicator = item.get("indicator") or ""
    name = VITAL_NAMES.get(indicator, indicator.replace("_", " ") or "a simulated reading")
    anomaly = bool(item.get("anomaly"))
    return {
        "title": f"Your simulated {name} is off your own recent pattern" if anomaly else f"Your simulated {name} is near your own recent pattern",
        "what_it_means": (
            f"This {name} series is simulated, not a NASA measurement. "
            + ("The latest point sits far from your own average in this demo." if anomaly else "The latest point is close to your own average in this demo.")
        ),
        "why_it_matters_in_space": (
            "NASA lists sleep and behavioral health among the risks of spaceflight, and isolation can make both harder. "
            "This demo series is not a diagnosis."
        ),
        "what_to_do": "If sleep or how you feel is off, tell the flight surgeon in private. Keep the crew sleep plan.",
        "who_is_notified": WHO["flight_surgeon"] if indicator in {"sleep_hours", "cortisol_ug_dl"} else "You and the crew medical officer can see a heart-rate alert. A crew-wide notice, if any, stays generic.",
        "confidence": "low",
        "confidence_reason": "These points are simulated. A swing versus your own average is not a NASA limit.",
        "sources": [],
        "technical": {
            "indicator": indicator,
            "value": item.get("last"),
            "unit": {"heart_rate": "bpm", "sleep_hours": "hours", "cortisol_ug_dl": "µg/dL"}.get(indicator),
            "trend": item.get("anomaly_rule"),
            "origin": "simulated",
            "z_vs_own_series": item.get("z_vs_own_series"),
        },
    }
