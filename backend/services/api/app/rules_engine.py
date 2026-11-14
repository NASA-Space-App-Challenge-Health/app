"""Alert and recommendation rules.

Emergency radiation pairing and the lab preventive rule read real NASA rows.
Sleep, heart rate, and impact rules exist for series that are not in the
public tables. Cutoffs in rules.yaml are app settings, not NASA limits.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

RULES_PATH = Path(__file__).resolve().parents[1] / "rules" / "rules.yaml"


def load_rules(path: Path | None = None) -> dict[str, Any]:
    raw = yaml.safe_load((path or RULES_PATH).read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or "sources" not in raw:
        raise ValueError("rules.yaml is missing sources")
    return raw


def source_refs(rules: dict[str, Any], keys: list[str]) -> list[dict[str, str]]:
    sources = rules["sources"]
    refs = []
    for key in keys:
        item = sources[key]
        refs.append({"id": key, "url": item["url"], "title": item["title"]})
    return refs


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def radiation_emergency(
    dose_rows: list[dict[str, Any]],
    sep_rows: list[dict[str, Any]],
    rules: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Pair the peak DosTel rate with the next DONKI SEP inside the configured window.

    The two records are not treated as the same timestamp. The alert states the gap.
    """
    rules = rules or load_rules()
    spec = rules["emergency"]["radiation_with_sep"]
    floor = float(spec["dose_rate_at_least"])
    window_h = float(spec["sep_after_hours_max"])
    candidates = [
        row for row in dose_rows
        if row.get("absorbed_dose_rate") is not None and float(row["absorbed_dose_rate"]) >= floor
    ]
    if not candidates or not sep_rows:
        return None
    peak = max(candidates, key=lambda row: float(row["absorbed_dose_rate"]))
    peak_at = _aware(peak["recorded_at"])
    followers = []
    for event in sep_rows:
        event_at = _aware(event["event_time"])
        hours = (event_at - peak_at).total_seconds() / 3600
        if 0 <= hours <= window_h:
            followers.append((hours, event, event_at))
    if not followers:
        return None
    hours, event, event_at = min(followers, key=lambda item: item[0])
    rate = float(peak["absorbed_dose_rate"])
    detail = (
        f"Peak {peak['instrument_id']} absorbed dose rate in this file is "
        f"{rate:.1f} μGy/h at {peak_at.strftime('%Y-%m-%d %H:%M UTC')}. "
        f"The next DONKI solar energetic particle event within {window_h:.0f} hours is "
        f"{event_at.strftime('%Y-%m-%d %H:%M UTC')} ({event['instruments']}), "
        f"about {hours:.0f} hours later. These are two real NASA records, not one timestamp, "
        f"and the dose rate is a vehicle measurement, not a personal dosimeter."
    )
    return {
        "id": "radiation_with_sep",
        "kind": "emergency",
        "severity": spec["severity"],
        "audience": "all",
        "crew_id": None,
        "origin": "real",
        "title": "Radiation exposure alert",
        "detail": detail,
        "suggested_action": (
            "Broadcast to the whole crew. Review the vehicle rate and the SEP notice "
            "with the flight surgeon and radiation console before nonessential time in "
            "thinly shielded areas. Do not treat this number as a crew member's personal dose."
        ),
        "sources": source_refs(rules, spec["sources"]),
        "evidence": {
            "absorbed_dose_rate": rate,
            "unit": "μGy/h",
            "recorded_at": peak_at.isoformat(),
            "instrument_id": peak["instrument_id"],
            "sep_id": event["sep_id"],
            "sep_time": event_at.isoformat(),
            "sep_instruments": event["instruments"],
            "sep_link": event["link"],
            "hours_after_peak": round(hours, 1),
        },
    }


def worsening_lab_recommendations(
    lab_rows: list[dict[str, Any]],
    rules: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Fire when an earlier out-of-range lab is followed by a worse value on the same side."""
    rules = rules or load_rules()
    spec = rules["preventive"]["worsening_lab"]
    panels = set(spec["panels"])
    grouped: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for row in lab_rows:
        if row.get("panel") not in panels or row.get("value") is None:
            continue
        if row.get("flag") not in {"low", "high", "normal"}:
            continue
        key = (row["crew_id"], row["panel"], row["analyte"])
        grouped.setdefault(key, []).append(row)
    found = []
    for (crew_id, panel, analyte), rows in grouped.items():
        rows.sort(key=lambda item: (int(item["days_from_launch"]), item["timepoint"]))
        for earlier, later in zip(rows, rows[1:]):
            side = earlier.get("flag")
            if side not in {"low", "high"} or later.get("flag") != side:
                continue
            before = float(earlier["value"])
            after = float(later["value"])
            worse = after < before if side == "low" else after > before
            if not worse:
                continue
            study_sources = spec["sources_by_panel"][panel]
            unit = earlier.get("unit") or later.get("unit") or ""
            low = earlier.get("ref_low")
            high = earlier.get("ref_high")
            range_text = ""
            if low is not None and high is not None:
                range_text = f" The row reference range is {low:g}–{high:g} {unit}."
            detail = (
                f"{crew_id} {analyte} was already {side} at {earlier['timepoint']} "
                f"({before:g} {unit}). The next sample, {later['timepoint']}, moved further "
                f"{side} to {after:g} {unit}.{range_text} "
                f"The rule fires on the earlier sample, before that later result. "
                f"NASA HRP lists distance from Earth as a hazard because medical care becomes "
                f"harder to receive; this flight's own earlier lab is the moment to recheck. "
                f"The cutoff is the reference range shipped with {earlier.get('source_study') or panel}, "
                f"not a separate flight-surgeon limit."
            )
            found.append({
                "id": "worsening_lab",
                "kind": "preventive",
                "severity": "watch",
                "audience": "crew",
                "crew_id": crew_id,
                "origin": "real",
                "title": f"Recheck {analyte.lower()} before the next draw",
                "detail": detail,
                "suggested_action": (
                    "Recheck this analyte before the next blood draw and tell the flight surgeon. "
                    "Do not start supplements or medication on your own."
                ),
                "sources": source_refs(rules, study_sources),
                "evidence": {
                    "crew_id": crew_id,
                    "panel": panel,
                    "analyte": analyte,
                    "earlier_timepoint": earlier["timepoint"],
                    "earlier_value": before,
                    "later_timepoint": later["timepoint"],
                    "later_value": after,
                    "unit": unit,
                    "flag": side,
                    "source_study": earlier.get("source_study"),
                },
            })
    highlight = spec["highlight"]
    def rank(item: dict[str, Any]) -> tuple[int, str]:
        evidence = item["evidence"]
        featured = (
            evidence["crew_id"] == highlight["crew_id"]
            and evidence["analyte"] == highlight["analyte"]
            and evidence["earlier_timepoint"] == highlight["earlier_timepoint"]
            and evidence["later_timepoint"] == highlight["later_timepoint"]
        )
        return (0 if featured else 1, evidence["analyte"])
    return sorted(found, key=rank)


def sleep_cortisol_recommendations(
    vital_rows: list[dict[str, Any]],
    rules: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Simulated sleep and cortisol only. The numeric cutoffs are not NASA limits."""
    rules = rules or load_rules()
    spec = rules["preventive"]["sleep_and_cortisol"]
    window = int(spec["window"])
    by_crew: dict[str, dict[str, list[float]]] = {}
    for row in vital_rows:
        if row.get("origin") not in {None, "simulated"}:
            continue
        if row["indicator"] not in {"sleep_hours", "cortisol_ug_dl"}:
            continue
        by_crew.setdefault(row["crew_id"], {}).setdefault(row["indicator"], []).append(float(row["value"]))
    found = []
    for crew_id, series in by_crew.items():
        sleep = series.get("sleep_hours", [])[-window:]
        cortisol = series.get("cortisol_ug_dl", [])[-window:]
        if len(sleep) < window or len(cortisol) < window:
            continue
        sleep_mean = sum(sleep) / len(sleep)
        cortisol_mean = sum(cortisol) / len(cortisol)
        if sleep_mean >= float(spec["sleep_mean_below"]):
            continue
        if cortisol_mean <= float(spec["cortisol_mean_above"]):
            continue
        found.append({
            "id": "sleep_and_cortisol",
            "kind": "preventive",
            "severity": "watch",
            "audience": "crew",
            "crew_id": crew_id,
            "origin": "simulated",
            "title": "Check in before this sleep and stress trend worsens",
            "detail": (
                f"{crew_id} simulated sleep averages {sleep_mean:.1f} h and simulated cortisol "
                f"averages {cortisol_mean:.1f} μg/dL over the last {window} points. "
                f"Those cutoffs are app settings, not NASA limits, and these series are not in "
                f"the public Inspiration4 tables. NASA HRP lists inadequate sleep and irregular "
                f"schedules, and behavioral changes under isolation, radiation, and distance from Earth, "
                f"as crew health risks. The hazards page says isolated crews have to be supported "
                f"to keep working as a team."
            ),
            "suggested_action": (
                "A crewmate should check in, protect the next sleep period, and offer support. "
                "This is not a diagnosis."
            ),
            "sources": source_refs(rules, spec["sources"]),
            "evidence": {
                "crew_id": crew_id,
                "sleep_mean": round(sleep_mean, 2),
                "cortisol_mean": round(cortisol_mean, 2),
            },
        })
    return found


def vital_emergencies(
    vital_rows: list[dict[str, Any]],
    rules: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Heart-rate and impact alerts. Public Inspiration4 tables do not include these series."""
    rules = rules or load_rules()
    hr_spec = rules["emergency"]["heart_rate"]
    impact_spec = rules["emergency"]["impact"]
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for row in vital_rows:
        key = (row["crew_id"], row["indicator"])
        current = latest.get(key)
        if current is None or row["recorded_at"] >= current["recorded_at"]:
            latest[key] = row
    found = []
    for (crew_id, indicator), row in latest.items():
        value = float(row["value"])
        if indicator == "heart_rate" and (value < float(hr_spec["low"]) or value > float(hr_spec["high"])):
            found.append({
                "id": "heart_rate",
                "kind": "emergency",
                "severity": hr_spec["severity"],
                "audience": "all",
                "crew_id": crew_id,
                "origin": row.get("origin") or "simulated",
                "title": f"Abnormal heart rate for {crew_id}",
                "detail": (
                    f"Latest heart rate is {value:g} bpm, outside the app window "
                    f"{hr_spec['low']:g}–{hr_spec['high']:g}. "
                    f"NASA HRP lists cardiovascular adaptations as a spaceflight risk. "
                    f"This cutoff is an app setting, not a published NASA limit, and this "
                    f"series is simulated unless an upload says otherwise."
                ),
                "suggested_action": (
                    "Pause noncritical work, recheck the rate, and contact the flight surgeon now. "
                    "This is not a diagnosis."
                ),
                "sources": source_refs(rules, hr_spec["sources"]),
                "evidence": {"crew_id": crew_id, "value": value, "unit": "bpm"},
            })
        if indicator == "impact_event" and value >= 1:
            found.append({
                "id": "impact",
                "kind": "emergency",
                "severity": impact_spec["severity"],
                "audience": "all",
                "crew_id": crew_id,
                "origin": row.get("origin") or "simulated",
                "title": f"Possible fall or impact for {crew_id}",
                "detail": (
                    "An impact flag is set. No public Inspiration4 fall series is in this data "
                    "package, so this alert only appears for a simulated or uploaded flag. "
                    "NASA HRP lists injury risk during landing and dynamic operations."
                ),
                "suggested_action": (
                    "A crewmate should go to them now and check for injury. Do not move them if "
                    "they report neck or back pain. Contact the flight surgeon."
                ),
                "sources": source_refs(rules, impact_spec["sources"]),
                "evidence": {"crew_id": crew_id, "value": value},
            })
    return found


def critical_glucose_alerts(
    lab_rows: list[dict[str, Any]],
    rules: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    rules = rules or load_rules()
    spec = rules["emergency"]["critical_glucose"]
    floor = float(spec["below"])
    found = []
    for row in lab_rows:
        if row.get("analyte") != "GLUCOSE" or row.get("value") is None:
            continue
        if row.get("flag") not in {"low", "high"}:
            continue
        value = float(row["value"])
        if value >= floor:
            continue
        found.append({
            "id": "critical_glucose",
            "kind": "emergency",
            "severity": spec["severity"],
            "audience": "all",
            "crew_id": row["crew_id"],
            "origin": "real",
            "title": f"Low glucose for {row['crew_id']} at {row['timepoint']}",
            "detail": (
                f"{row['crew_id']} glucose at {row['timepoint']} is {value:g} {row.get('unit') or 'mg/dL'}, "
                f"below both the file reference range and the app critical line of {floor:g}. "
                f"This is a historical Inspiration4 serum value from {row.get('source_study')}, "
                f"not a live finger-stick."
            ),
            "suggested_action": (
                "Treat this as a real out-of-range lab from the study, not a current sensor alarm. "
                "Tell the flight surgeon and do not change medication from this screen."
            ),
            "sources": source_refs(rules, spec["sources"]),
            "evidence": {
                "crew_id": row["crew_id"],
                "timepoint": row["timepoint"],
                "value": value,
                "unit": row.get("unit"),
            },
        })
    return found
