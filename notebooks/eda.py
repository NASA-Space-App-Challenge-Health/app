"""EDA from Postgres, the same queries the /eda API uses.

    DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app python3 notebooks/eda.py

Writes Plotly PNGs to docs/eda/. This is four Inspiration4 civilians on a
3-day flight, one ISS DosTel week, and 2024 SEP events. It is not a
long-duration station medical record.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend" / "services" / "api"))

import plotly.graph_objects as go  # noqa: E402

from app import db, eda_queries  # noqa: E402
from app.rules_engine import load_rules, worsening_lab_recommendations  # noqa: E402

OUT = ROOT / "docs" / "eda"


def _labs_for_rules(conn):
    rows = conn.execute(
        """
        SELECT c.call_sign AS crew_id, l.timepoint, l.days_from_launch, l.panel, l.analyte,
               l.value_numeric AS value, l.unit, l.ref_low, l.ref_high, l.flag, l.source_study
        FROM lab_results l
        JOIN crew_members c ON c.id = l.crew_member_id
        WHERE l.panel IN ('CBC', 'CMP')
        """
    ).fetchall()
    return [dict(row) for row in rows]


def _save(fig, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fig.update_layout(template="plotly_white", margin=dict(l=60, r=20, t=50, b=80))
    fig.write_image(OUT / name, width=960, height=560, scale=2)


def main() -> None:
    with db.connect() as conn:
        overview = eda_queries.overview(conn)
        oor = eda_queries.out_of_range(conn)
        trends = eda_queries.trends(conn, "GLUCOSE")
        shift = eda_queries.shift(conn)
        radiation = eda_queries.radiation_series(conn)
        extremes = eda_queries.extremes(conn, 8)
        preventable = worsening_lab_recommendations(_labs_for_rules(conn), load_rules())

    print("OVERVIEW")
    for key in (
        "crew_count", "analytes", "lab_rows", "timepoints", "radiation_days",
        "sep_events", "out_of_range_rows", "rows_with_reference", "pct_out_of_range",
        "flagged_analytes", "reference_range_rows", "dataset_catalog_rows",
    ):
        print(f"  {key}: {overview[key]}")
    print(f"Worsening out-of-range CBC/CMP pairs: {len(preventable)}")

    fig = go.Figure()
    fig.add_bar(name="low", x=oor["analyte"], y=oor["low"])
    fig.add_bar(name="high", x=oor["analyte"], y=oor["high"])
    fig.update_layout(barmode="stack", title="CBC/CMP results outside the row reference range")
    _save(fig, "out_of_range.png")

    fig = go.Figure()
    for trace in trends["traces"]:
        fig.add_scatter(name=trace["name"], x=trace["x"], y=trace["y"], mode="lines+markers")
    if trends["traces"]:
        lows = [value for value in trends["traces"][0]["ref_low"] if value is not None]
        highs = [value for value in trends["traces"][0]["ref_high"] if value is not None]
        if lows and highs:
            fig.add_hrect(y0=min(lows), y1=max(highs), fillcolor="rgba(0,100,80,0.08)", line_width=0)
    fig.update_layout(title=f"{trends['analyte']} ({trends.get('unit', '')}), released OSD-575 rows")
    _save(fig, "glucose_trends.png")

    fig = go.Figure(go.Bar(x=shift["analyte"], y=shift["mean_percent"]))
    fig.update_layout(title="Mean percent change, L-3 to R+1 (biggest movers)")
    _save(fig, "pre_post_shift.png")

    fig = go.Figure()
    for trace in radiation["series"]:
        fig.add_scatter(name=trace["name"], x=trace["x"], y=trace["y"], mode="lines")
    fig.update_layout(title="ISS DosTel hourly mean absorbed dose rate, 1–7 Jun 2024 (μGy/h)")
    _save(fig, "radiation_series.png")

    fig = go.Figure(go.Bar(x=radiation["sep_by_month"]["x"], y=radiation["sep_by_month"]["y"]))
    fig.update_layout(title="DONKI SEP rows by month, calendar 2024")
    _save(fig, "sep_by_month.png")

    print("Wrote PNGs to", OUT)


if __name__ == "__main__":
    main()
