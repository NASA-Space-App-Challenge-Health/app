"""Forecast plots from the same Postgres queries as /predict.

    DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app python3 notebooks/predictive.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend" / "services" / "api"))

import plotly.graph_objects as go  # noqa: E402

from app import db  # noqa: E402
from app.predict_queries import lab_risks, predict_labs, predict_radiation  # noqa: E402

OUT = ROOT / "docs" / "predictive"


def _save(fig, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fig.update_layout(template="plotly_white", margin=dict(l=60, r=20, t=50, b=70))
    fig.write_image(OUT / name, width=960, height=560, scale=2)


def main() -> None:
    with db.connect() as conn:
        potassium = predict_labs(conn, "C003", "POTASSIUM")["items"][0]
        glucose = predict_labs(conn, "C003", "GLUCOSE")["items"][0]
        risks = lab_risks(conn, 8)["risks"]
        radiation = predict_radiation(conn)
    print("Top flagged series")
    for item in risks:
        nxt = item["forecasts"][0]
        print(
            item["crew_id"], item["analyte"], item["flags"],
            "last", item["last"]["value"], item["last"]["timepoint"],
            "next", nxt["yhat"], "p", nxt["p_out_of_range"],
        )
    print("Area dose 30/90/180 uGy", [row["area_dose_ugy"] for row in radiation["cumulative"]])
    print("Spikes at rule threshold", len(radiation["spikes_at_or_above_rule"]))

    fig = go.Figure()
    fig.add_scatter(name="observed", x=potassium["history"]["timepoints"], y=potassium["history"]["y"], mode="lines+markers")
    fig.add_scatter(name="next-step and day marks", x=[str(item["label"]) for item in potassium["forecasts"]], y=potassium["forecast_y"], mode="markers")
    fig.add_scatter(name="95% PI low", x=[str(item["label"]) for item in potassium["forecasts"]], y=potassium["pi95_low"], mode="lines")
    fig.add_scatter(name="95% PI high", x=[str(item["label"]) for item in potassium["forecasts"]], y=potassium["pi95_high"], mode="lines")
    fig.update_layout(title="C003 potassium: observed draws and straight-line marks")
    _save(fig, "c003_potassium.png")

    fig = go.Figure()
    fig.add_scatter(name="observed", x=glucose["history"]["timepoints"], y=glucose["history"]["y"], mode="lines+markers")
    fig.update_layout(title="C003 glucose observed series (OSD-575), not a forecast")
    _save(fig, "c003_glucose.png")

    hist = radiation["history"]
    fig = go.Figure()
    fig.add_scatter(name="hourly mean", x=hist["x"], y=hist["y"], mode="lines")
    fig.update_layout(title="DosTel hourly mean dose rate and a flat 24-hour SES level is in the API, not a spike forecast")
    _save(fig, "radiation_hourly.png")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
