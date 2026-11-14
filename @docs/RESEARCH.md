# Research

Open-data sources, cleaning decisions, and gaps live in [../data/README.md](../data/README.md).
The analysis that ships with the product is in [EDA.md](EDA.md) and
[PREDICTIVE.md](PREDICTIVE.md).

## What runs today

- `data/labs_long.csv`, `data/radiation_iss.csv`, and `data/donki_sep.csv` load
  into PostgreSQL on API startup and back every chart and card in the UI.
- Real NASA values: Inspiration4 CBC/CMP/cytokine rows (OSD-569, OSD-575,
  OSD-656), one ISS DosTel week from RadLab (June 2024), and 119 DONKI SEP
  events for 2024.
- Still simulated and labelled as such in the UI: heart rate, SpO2, cabin CO2,
  body temperature, sleep, cortisol, hydration, and hygiene-station timing.

## What is not in the public tables

There is no in-flight blood draw for Inspiration4 (a 3-day flight), no
continuous crew vitals, and no personal dosimetry. Risk cutoffs in
`backend/services/api/rules/rules.yaml` are app settings, not flight-surgeon
limits.
