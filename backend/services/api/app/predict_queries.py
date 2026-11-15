"""Load Postgres rows and attach the existing recommendation tiers."""

from __future__ import annotations

from typing import Any

from app.access import project_finding
from app.plain import (
    family,
    lab_card,
    lab_tier,
    needs_lab_recommendation,
    radiation_card,
    radiation_public_card,
    vital_card,
)
from app.predict import lab_forecast, radiation_forecast, simulated_vital_flags
from app.rules_engine import load_rules, source_refs

CBC = {
    "HEMOGLOBIN", "HEMATOCRIT", "RED BLOOD CELL COUNT", "WHITE BLOOD CELL COUNT",
    "PLATELET COUNT", "ABSOLUTE NEUTROPHILS", "ABSOLUTE LYMPHOCYTES",
    "ABSOLUTE MONOCYTES", "ABSOLUTE EOSINOPHILS", "ABSOLUTE BASOPHILS",
}


def _panel_sources(rules: dict[str, Any], panel: str) -> list[dict[str, str]]:
    spec = rules["preventive"]["worsening_lab"]
    keys = spec["sources_by_panel"].get(panel, spec["sources_by_panel"]["CBC"])
    return source_refs(rules, keys)


def _lab_sources(rules: dict[str, Any], panel: str, analyte: str) -> list[dict[str, str]]:
    refs = _panel_sources(rules, panel)
    extra = ["hrp_hazards", "ochmo_tb_044"]
    kind = family(analyte)
    if kind in {"glucose", "white", "red"}:
        extra.append("csa_infographic")
    if kind in {"glucose", "kidney", "electrolyte", "liver"}:
        extra.append("osd_575")
    have = {item["id"] for item in refs}
    return refs + source_refs(rules, [key for key in extra if key not in have])


def lab_series(conn, crew: str | None, analyte: str | None) -> list[dict[str, Any]]:
    sql = """
        SELECT c.call_sign AS crew_id, l.analyte, l.panel, l.timepoint,
               l.days_from_launch AS day, l.value_numeric AS value, l.unit,
               l.ref_low, l.ref_high, l.flag
        FROM lab_results l
        JOIN crew_members c ON c.id = l.crew_member_id
        WHERE l.panel IN ('CBC', 'CMP') AND l.value_numeric IS NOT NULL
    """
    args: list[Any] = []
    if crew:
        sql += " AND c.call_sign = %s"
        args.append(crew.upper())
    if analyte:
        sql += " AND l.analyte = %s"
        args.append(analyte)
    sql += " ORDER BY c.call_sign, l.analyte, l.days_from_launch"
    return [dict(row) for row in conn.execute(sql, args).fetchall()]


def predict_labs(conn, crew: str | None = None, analyte: str | None = None) -> dict[str, Any]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    panels: dict[tuple[str, str], str] = {}
    for row in lab_series(conn, crew, analyte):
        key = (row["crew_id"], row["analyte"])
        grouped.setdefault(key, []).append(row)
        panels[key] = row["panel"]
    rules = load_rules()
    items = []
    for (crew_id, name), points in grouped.items():
        forecast = lab_forecast(points)
        if forecast is None:
            continue
        forecast["crew_id"] = crew_id
        forecast["analyte"] = name
        forecast["panel"] = panels[(crew_id, name)]
        forecast["origin"] = "real"
        forecast["plain"] = lab_card(
            forecast,
            analyte=name,
            sources=_lab_sources(rules, panels[(crew_id, name)], name),
        )
        items.append(forecast)
    return {
        "items": items,
        "assumption": (
            "Straight line on days from Inspiration4 launch. "
            "Day 30, 90, and 180 are marked inside the observed span when the series already reaches them. "
            "Only next_step is past the last draw."
        ),
    }


def lab_risks(conn, limit: int = 20) -> dict[str, Any]:
    items = predict_labs(conn)["items"]
    flagged = [item for item in items if item["flags"]]
    def rank(item: dict[str, Any]) -> tuple:
        worsening = 0 if "already_out_and_worsening" in item["flags"] else 1
        prob = item["forecasts"][0]["p_out_of_range"] or 0.0
        return (worsening, -prob)
    flagged.sort(key=rank)
    return {"risks": flagged[:limit], "count": len(flagged)}


def predict_radiation(conn) -> dict[str, Any]:
    rules = load_rules()
    floor = float(rules["emergency"]["radiation_with_sep"]["dose_rate_at_least"])
    rows = conn.execute(
        """
        SELECT to_char(date_trunc('hour', recorded_at), 'YYYY-MM-DD"T"HH24:00') AS hour,
               avg(absorbed_dose_rate) AS rate,
               max(absorbed_dose_rate) AS max_rate
        FROM radiation_readings
        GROUP BY date_trunc('hour', recorded_at)
        ORDER BY date_trunc('hour', recorded_at)
        """
    ).fetchall()
    hourly = [{"hour": row["hour"], "rate": float(row["rate"])} for row in rows]
    forecast = radiation_forecast(hourly, spike_at_least=floor)
    # The rule threshold applies to the raw ~2-minute samples, so the chart also
    # needs the hourly maximum. The hourly mean alone never reaches 400 uGy/h.
    forecast["history"]["max"] = [float(row["max_rate"]) for row in rows]
    raw_spikes = conn.execute(
        """
        SELECT recorded_at, instrument_id, absorbed_dose_rate
        FROM radiation_readings
        WHERE absorbed_dose_rate >= %s
        ORDER BY absorbed_dose_rate DESC
        LIMIT 20
        """,
        (floor,),
    ).fetchall()
    forecast["spikes_at_or_above_rule"] = [
        {
            "recorded_at": row["recorded_at"].isoformat(),
            "instrument_id": row["instrument_id"],
            "rate": float(row["absorbed_dose_rate"]),
        }
        for row in raw_spikes
    ]
    window = float(rules["emergency"]["radiation_with_sep"]["sep_after_hours_max"])
    peak = conn.execute(
        """
        SELECT recorded_at, instrument_id, absorbed_dose_rate
        FROM radiation_readings
        ORDER BY absorbed_dose_rate DESC
        LIMIT 1
        """
    ).fetchone()
    following = []
    if peak is not None:
        following = conn.execute(
            """
            SELECT sep_id, event_time, instruments
            FROM space_weather_events
            WHERE event_time >= %s AND event_time <= %s + (%s || ' hours')::interval
            ORDER BY event_time
            LIMIT 5
            """,
            (peak["recorded_at"], peak["recorded_at"], int(window)),
        ).fetchall()
    forecast["sep_after_peak"] = [
        {
            "sep_id": row["sep_id"],
            "event_time": row["event_time"].isoformat(),
            "instruments": row["instruments"],
        }
        for row in following
    ]
    forecast["peak"] = None if peak is None else {
        "recorded_at": peak["recorded_at"].isoformat(),
        "instrument_id": peak["instrument_id"],
        "absorbed_dose_rate": float(peak["absorbed_dose_rate"]),
        "unit": "μGy/h",
        "label": "Area dose rate, not a personal dose.",
    }
    sources = source_refs(rules, rules["emergency"]["radiation_with_sep"]["sources"])
    have = {item["id"] for item in sources}
    if "csa_infographic" not in have:
        sources = sources + source_refs(rules, ["csa_infographic"])
    forecast["sources"] = sources
    forecast["plain"] = radiation_card(forecast, sources)
    return forecast


def _vital_rows(conn, crew: str | None) -> list[dict[str, Any]]:
    sql = """
        SELECT c.call_sign AS crew_id, h.indicator, h.value_numeric AS value, h.recorded_at
        FROM health_readings h
        JOIN crew_members c ON c.id = h.crew_member_id
        WHERE h.origin = 'simulated'
    """
    args: list[Any] = []
    if crew:
        sql += " AND c.call_sign = %s"
        args.append(crew.upper())
    return [dict(row) for row in conn.execute(sql, args).fetchall()]


def predict_vitals(conn, crew: str | None = None) -> dict[str, Any]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for row in _vital_rows(conn, crew):
        grouped.setdefault((row["crew_id"], row["indicator"]), []).append(row)
    items = []
    for (crew_id, indicator), points in grouped.items():
        flag = simulated_vital_flags(points)
        if flag is None:
            continue
        flag["crew_id"] = crew_id
        flag["indicator"] = indicator
        flag["plain"] = vital_card(flag)
        items.append(flag)
    return {"items": items, "origin": "simulated"}


def _rec_from_lab(item: dict[str, Any], rules: dict[str, Any]) -> dict[str, Any] | None:
    if not needs_lab_recommendation(item):
        return None
    tier = lab_tier(item)
    card = lab_card(
        item,
        analyte=item["analyte"],
        sources=_lab_sources(rules, item["panel"], item["analyte"]),
        tier=tier,
    )
    worsening = "already_out_and_worsening" in item["flags"]
    return {
        "id": "predict_" + ("worsening_lab" if worsening else "lab_check"),
        "kind": "preventive",
        "tier": tier,
        "broadcast": False,
        "mission_impact": False,
        "indicator": item["analyte"],
        "crew_id": item["crew_id"],
        "origin": "real",
        "title": card["title"],
        "detail": card["what_it_means"],
        "suggested_action": card["what_to_do"],
        "what_it_means": card["what_it_means"],
        "why_it_matters_in_space": card["why_it_matters_in_space"],
        "what_to_do": card["what_to_do"],
        "who_is_notified": card["who_is_notified"],
        "confidence": card["confidence"],
        "confidence_reason": card["confidence_reason"],
        "sources": card["sources"],
        "technical": card["technical"],
        "evidence": {
            "crew_id": item["crew_id"],
            "analyte": item["analyte"],
            "last_value": item["last"]["value"],
            "next_yhat": item["forecasts"][0]["yhat"],
            "p_out_of_range": item["forecasts"][0]["p_out_of_range"],
            "flags": item["flags"],
        },
    }


def _rec_from_radiation(forecast: dict[str, Any], rules: dict[str, Any]) -> dict[str, Any] | None:
    spec = rules["emergency"]["radiation_with_sep"]
    if not forecast.get("spikes_at_or_above_rule") or not forecast.get("sep_after_peak"):
        return None
    card = forecast.get("plain") or radiation_card(forecast, forecast.get("sources") or [])
    return {
        "id": "predict_radiation_with_sep",
        "kind": "emergency",
        "tier": spec["tier"],
        "broadcast": True,
        "mission_impact": True,
        "indicator": None,
        "crew_id": None,
        "origin": "real",
        "public_title": spec["public_title"],
        "public_detail": spec["public_detail"],
        "public_card": radiation_public_card(),
        "title": card["title"],
        "detail": card["what_it_means"],
        "suggested_action": card["what_to_do"],
        "what_it_means": card["what_it_means"],
        "why_it_matters_in_space": card["why_it_matters_in_space"],
        "what_to_do": card["what_to_do"],
        "who_is_notified": card["who_is_notified"],
        "confidence": card["confidence"],
        "confidence_reason": card["confidence_reason"],
        "sources": card["sources"],
        "technical": card["technical"],
        "evidence": {
            "peak": forecast["peak"],
            "sep_id": forecast["sep_after_peak"][0]["sep_id"],
        },
    }


def recommendations(conn, crew: str | None, role: str, viewer: str | None) -> dict[str, Any]:
    rules = load_rules()
    labs = predict_labs(conn, crew, None)["items"]
    items: list[dict[str, Any]] = []
    for item in labs:
        rec = _rec_from_lab(item, rules)
        if rec:
            items.append(rec)
    if crew is None:
        rad = _rec_from_radiation(predict_radiation(conn), rules)
        if rad:
            items.append(rad)
    vitals = predict_vitals(conn, crew)["items"]
    hr_spec = rules["emergency"]["heart_rate"]
    sleep_spec = rules["preventive"]["sleep_and_cortisol"]
    by_crew: dict[str, dict[str, float]] = {}
    for vital in vitals:
        by_crew.setdefault(vital["crew_id"], {})[vital["indicator"]] = vital["last"]
        if vital["indicator"] == "heart_rate" and (
            vital["last"] < float(hr_spec["low"]) or vital["last"] > float(hr_spec["high"])
        ):
            card = vital["plain"]
            items.append({
                "id": "predict_heart_rate",
                "kind": "emergency",
                "tier": hr_spec["tier"],
                "broadcast": True,
                "mission_impact": True,
                "indicator": "heart_rate",
                "crew_id": vital["crew_id"],
                "origin": "simulated",
                "public_title": hr_spec["public_title"],
                "public_detail": hr_spec["public_detail"],
                "public_card": {
                    "what_it_means": "A crewmate needs help at the module. No diagnosis is included.",
                    "why_it_matters_in_space": "NASA lists distance from Earth as a hazard because medical care is harder to reach.",
                    "what_to_do": "Follow procedures.",
                    "who_is_notified": "The whole crew gets this short notice. It does not name a person or a diagnosis.",
                    "confidence": "low",
                    "confidence_reason": "This heart-rate series is simulated. The crew notice does not include the number.",
                },
                "title": "A simulated heart rate is outside the app's safety window",
                "detail": card["what_it_means"],
                "suggested_action": "Follow procedures. No diagnosis is included in the crew notice.",
                "what_it_means": (
                    f"This heart rate is simulated, not a NASA measurement. The latest point is outside the app window "
                    f"of {hr_spec['low']}–{hr_spec['high']} beats per minute. That window is an app setting, not a NASA limit."
                ),
                "why_it_matters_in_space": card["why_it_matters_in_space"],
                "what_to_do": "Follow procedures, then let the CMO check the person. The crew notice does not include a diagnosis.",
                "who_is_notified": "The whole crew gets a short notice that someone needs help. The number stays with the CMO and the flight surgeon.",
                "confidence": "low",
                "confidence_reason": card["confidence_reason"],
                "sources": source_refs_safe(rules, hr_spec["sources"]),
                "technical": card["technical"],
                "evidence": {"value": vital["last"], "origin": "simulated"},
            })
    for crew_id, values in by_crew.items():
        if "sleep_hours" in values and "cortisol_ug_dl" in values:
            if values["sleep_hours"] < float(sleep_spec["sleep_mean_below"]) and values["cortisol_ug_dl"] > float(sleep_spec["cortisol_mean_above"]):
                items.append({
                    "id": "predict_sleep_and_cortisol",
                    "kind": "preventive",
                    "tier": sleep_spec["tier"],
                    "broadcast": False,
                    "mission_impact": False,
                    "indicator": "cortisol_ug_dl",
                    "crew_id": crew_id,
                    "origin": "simulated",
                    "title": "Your simulated sleep has been short",
                    "detail": (
                        "This sleep and stress-hormone pair is simulated, not a NASA measurement. "
                        "It is a private note for the flight surgeon, not a diagnosis."
                    ),
                    "suggested_action": "Discuss only with the flight surgeon. Do not announce it to the crew.",
                    "what_it_means": (
                        "This sleep and stress-hormone pair is simulated, not a NASA measurement. "
                        "It is a private note for the flight surgeon, not a diagnosis."
                    ),
                    "why_it_matters_in_space": (
                        "NASA lists sleep and behavioral health among the risks of spaceflight. "
                        "Isolation and a closed cabin can make sleep harder. This demo series is not a diagnosis."
                    ),
                    "what_to_do": "Protect the sleep plan and talk with the flight surgeon in private. Do not announce this to the crew.",
                    "who_is_notified": "The flight surgeon sees this in private. The crew medical officer does not. It is not announced to the crew.",
                    "confidence": "low",
                    "confidence_reason": "These points are simulated, and the cutoffs are app settings in rules.yaml, not NASA limits.",
                    "sources": source_refs_safe(rules, sleep_spec["sources"]),
                    "technical": {
                        "sleep_hours": values["sleep_hours"],
                        "cortisol_ug_dl": values["cortisol_ug_dl"],
                        "unit": "hours and µg/dL",
                        "reference_range": {
                            "sleep_mean_below": sleep_spec["sleep_mean_below"],
                            "cortisol_mean_above": sleep_spec["cortisol_mean_above"],
                            "note": "App settings, not NASA limits.",
                        },
                        "trend": "Latest simulated points are past the app settings.",
                        "origin": "simulated",
                    },
                    "evidence": {"origin": "simulated", **values},
                })
    visible = []
    for item in items:
        shown = project_finding(item, role=role, viewer=viewer, shares={})
        if shown:
            visible.append(shown)
    return {
        "role": role,
        "viewer": viewer,
        "crew": crew,
        "recommendations": visible,
        "broadcasts": [item for item in visible if item.get("broadcast")],
    }


def source_refs_safe(rules: dict[str, Any], keys: list[str]) -> list[dict[str, str]]:
    from app.rules_engine import source_refs
    return source_refs(rules, keys)
