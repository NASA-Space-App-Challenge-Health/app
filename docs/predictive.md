# Predictive notes

These forecasts read the Postgres tables loaded from `data/`. They do not open the CSVs at request time.

This is a hackathon sketch on **4 Inspiration4 civilians**, **7 lab timepoints** from a **3-day** flight, **one DosTel week** (1â€“7 Jun 2024), and **119 DONKI SEP rows** for 2024. It is not a long-duration crew record, and it is not a medical device.

## Methods

**Labs.** For each crew member and CBC/CMP analyte with at least 3 numeric draws:

- x is days from launch (`L-92` = âˆ’92, `R+194` = 194).
- A straight least-squares line, plus a Theilâ€“Sen slope so one wild point is visible beside the least-squares slope.
- Change from that person's pre-flight mean (days &lt; 0).
- z-score against the reference span on the row: the interval is treated as about four standard deviations. That is a sort key, not a lab z-score.
- 95% prediction interval using the Student-t multiplier for `n âˆ’ 2` degrees of freedom. With 7 points, df = 5 and t â‰ˆ 2.57, so the band is wide.
- Probability of landing outside the last row's reference range, under a normal curve with that prediction standard error. It is not a calibrated clinical risk.
- **Day 30, 90, and 180** are points on the fitted line. If the series already reaches that day they are marked `inside_observed_span: true`. They are not a simulated longer mission.
- **next_step** is the only extrapolation: last day plus the median gap between draws. For C003 potassium the last day is 194 and the median gap is 42.5, so the step is day 236.5.

**Radiation.** Hourly mean absorbed dose rate, then simple exponential smoothing (Î± = 0.3) held flat for 24 hours. The interval is the recent residual scatter. Spikes are raw samples at or above `rules.yaml` `dose_rate_at_least` (400 Î¼Gy/h), not a new cutoff. Cumulative figures multiply that week's mean rate by 24 Ã— 30, 90, or 180. That is an **area dose from a dose rate**, and only if the week repeats. It is not a personal dose and it is not compared with a career limit.

**Simulated vitals.** If a heart-rate, sleep, or cortisol series is in `health_readings` with `origin = simulated`, the last point is compared with that series' own mean and standard deviation. "Anomaly" means at least 2 sample SDs. That is not a NASA threshold. A recommendation is emitted only when the value also crosses a cutoff already written in `rules.yaml`.

## Recommendations

| Signal | Tier | Crew broadcast |
| --- | --- | --- |
| Area dose rate â‰¥ 400 Î¼Gy/h and a DONKI SEP inside the rules.yaml window | emergency | Yes. Text is "Radiation contingency â€” follow procedures." No diagnosis. |
| Simulated heart rate outside 40â€“130 bpm (the window already in `rules.yaml`) | emergency | Yes. "Crewmate needs assistance." No rate in the public text. |
| Lab already out of range and the next draw further out | cmo | No |
| Line points outside the range at the next step, last draw still inside | self | No |
| Simulated sleep and cortisol past the `rules.yaml` sleep rule | flight_surgeon | No |

Citations are the source URLs already listed in `rules.yaml` (OSD-569, OSD-575, HRP hazards, CSA infographic, OCHMO-TB-044, RadLab, DONKI). No new numeric clinical limit was added.

`GET /recommendations` uses the same role filter as the rest of the API. A crewmate does not receive the potassium numbers. A flight surgeon does.

## What the fit actually says

![C003 potassium](predictive/c003_potassium.png)

C003 potassium, 7 draws. Pre-flight mean 3.5 mmol/L. Least-squares slope about **+0.0014 mmol/L per day**. Theilâ€“Sen slope about **+0.0009**. Last draw R+194 is 3.8, inside 3.5â€“5.3, and 0.3 above the pre-flight mean. The series still carries the worsening pair L-3 **3.3** â†’ R+1 **3.0** (both low). Next-step estimate **3.92**, 95% interval **2.26 to 5.59**, rough P(out of range) **0.27**. Day 30 / 90 / 180 sit inside the observed span at 3.63, 3.72, and 3.85. The interval covers both the reference range and values outside it. That is the uncertainty, not a precise forecast.

![C003 glucose](predictive/c003_glucose.png)

C003 glucose is shown as the observed OSD-575 series (75 at L-3, 103 at R+1, 36 at R+45, 73 at R+194). The late recovery is why a line through all seven points is a poor description of the R+45 low.

Ranked flags from `GET /predict/labs/risks` (first four):

| Crew | Analyte | Flag | Last | Next-step yhat | P(out of range) |
| --- | --- | --- | --- | ---: | ---: |
| C004 | Absolute monocytes | already out and worsening | 988 cells/Î¼L at R+194 | 1004 | 0.72 |
| C003 | Potassium | already out and worsening | 3.8 mmol/L at R+194 | 3.92 | 0.27 |
| C003 | MPV | trending toward out of range | 10.2 at R+194 | âˆ’97 | 0.99 |
| C003 | RDW | trending toward out of range | 13.1 at R+194 | 6.4 | 0.87 |

The MPV and RDW lines are not usable. C003's L-92 MPV is 330, which is not on the scale of the later draws, and it drags the least-squares line through impossible values. The high probability is the interval exploding, not a prediction that MPV becomes negative. Prefer the Theilâ€“Sen slope, and do not brief those two.

![DosTel hourly means](predictive/radiation_hourly.png)

Week mean area dose rate **15.24 Î¼Gy/h**. If that mean repeated: about **11.0 mGy in 30 days**, **32.9 mGy in 90**, **65.8 mGy in 180** (reported by the API in Î¼Gy: 10973, 32920, 65839). Twenty raw samples are at or above the 400 Î¼Gy/h rule, peak **528.5 Î¼Gy/h** on DosTel1 at 2024-06-05 01:20 UTC. The next SEP in the rules window is **2024-06-08 02:25 UTC** (GOES-P SEISS >100 MeV). The smoother does not forecast that spike.

## How a card reads

Each lab forecast includes a `plain` object. Each recommendation uses the same words at the top level, with the numbers in `technical`. Titles say "blood sugar (glucose)" and "white blood cell" rather than the lab code alone. Confidence is `low` or `medium`. Nothing in this file is `high`: there are at most seven draws.

A card does not diagnose. Blood sugar that left the usual range is tied to the Canadian Space Agency line that astronauts can develop insulin resistance, which may lead to Type 2 diabetes, and the text says that does not mean you have diabetes. A high urea nitrogen (BUN) says food or fluids can move the number and that it does not mean the kidneys are failing. A high monocyte count is described as a type of white blood cell, and the CSA note about *low* white cells is labeled as context, not a match. One early point that is far off the later draws (MPV, for example) is called out as a result to recheck, not as a forecast.

C003 blood sugar, for the flight surgeon:

```json
{
  "title": "Your blood sugar (glucose) has been both above and below the usual range",
  "what_it_means": "Blood sugar (glucose) went both above and below the usual range in this short set of draws, and the latest result is back inside. That is worth checking with the CMO, and it is not a diagnosis.",
  "why_it_matters_in_space": "The Canadian Space Agency notes that astronauts can develop insulin resistance, which may lead to Type 2 diabetes. A short series could raise that as something to watch with the CMO. It does not mean you have diabetes.",
  "what_to_do": "Keep your planned meals and your exercise. Protect your sleep. Tell the CMO and ask whether to repeat the blood sugar test. Do not start medicine or supplements on your own.",
  "who_is_notified": "You, the crew medical officer, and the flight surgeon can see this. It is not announced to the whole crew.",
  "confidence": "low",
  "technical": {"value": 73.0, "unit": "mg/dL", "timepoint": "R+194", "reference_range": {"low": 65.0, "high": 99.0}}
}
```

The crew-wide radiation notice stays generic. The dose rate and the SEP id stay on the clinical card.

## Endpoints

`GET /predict/labs?crew=C003&analyte=POTASSIUM`

```json
{
  "n": 7,
  "fit": {"method": "ols", "slope_per_day": 0.001409},
  "flags": ["already_out_and_worsening"],
  "forecasts": [
    {"label": "next_step", "day": 236.5, "inside_observed_span": false, "yhat": 3.9249, "pi95_low": 2.2605, "pi95_high": 5.5893, "p_out_of_range": 0.2726}
  ]
}
```

`GET /predict/labs/risks` returns that ranked list. `GET /predict/radiation` returns `history`, `forecast`, `pi95_low`, `pi95_high`, `spikes_at_or_above_rule`, `sep_after_peak`, and `cumulative`. `GET /predict/vitals?crew=C003` is simulated only. `GET /recommendations?crew=C003&role=flight_surgeon` includes the potassium card and does not broadcast it. `role=crewmate` drops the potassium text.

```sh
DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app python3 notebooks/predictive.py
```
