"""SQL aggregates for the EDA charts. Every number comes from Postgres."""

from __future__ import annotations

from typing import Any

TIMEPOINTS = ("L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194")

SYSTEM_SQL = """
CASE
    WHEN panel = 'cytokine' THEN 'inflammation/cytokines'
    WHEN analyte IN ('GLUCOSE') THEN 'cardiovascular/metabolic'
    WHEN analyte IN (
        'SODIUM', 'POTASSIUM', 'CHLORIDE', 'CARBON DIOXIDE', 'CALCIUM',
        'CREATININE', 'UREA NITROGEN (BUN)', 'BUN/CREATININE RATIO',
        'eGFR AFRICAN AMERICAN', 'eGFR NON-AFR. AMERICAN'
    ) THEN 'kidney/electrolytes'
    WHEN analyte IN (
        'ALT', 'AST', 'ALKALINE PHOSPHATASE', 'BILIRUBIN; TOTAL',
        'ALBUMIN', 'ALBUMIN/GLOBULIN RATIO', 'GLOBULIN', 'PROTEIN; TOTAL'
    ) THEN 'liver'
    WHEN panel = 'CBC' THEN 'blood/immune'
    ELSE 'other'
END
"""


def overview(conn) -> dict[str, Any]:
    row = conn.execute(
        f"""
        SELECT
            (SELECT count(*) FROM crew_members WHERE call_sign LIKE 'C00%') AS crew_count,
            (SELECT count(DISTINCT analyte) FROM lab_results) AS analytes,
            (SELECT count(*) FROM lab_results) AS lab_rows,
            (SELECT count(DISTINCT timepoint) FROM lab_results) AS timepoints,
            (SELECT count(DISTINCT recorded_at::date) FROM radiation_readings) AS radiation_days,
            (SELECT count(*) FROM space_weather_events) AS sep_events,
            (SELECT count(*) FROM lab_results WHERE flag IN ('low', 'high')) AS out_of_range_rows,
            (SELECT count(*) FROM lab_results WHERE flag IN ('low', 'normal', 'high')) AS rows_with_reference,
            (SELECT count(DISTINCT analyte) FROM lab_results WHERE flag IN ('low', 'high')) AS flagged_analytes,
            (SELECT count(*) FROM reference_ranges) AS reference_range_rows,
            (SELECT count(*) FROM dataset_catalog) AS dataset_catalog_rows
        """
    ).fetchone()
    referenced = row["rows_with_reference"] or 0
    pct = (100.0 * row["out_of_range_rows"] / referenced) if referenced else 0.0
    return {
        "crew_count": row["crew_count"],
        "analytes": row["analytes"],
        "lab_rows": row["lab_rows"],
        "timepoints": row["timepoints"],
        "timepoint_labels": list(TIMEPOINTS),
        "radiation_days": row["radiation_days"],
        "sep_events": row["sep_events"],
        "out_of_range_rows": row["out_of_range_rows"],
        "rows_with_reference": referenced,
        "pct_out_of_range": round(pct, 2),
        "flagged_analytes": row["flagged_analytes"],
        "reference_range_rows": row["reference_range_rows"],
        "dataset_catalog_rows": row["dataset_catalog_rows"],
        "scope": (
            "Four Inspiration4 civilians, pre/post labs from a 3-day flight, "
            "one ISS DosTel week in June 2024, and DONKI SEP events for calendar 2024. "
            "Not a long-duration ISS crew dataset."
        ),
    }


def out_of_range(conn, limit: int = 12) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT analyte,
               count(*) FILTER (WHERE flag = 'low') AS low,
               count(*) FILTER (WHERE flag = 'high') AS high
        FROM lab_results
        WHERE flag IN ('low', 'high') AND panel IN ('CBC', 'CMP')
        GROUP BY analyte
        ORDER BY count(*) DESC, analyte
        LIMIT %s
        """,
        (limit,),
    ).fetchall()
    return {
        "analyte": [row["analyte"] for row in rows],
        "low": [row["low"] for row in rows],
        "high": [row["high"] for row in rows],
        "note": "Counts of CBC/CMP rows whose own reference range flagged low or high. Cytokine assays have no clinical range in this extract.",
    }


def analytes(conn) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT analyte, panel, count(*) AS n
        FROM lab_results
        WHERE panel IN ('CBC', 'CMP') AND value_numeric IS NOT NULL
        GROUP BY analyte, panel
        ORDER BY panel, analyte
        """
    ).fetchall()
    return {"analytes": [{"analyte": row["analyte"], "panel": row["panel"], "rows": row["n"]} for row in rows]}


def trends(conn, analyte: str) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT c.call_sign, l.timepoint, l.days_from_launch, l.value_numeric, l.unit,
               l.ref_low, l.ref_high, l.flag
        FROM lab_results l
        JOIN crew_members c ON c.id = l.crew_member_id
        WHERE l.analyte = %s AND l.value_numeric IS NOT NULL
        ORDER BY c.call_sign, l.days_from_launch
        """,
        (analyte,),
    ).fetchall()
    if not rows:
        return {"analyte": analyte, "traces": [], "timepoints": list(TIMEPOINTS)}
    traces: dict[str, dict[str, Any]] = {}
    for row in rows:
        trace = traces.setdefault(row["call_sign"], {"name": row["call_sign"], "x": [], "y": [], "ref_low": [], "ref_high": []})
        trace["x"].append(row["timepoint"])
        trace["y"].append(row["value_numeric"])
        trace["ref_low"].append(row["ref_low"])
        trace["ref_high"].append(row["ref_high"])
    return {
        "analyte": analyte,
        "unit": rows[0]["unit"],
        "timepoints": list(TIMEPOINTS),
        "traces": list(traces.values()),
        "reference_note": "ref_low and ref_high are the range stored on each NASA row, not an app threshold.",
    }


def shift(conn, limit: int = 12) -> dict[str, Any]:
    rows = conn.execute(
        """
        WITH paired AS (
            SELECT analyte, unit,
                   avg(CASE WHEN timepoint = 'R+1' THEN value_numeric END)
                   - avg(CASE WHEN timepoint = 'L-3' THEN value_numeric END) AS mean_delta,
                   avg(CASE WHEN timepoint = 'L-3' THEN value_numeric END) AS pre_mean,
                   count(*) FILTER (WHERE timepoint IN ('L-3', 'R+1') AND value_numeric IS NOT NULL) AS n
            FROM lab_results
            WHERE panel IN ('CBC', 'CMP') AND timepoint IN ('L-3', 'R+1')
            GROUP BY analyte, unit
        )
        SELECT analyte, unit, mean_delta, pre_mean, n,
               CASE WHEN pre_mean IS NULL OR pre_mean = 0 THEN NULL
                    ELSE 100.0 * mean_delta / pre_mean END AS mean_percent
        FROM paired
        WHERE mean_delta IS NOT NULL
        ORDER BY abs(100.0 * mean_delta / NULLIF(pre_mean, 0)) DESC NULLS LAST
        LIMIT %s
        """,
        (limit,),
    ).fetchall()
    return {
        "analyte": [row["analyte"] for row in rows],
        "unit": [row["unit"] for row in rows],
        "mean_delta": [None if row["mean_delta"] is None else round(row["mean_delta"], 3) for row in rows],
        "mean_percent": [None if row["mean_percent"] is None else round(row["mean_percent"], 2) for row in rows],
        "note": "Crew-mean R+1 minus crew-mean L-3. Ranked by absolute percent change. There is no in-flight sample in this extract; R+1 is the first post-flight draw.",
    }


def sunburst(conn) -> dict[str, Any]:
    rows = conn.execute(
        f"""
        SELECT {SYSTEM_SQL} AS system, panel, analyte, count(*) AS n
        FROM lab_results
        WHERE flag IN ('low', 'high')
        GROUP BY 1, 2, 3
        ORDER BY 1, 2, 3
        """
    ).fetchall()
    labels = ["Out of range"]
    parents = [""]
    values = [0]
    systems: dict[str, int] = {}
    panels: dict[tuple[str, str], int] = {}
    total = 0
    for row in rows:
        system, panel, analyte, count = row["system"], row["panel"], row["analyte"], row["n"]
        total += count
        systems[system] = systems.get(system, 0) + count
        panels[(system, panel)] = panels.get((system, panel), 0) + count
        labels.append(analyte)
        parents.append(f"{system} / {panel}")
        values.append(count)
    for (system, panel), count in panels.items():
        labels.append(f"{system} / {panel}")
        parents.append(system)
        values.append(count)
    for system, count in systems.items():
        labels.append(system)
        parents.append("Out of range")
        values.append(count)
    values[0] = total
    return {
        "labels": labels,
        "parents": parents,
        "values": values,
        "note": "Value is the count of low or high flags. Cytokines have no reference flags in this file, so they do not appear.",
    }


def flow(conn) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT
            CASE
                WHEN days_from_launch < 0 THEN 'pre-flight'
                WHEN timepoint = 'R+1' THEN 'just after flight'
                ELSE 'recovery'
            END AS phase,
            c.call_sign,
            COALESCE(l.flag, 'unflagged') AS status,
            count(*) AS n
        FROM lab_results l
        JOIN crew_members c ON c.id = l.crew_member_id
        WHERE l.panel IN ('CBC', 'CMP') AND l.flag IN ('low', 'normal', 'high')
        GROUP BY 1, 2, 3
        """
    ).fetchall()
    phase_labels = ["pre-flight", "just after flight", "recovery", "low", "normal", "high"]
    phase_index = {label: index for index, label in enumerate(phase_labels)}
    phase_source, phase_target, phase_value = [], [], []
    crew_labels = phase_labels[3:]
    crew_ids = []
    crew_source, crew_target, crew_value = [], [], []
    for row in rows:
        phase_source.append(phase_index[row["phase"]])
        phase_target.append(phase_index[row["status"]])
        phase_value.append(row["n"])
        if row["call_sign"] not in crew_ids:
            crew_ids.append(row["call_sign"])
        crew_source.append(crew_ids.index(row["call_sign"]))
        crew_target.append(["low", "normal", "high"].index(row["status"]))
        crew_value.append(row["n"])
    return {
        "phase_to_status": {
            "label": phase_labels,
            "source": phase_source,
            "target": phase_target,
            "value": phase_value,
        },
        "crew_to_status": {
            "label": crew_ids + ["low", "normal", "high"],
            "source": crew_source,
            "target": [len(crew_ids) + index for index in crew_target],
            "value": crew_value,
        },
        "note": "CBC/CMP rows with a reference flag. There is no in-flight draw; 'just after flight' is R+1.",
    }


def radiation_series(conn) -> dict[str, Any]:
    hourly = conn.execute(
        """
        SELECT instrument_id,
               to_char(date_trunc('hour', recorded_at), 'YYYY-MM-DD"T"HH24:00') AS hour,
               round(avg(absorbed_dose_rate)::numeric, 3) AS mean_rate
        FROM radiation_readings
        GROUP BY instrument_id, date_trunc('hour', recorded_at)
        ORDER BY date_trunc('hour', recorded_at), instrument_id
        """
    ).fetchall()
    daily = conn.execute(
        """
        SELECT recorded_at::date AS day,
               round(avg(absorbed_dose_rate)::numeric, 3) AS mean_rate,
               round(max(absorbed_dose_rate)::numeric, 3) AS max_rate,
               count(*) AS samples
        FROM radiation_readings
        GROUP BY recorded_at::date
        ORDER BY recorded_at::date
        """
    ).fetchall()
    months = conn.execute(
        """
        SELECT to_char(event_time, 'YYYY-MM') AS month, count(*) AS n
        FROM space_weather_events
        GROUP BY 1
        ORDER BY 1
        """
    ).fetchall()
    traces: dict[str, dict[str, list]] = {}
    for row in hourly:
        trace = traces.setdefault(row["instrument_id"], {"name": row["instrument_id"], "x": [], "y": []})
        trace["x"].append(row["hour"])
        trace["y"].append(float(row["mean_rate"]))
    return {
        "series": list(traces.values()),
        "series_note": "Hourly mean absorbed dose rate in μGy/h from the June 2024 DosTel extract. Not a personal dose.",
        "daily": {
            "x": [row["day"].isoformat() for row in daily],
            "mean_ugy_h": [float(row["mean_rate"]) for row in daily],
            "max_ugy_h": [float(row["max_rate"]) for row in daily],
            "samples": [row["samples"] for row in daily],
        },
        "sep_by_month": {
            "x": [row["month"] for row in months],
            "y": [row["n"] for row in months],
        },
    }


def extremes(conn, limit: int = 15) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT c.call_sign, l.analyte, l.timepoint, l.value_numeric, l.unit,
               l.ref_low, l.ref_high, l.flag, l.panel,
               ((l.value_numeric - ((l.ref_low + l.ref_high) / 2.0))
                 / NULLIF((l.ref_high - l.ref_low) / 4.0, 0)) AS z_score
        FROM lab_results l
        JOIN crew_members c ON c.id = l.crew_member_id
        WHERE l.value_numeric IS NOT NULL
          AND l.ref_low IS NOT NULL
          AND l.ref_high IS NOT NULL
          AND l.ref_high > l.ref_low
          AND l.panel IN ('CBC', 'CMP')
        ORDER BY abs(
            (l.value_numeric - ((l.ref_low + l.ref_high) / 2.0))
            / NULLIF((l.ref_high - l.ref_low) / 4.0, 0)
        ) DESC
        LIMIT %s
        """,
        (limit,),
    ).fetchall()
    return {
        "rows": [
            {
                "crew_id": row["call_sign"],
                "analyte": row["analyte"],
                "timepoint": row["timepoint"],
                "panel": row["panel"],
                "value": row["value_numeric"],
                "unit": row["unit"],
                "ref_low": row["ref_low"],
                "ref_high": row["ref_high"],
                "flag": row["flag"],
                "z_score": None if row["z_score"] is None else round(float(row["z_score"]), 2),
            }
            for row in rows
        ],
        "note": "z uses the reference span as if low-to-high were about four standard deviations. It is a ranking aid, not a clinical z-score.",
    }
