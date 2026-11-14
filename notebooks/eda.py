"""Same crew-wide questions as the insights page, read straight from data/*.csv.

Run from the repository root:

    python3 notebooks/eda.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend" / "services" / "api"))

from app.insights import extremes, flag_counts  # noqa: E402
from app.nasa_loader import read_bundle  # noqa: E402
from app.rules_engine import load_rules, worsening_lab_recommendations  # noqa: E402


def main() -> None:
    bundle = read_bundle(ROOT / "data")
    issues = flag_counts(bundle["labs"])
    preventable = worsening_lab_recommendations(bundle["labs"], load_rules())
    ends = extremes(bundle["labs"], bundle["doses"])
    print("REAL NASA CBC/CMP flags, most common first")
    for item in issues[:8]:
        print(f"  {item['count']:3} {item['flag']:4} {item['panel']:3} {item['analyte']}")
    print(f"Worsening out-of-range pairs that an earlier check could have caught: {len(preventable)}")
    featured = [
        item for item in preventable
        if item["evidence"]["crew_id"] == "C003" and item["evidence"]["analyte"] == "POTASSIUM"
    ]
    if featured:
        evidence = featured[0]["evidence"]
        print(
            "Featured preventive pair: "
            f"C003 potassium {evidence['earlier_timepoint']} {evidence['earlier_value']} -> "
            f"{evidence['later_timepoint']} {evidence['later_value']} {evidence['unit']}"
        )
    peak = ends["peak_vehicle_dose_rate"]
    print(
        "Peak ISS DosTel rate: "
        f"{peak['value']:.1f} {peak['unit']} {peak['instrument_id']} at {peak['recorded_at']}"
    )
    print("SEP events in donki_sep.csv:", len(bundle["events"]))
    print("Lowest glucose:", ends["lowest_glucose"])
    print("These lab, dose, and SEP figures are real NASA rows. Sleep and cortisol are not in this script.")


if __name__ == "__main__":
    main()
