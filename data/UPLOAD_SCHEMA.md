# Vitals CSV upload

The web form posts this schema to `POST /api/uploads`. Rows are stored as `source=upload` and `origin=simulated`. They are not labeled as NASA data.

```csv
crew_id,indicator,value,recorded_at
C001,heart_rate,88,2026-11-14T12:00:00Z
```

| column | required | notes |
| --- | --- | --- |
| crew_id | yes | `C001`–`C004`, or another call sign already in the database |
| indicator | yes | A key the API already knows, such as `heart_rate`, `sleep_hours`, `cortisol_ug_dl`, `hydration_liters` |
| value | yes | Finite number inside that indicator's accepted range |
| recorded_at | yes | ISO-8601 timestamp |

Real Inspiration4 labs, ISS DosTel rates, and DONKI SEP events are not uploaded through this form. They are the CSVs in this folder (`labs_long.csv`, `radiation_iss.csv`, `donki_sep.csv`) and load into PostgreSQL when the API starts. `datasets.csv` is the manifest.
