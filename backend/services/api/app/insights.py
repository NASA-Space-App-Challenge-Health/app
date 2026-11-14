"""Crew-wide aggregates shared by the insights page and the notebook."""

from __future__ import annotations

from collections import Counter
from typing import Any


def flag_counts(lab_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: Counter[tuple[str, str, str]] = Counter()
    for row in lab_rows:
        if row.get("panel") not in {"CBC", "CMP"}:
            continue
        if row.get("flag") not in {"low", "high"}:
            continue
        counts[(row["analyte"], row["panel"], row["flag"])] += 1
    ranked = []
    for (analyte, panel, flag), count in counts.most_common():
        ranked.append({"analyte": analyte, "panel": panel, "flag": flag, "count": count, "origin": "real"})
    return ranked


def extremes(lab_rows: list[dict[str, Any]], dose_rows: list[dict[str, Any]]) -> dict[str, Any]:
    def pick(analyte: str, choose_min: bool) -> dict[str, Any] | None:
        rows = [
            row for row in lab_rows
            if row.get("analyte") == analyte and row.get("value") is not None and row.get("panel") in {"CBC", "CMP"}
        ]
        if not rows:
            return None
        best = min(rows, key=lambda item: float(item["value"])) if choose_min else max(rows, key=lambda item: float(item["value"]))
        return {
            "crew_id": best["crew_id"],
            "timepoint": best["timepoint"],
            "value": float(best["value"]),
            "unit": best.get("unit"),
            "flag": best.get("flag"),
            "origin": "real",
        }

    doses = [row for row in dose_rows if row.get("absorbed_dose_rate") is not None]
    peak = max(doses, key=lambda item: float(item["absorbed_dose_rate"])) if doses else None
    return {
        "lowest_glucose": pick("GLUCOSE", True),
        "lowest_hemoglobin": pick("HEMOGLOBIN", True),
        "highest_potassium": pick("POTASSIUM", False),
        "lowest_platelets": pick("PLATELET COUNT", True),
        "peak_vehicle_dose_rate": None if peak is None else {
            "value": float(peak["absorbed_dose_rate"]),
            "unit": "μGy/h",
            "recorded_at": peak["recorded_at"].isoformat() if hasattr(peak["recorded_at"], "isoformat") else str(peak["recorded_at"]),
            "instrument_id": peak.get("instrument_id"),
            "origin": "real",
            "note": "ISS vehicle measurement, not a personal dose.",
        },
    }
