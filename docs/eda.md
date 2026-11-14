# EDA report

Numbers below are from Postgres after `compose up` loads `data/`. The chart endpoints read those tables. They do not open the CSVs.

Scope, stated plainly: this is **4 Inspiration4 civilian crew members**, labs at 7 pre-flight and post-flight timepoints from a **3-day** flight (16â€“18 Sep 2021 in the data notes). There is **no in-flight blood draw**. Radiation is **one ISS DosTel week, 1â€“7 Jun 2024**, a vehicle measurement, not a personal dose. SEP counts are **119 DONKI rows for calendar 2024**, many of them separate instrument reports of the same solar event. This is not a long-duration ISS crew medical record.

NASA HRP describes space radiation, isolation, distance from Earth, gravity, and closed environments as the hazards of human spaceflight ([hazards](https://www.nasa.gov/hrp/hazards/)). The Canadian Space Agency infographic describes anemia, low white cells with more radiation sensitivity, stiffer vessels and insulin resistance, muscle loss, and up to about 1.5% bone loss per month ([infographic](https://www.asc-csa.gc.ca/eng/multimedia/search/image/8056)). Those are published hazard descriptions. They are **not** frequencies measured in this file.

## Headline counts

| Item | Value |
| --- | --- |
| Crew | 4 |
| Distinct analytes (labs, including cytokines) | 524 |
| Lab rows | 13,249 |
| Timepoints | 7 (`L-92` through `R+194`) |
| Rows with a reference flag | 1,062 (CBC/CMP only; cytokines have no clinical range here) |
| Out of range | 44 (4.14% of rows that have a range) |
| Distinct analytes with at least one low or high flag | 23 |
| Reference-range rows | 51 |
| Dataset catalog rows | 16 |
| DosTel days | 7 |
| DONKI SEP rows | 119 |
| Worsening CBC/CMP pairs (already out of range, next draw further out) | 3 |

## Most common out-of-range CBC/CMP results

![Out of range counts](eda/out_of_range.png)

| Analyte | Low | High | Total |
| --- | ---: | ---: | ---: |
| GLUCOSE | 5 | 2 | 7 |
| UREA NITROGEN (BUN) | 0 | 5 | 5 |
| ABSOLUTE MONOCYTES | 0 | 4 | 4 |
| AST | 0 | 3 | 3 |
| BUN/CREATININE RATIO | 0 | 3 | 3 |
| POTASSIUM | 2 | 1 | 3 |
| ALKALINE PHOSPHATASE | 2 | 0 | 2 |
| HEMOGLOBIN | 2 | 0 | 2 |

Glucose is the most often flagged analyte in this small file. That lines up with the CSA note that spaceflight can bring insulin resistance, but these 7 flags are not a station-wide rate.

## A shift that was visible before the next draw

Three CBC/CMP pairs were already outside the row's own range and moved further outside on the next timepoint. One of them is C003 potassium: 3.3 mmol/L at L-3 (range 3.5â€“5.3) and 3.0 mmol/L at R+1. That is the preventive rule on the crew demo. It is one person, not a fleet pattern.

Largest mean percent changes from L-3 to R+1 (crew mean):

![L-3 to R+1 percent change](eda/pre_post_shift.png)

| Analyte | Mean % change | Mean delta |
| --- | ---: | ---: |
| EOSINOPHILS | +51.90% | +1.025 percentage points |
| ABSOLUTE LYMPHOCYTES | âˆ’36.26% | âˆ’1,055.5 cells/uL |
| GLUCOSE | +34.17% | +23.75 mg/dL |
| MONOCYTES | +28.20% | +2.15 percentage points |
| WHITE BLOOD CELL COUNT | âˆ’26.01% | âˆ’2.25 thousand/uL |

Percent ranks on small bases (a 1-point eosinophil change) sit next to larger cell-count drops. Read the unit column before treating the bar height as clinical importance. CSA's low-white-cell note is a reason to watch the white-cell drop, not a claim that this 3-day flight produced station anemia rates.

![Glucose by crew](eda/glucose_trends.png)

The shaded band is the reference range stored on the OSD-575 rows (65â€“99 mg/dL for these glucose rows). C003 is 75 at L-3, 103 at R+1 (high), and 36 at R+45 (low).

## Extremes

`z_score` treats the reference interval as about four standard deviations. It is only a sort key.

The largest scores are C003 at L-92: MPV 330 (z 256), RDW 32.4 (z 19.4), absolute monocytes 1,997, absolute lymphocytes 6,826. Those MPV and RDW values are not on the usual scale of later draws for the same person, so they should be treated as suspect rows in the source file, not as the headline medical finding.

The extremes that match their own flag and a familiar unit are the R+45 glucose lows: C003 36 mg/dL (z âˆ’5.41), C004 43 (z âˆ’4.59), C002 44 (z âˆ’4.47).

## Radiation week and 2024 SEP events

![DosTel hourly means](eda/radiation_series.png)

![SEP rows by month](eda/sep_by_month.png)

Daily **maximum** absorbed dose rate (Î¼Gy/h), not a personal dose:

| Day | Max | Daily mean |
| --- | ---: | ---: |
| 2024-06-01 | 352.0 | 15.5 |
| 2024-06-02 | 490.8 | 20.2 |
| 2024-06-03 | 385.2 | 21.5 |
| 2024-06-04 | 469.2 | 22.8 |
| 2024-06-05 | 528.5 | 20.0 |
| 2024-06-06 | 476.2 | 25.1 |
| 2024-06-07 | 365.7 | 18.6 |

The June 5 peak is the value paired with the next DONKI SEP (2024-06-08 02:25 UTC), about 73 hours later. They are not the same timestamp.

SEP rows by month (instrument reports, not unique solar storms): Jan 13, Feb 14, Mar 9, May 14, Jun 13, Jul 9, Aug 1, Sep 16, Oct 17, Nov 9, Dec 4. April has none in this file. October is the busiest month in the file (17 rows).

## Endpoints

All of these are SQL over the loaded tables. Array fields are shaped for Plotly (`x`/`y`, or `labels`/`parents`/`values`, or sankey `source`/`target`/`value`).

| Method | Path | Plot |
| --- | --- | --- |
| GET | `/eda/overview` | Big numbers |
| GET | `/eda/labs/out_of_range` | Stacked bar |
| GET | `/eda/labs/analytes` | Dropdown |
| GET | `/eda/labs/trends?analyte=GLUCOSE` | Line plus reference band |
| GET | `/eda/labs/shift` | Bar of biggest L-3 to R+1 movers |
| GET | `/eda/labs/sunburst` | System, then panel, then analyte |
| GET | `/eda/labs/flow` | Sankey phase to status, and crew to status |
| GET | `/eda/radiation/series` | DosTel line, daily bars, SEP bars |
| GET | `/eda/extremes` | Table of largest reference z-scores |

`/eda/overview` example:

```json
{
  "crew_count": 4,
  "analytes": 524,
  "lab_rows": 13249,
  "timepoints": 7,
  "radiation_days": 7,
  "sep_events": 119,
  "out_of_range_rows": 44,
  "rows_with_reference": 1062,
  "pct_out_of_range": 4.14,
  "flagged_analytes": 23
}
```

`/eda/labs/out_of_range` example (first rows):

```json
{
  "analyte": ["GLUCOSE", "UREA NITROGEN (BUN)", "ABSOLUTE MONOCYTES"],
  "low": [5, 0, 0],
  "high": [2, 5, 4]
}
```

`/eda/labs/trends?analyte=POTASSIUM` returns one trace per crew. C003's `L-3` point is `3.3` and `R+1` is `3.0`, with `ref_low` 3.5 and `ref_high` 5.3.

`/eda/labs/sunburst` returns `labels`, `parents`, and `values`. The root is `Out of range`. Children are `blood/immune`, `cardiovascular/metabolic`, `kidney/electrolytes`, and `liver`.

`/eda/labs/flow` returns `phase_to_status` and `crew_to_status`, each with `label`, `source`, `target`, and `value`. Phases are `pre-flight`, `just after flight` (R+1 only), and `recovery`.

`/eda/radiation/series` returns `series` (hourly mean Î¼Gy/h by DosTel instrument), `daily.mean_ugy_h` and `daily.max_ugy_h`, and `sep_by_month`.

Regenerate the figures with:

```sh
DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app python3 notebooks/eda.py
```
