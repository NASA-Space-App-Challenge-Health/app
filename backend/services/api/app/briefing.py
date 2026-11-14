"""Dashboard, demo script, and insights assembled from Postgres."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import psycopg

from app.guidance import DISCLAIMER, INDICATORS, get_indicator, guidance_for, worst_band
from app.insights import extremes, flag_counts
from app.nasa_loader import KEY_ANALYTES
from app.rules_engine import (
    critical_glucose_alerts,
    load_rules,
    radiation_emergency,
    sleep_cortisol_recommendations,
    vital_emergencies,
    worsening_lab_recommendations,
)
from app.schedule import plan_hygiene
from app.seed import GROUP_KIND, GROUP_NAME

SIMULATED_INDICATORS = (
    "heart_rate",
    "spo2",
    "temperature_c",
    "sleep_hours",
    "cortisol_ug_dl",
    "hydration_liters",
    "hygiene_hour",
)


def assemble(conn: psycopg.Connection, viewer: str | None) -> dict[str, Any]:
    rules = load_rules()
    crew_rows = conn.execute(
        """
        SELECT c.id, c.call_sign, c.full_name, c.role, c.mission, c.share_mode, g.name AS group_name, g.kind AS group_kind
        FROM crew_members c
        LEFT JOIN crew_groups g ON g.id = c.group_id
        ORDER BY c.call_sign
        """
    ).fetchall()
    if not crew_rows:
        return _empty()
    viewer_row = _resolve_viewer(crew_rows, viewer)
    ids = [row["id"] for row in crew_rows]
    vitals = conn.execute(
        """
        SELECT crew_member_id, indicator, value_numeric, unit, recorded_at, source, risk_band, origin
        FROM health_readings
        WHERE crew_member_id = ANY(%s)
        ORDER BY recorded_at
        """,
        (ids,),
    ).fetchall()
    labs = conn.execute(
        """
        SELECT c.call_sign AS crew_id, l.timepoint, l.days_from_launch, l.panel, l.analyte,
               l.value_numeric AS value, l.unit, l.ref_low, l.ref_high, l.flag, l.source_study
        FROM lab_results l
        JOIN crew_members c ON c.id = l.crew_member_id
        WHERE l.panel IN ('CBC', 'CMP')
        """
    ).fetchall()
    peak = conn.execute(
        """
        SELECT recorded_at, instrument_id, absorbed_dose_rate
        FROM radiation_readings
        ORDER BY absorbed_dose_rate DESC
        LIMIT 1
        """
    ).fetchone()
    events = []
    if peak is not None:
        events = conn.execute(
            """
            SELECT sep_id, event_time, instruments, link, linked_events
            FROM space_weather_events
            WHERE event_time >= %s
              AND event_time <= %s + interval '96 hours'
            ORDER BY event_time
            """,
            (peak["recorded_at"], peak["recorded_at"]),
        ).fetchall()
    dose_rows = [] if peak is None else [{
        "recorded_at": peak["recorded_at"],
        "instrument_id": peak["instrument_id"],
        "absorbed_dose_rate": peak["absorbed_dose_rate"],
    }]
    vital_inputs = [
        {
            "crew_id": _sign(crew_rows, row["crew_member_id"]),
            "indicator": row["indicator"],
            "value": row["value_numeric"],
            "recorded_at": row["recorded_at"],
            "origin": row["origin"],
        }
        for row in vitals
    ]
    alerts = []
    radiation = radiation_emergency(dose_rows, [dict(row) for row in events], rules)
    if radiation:
        alerts.append(radiation)
    alerts.extend(critical_glucose_alerts(labs, rules))
    alerts.extend(vital_emergencies(vital_inputs, rules))
    recommendations = worsening_lab_recommendations(labs, rules)
    recommendations.extend(sleep_cortisol_recommendations(vital_inputs, rules))
    by_sign = {row["call_sign"]: row for row in crew_rows}
    alerts = [_redact(item, viewer_row, by_sign) for item in alerts]
    recommendations = [_redact(item, viewer_row, by_sign) for item in recommendations]
    crew = [_crew_card(row, vitals, labs, viewer_row) for row in crew_rows]
    hygiene_members = []
    for row in crew_rows:
        latest = _latest_vital(vitals, row["id"])
        hygiene_members.append({
            "crew_id": row["call_sign"],
            "hygiene_hour": latest.get("hygiene_hour", {}).get("value"),
            "hydration_liters": latest.get("hydration_liters", {}).get("value"),
            "share_mode": row["share_mode"],
        })
    hygiene = plan_hygiene(hygiene_members)
    hygiene = _redact_hygiene(hygiene, hygiene_members, viewer_row)
    featured = next((item for item in recommendations if _is_featured(item, rules)), None)
    return {
        "data_source": "mixed",
        "disclaimer": DISCLAIMER,
        "group": {"name": crew_rows[0]["group_name"] or GROUP_NAME, "kind": crew_rows[0]["group_kind"] or GROUP_KIND},
        "viewer": None if viewer_row is None else viewer_row["call_sign"],
        "crew": crew,
        "alerts": alerts,
        "recommendations": recommendations,
        "hygiene": hygiene,
        "demo": _demo(radiation, featured, hygiene, recommendations),
        "insights": {
            "common_issues": flag_counts(labs)[:8],
            "preventable": [item for item in recommendations if item["id"] == "worsening_lab" and item["origin"] == "real"],
            "extremes": extremes(labs, dose_rows),
            "space_weather_events_in_file": conn.execute("SELECT count(*) AS n FROM space_weather_events").fetchone()["n"],
        },
    }


def _demo(radiation, featured, hygiene, recommendations) -> dict[str, Any]:
    sleep = next((item for item in recommendations if item["id"] == "sleep_and_cortisol"), None)
    steps = [
        {
            "id": "legend",
            "kicker": "Step 1",
            "title": "Two kinds of data on one board",
            "body": (
                "Badges say REAL NASA or SIMULATED. Inspiration4 labs, the ISS DosTel week, "
                "and 2024 DONKI SEP events are real. Heart rate, sleep, cortisol, hydration, "
                "and hygiene timing are simulated because those series are not in the public tables."
            ),
        },
        {
            "id": "emergency",
            "kicker": "Step 2",
            "title": "Emergency alert, broadcast to the whole crew",
            "body": (
                "This alert pairs the peak DosTel absorbed dose rate in the June 2024 file "
                "with the next DONKI SEP inside 96 hours. The timestamps are different on purpose. "
                "Every crew member sees it, including anyone sharing alerts only."
            ),
            "alert": radiation,
        },
        {
            "id": "preventive",
            "kicker": "Step 3",
            "title": "Preventive recommendation from a real lab shift",
            "body": (
                "C003 potassium was already below the OSD-575 reference range at L-3, "
                "and the next sample at R+1 was lower still. The rule fires on the earlier sample, "
                "before that drop. The reference range is the one stored with the NASA row."
            ),
            "recommendation": featured,
        },
        {
            "id": "simulated",
            "kicker": "Step 4",
            "title": "What is still simulated",
            "body": (
                "Sleep, cortisol, and the hygiene-station estimate are simulated and labeled. "
                "A second preventive card can fire from the simulated sleep and cortisol trend. "
                "It is not the real-data recommendation in the previous step."
            ),
            "hygiene": hygiene,
            "recommendation": sleep,
        },
    ]
    return {"steps": steps}


def _is_featured(item: dict[str, Any], rules: dict[str, Any]) -> bool:
    if item["id"] != "worsening_lab" or item.get("evidence", {}).get("hidden"):
        return False
    highlight = rules["preventive"]["worsening_lab"]["highlight"]
    evidence = item["evidence"]
    return (
        evidence.get("crew_id") == highlight["crew_id"]
        and evidence.get("analyte") == highlight["analyte"]
        and evidence.get("earlier_timepoint") == highlight["earlier_timepoint"]
        and evidence.get("later_timepoint") == highlight["later_timepoint"]
    )


def _crew_card(row, vitals, labs, viewer) -> dict[str, Any]:
    hidden = row["share_mode"] == "alerts_only" and (viewer is None or viewer["id"] != row["id"])
    latest = _latest_vital(vitals, row["id"])
    readings = []
    for key in SIMULATED_INDICATORS:
        spec = get_indicator(key)
        current = latest.get(key)
        if spec is None:
            continue
        if current is None:
            readings.append({
                "indicator": key,
                "label": spec.label,
                "group": spec.group,
                "value": None,
                "unit": spec.unit,
                "decimals": spec.decimals,
                "origin": "simulated",
                "risk_band": None,
                "explanation": spec.explanation,
                "guidance": None,
            })
            continue
        readings.append({
            "indicator": key,
            "label": spec.label,
            "group": spec.group,
            "value": current["value"],
            "unit": current["unit"],
            "decimals": spec.decimals,
            "recorded_at": current["recorded_at"],
            "origin": current["origin"],
            "source": current["source"],
            "risk_band": current["risk_band"],
            "explanation": spec.explanation,
            "guidance": guidance_for(key, current["risk_band"]) if current["risk_band"] in spec.guidance else None,
        })
    lab_cards = _latest_labs(labs, row["call_sign"])
    bands = [item["risk_band"] for item in readings if item.get("risk_band")]
    bands.extend("concern" if item["flag"] in {"low", "high"} else "nominal" for item in lab_cards)
    return {
        "id": row["id"],
        "call_sign": row["call_sign"],
        "full_name": row["full_name"],
        "role": row["role"],
        "mission": row["mission"],
        "share_mode": row["share_mode"],
        "visible": "alerts_only" if hidden else "full",
        "overall_band": worst_band(bands),
        "readings": None if hidden else readings,
        "labs": None if hidden else lab_cards,
    }


def _latest_labs(labs, call_sign: str) -> list[dict[str, Any]]:
    chosen: dict[str, Any] = {}
    for row in labs:
        if row["crew_id"] != call_sign or row["analyte"] not in KEY_ANALYTES or row["value"] is None:
            continue
        current = chosen.get(row["analyte"])
        if current is None or row["days_from_launch"] > current["days_from_launch"]:
            chosen[row["analyte"]] = row
    cards = []
    for analyte in KEY_ANALYTES:
        row = chosen.get(analyte)
        if row is None:
            continue
        cards.append({
            "analyte": analyte,
            "value": row["value"],
            "unit": row["unit"],
            "flag": row["flag"],
            "timepoint": row["timepoint"],
            "ref_low": row["ref_low"],
            "ref_high": row["ref_high"],
            "source_study": row["source_study"],
            "origin": "real",
        })
    return cards


def _latest_vital(vitals, crew_id: UUID) -> dict[str, dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}
    for row in vitals:
        if row["crew_member_id"] != crew_id:
            continue
        current = latest.get(row["indicator"])
        if current is None or row["recorded_at"] >= current["recorded_at"]:
            latest[row["indicator"]] = {
                "value": row["value_numeric"],
                "unit": row["unit"],
                "recorded_at": row["recorded_at"],
                "source": row["source"],
                "origin": row["origin"],
                "risk_band": row["risk_band"],
            }
    return latest


def _redact(item: dict[str, Any], viewer, by_sign: dict[str, Any]) -> dict[str, Any]:
    crew_id = item.get("crew_id")
    if not crew_id or item.get("audience") == "all":
        return item
    member = by_sign.get(crew_id)
    if member is None or member["share_mode"] != "alerts_only":
        return item
    if viewer is not None and viewer["call_sign"] == crew_id:
        return item
    hidden = dict(item)
    hidden["detail"] = (
        f"{crew_id} is sharing alerts only. A {item['kind']} notice exists for the crew. "
        "Values stay hidden in this view."
    )
    hidden["evidence"] = {"hidden": True, "crew_id": crew_id}
    return hidden


def _redact_hygiene(plan: dict[str, Any], members: list[dict[str, Any]], viewer) -> dict[str, Any]:
    plan = dict(plan)
    plan["private"] = [
        item["crew_id"] for item in members
        if item["share_mode"] == "alerts_only" and (viewer is None or viewer["call_sign"] != item["crew_id"])
    ]
    return plan


def _resolve_viewer(crew_rows, viewer: str | None):
    if not viewer:
        return crew_rows[0]
    token = viewer.strip().upper()
    for row in crew_rows:
        if row["call_sign"].upper() == token or str(row["id"]) == viewer:
            return row
    return crew_rows[0]


def _sign(crew_rows, crew_id: UUID) -> str:
    for row in crew_rows:
        if row["id"] == crew_id:
            return row["call_sign"]
    return str(crew_id)


def _empty() -> dict[str, Any]:
    return {
        "data_source": "mixed",
        "disclaimer": DISCLAIMER,
        "group": {"name": GROUP_NAME, "kind": GROUP_KIND},
        "viewer": None,
        "crew": [],
        "alerts": [],
        "recommendations": [],
        "hygiene": plan_hygiene([]),
        "demo": {"steps": []},
        "insights": {"common_issues": [], "preventable": [], "extremes": {}, "space_weather_events_in_file": 0},
    }


# INDICATORS is imported so a missing catalog key fails at import if SIMULATED list drifts.
_ = INDICATORS
