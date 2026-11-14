# NASA Inspiration4 and related open health data (cleaned)

The API loads `labs_long.csv`, `radiation_iss.csv`, and `donki_sep.csv` into PostgreSQL on startup. `datasets.csv` is the source manifest. Vitals a crew member types or uploads use the separate schema in [UPLOAD_SCHEMA.md](UPLOAD_SCHEMA.md) and are stored as simulated. Heart rate, sleep, cortisol, hydration, and hygiene timing are not in these files.



Analysis-ready tables for the NASA Space Apps Challenge 2026 health-monitoring project. All files were downloaded from official NASA hosts only (osdr.nasa.gov, visualization.osdr.nasa.gov, ccmc.gsfc.nasa.gov, nasa.gov). No SOMA/Cornell, JAXA-hosted, CSA, or GitHub sources are included.

Checked against the official I4 dataset list: https://www.nasa.gov/osdr-latest-news-i4-mission-datasets/

## Tidy outputs (package root)

### `labs_long.csv` (13,249 rows)

Long-format clinical and cytokine measurements for the four Inspiration4 civilian crew members (C001–C004).

| column | meaning |
| --- | --- |
| crew_id | De-identified crew ID (C001–C004) |
| timepoint | Source label: L-92, L-44, L-3 (pre-flight) or R+1, R+45, R+82, R+194 (post-flight) |
| days_from_launch | Numeric days relative to launch (negative = pre-flight), parsed from the timepoint |
| panel | CBC, CMP, or cytokine |
| analyte | Test name. Cytokine names include the assay, e.g. `IL-6 (Eve HD71)`, `crp (Eve HDCVD9)`, `il_6 (Alamar NULISA serum)`, `il_6 (Alamar NULISA urine)` |
| value | Measured value from the source file. Blank if the source was missing (not imputed) |
| unit | Source unit (e.g. mg/dL, %, pg/ml, NPQ) |
| ref_low, ref_high | Clinical reference range when the source provided one. Blank for cytokine assays and for eGFR upper bound (source has only a lower limit of 60) |
| flag | `low` / `normal` / `high` from the row's own range, inclusive. Blank if the value is missing or no range exists. For eGFR, values &lt; 60 are `low` and values ≥ 60 are `normal` |
| source_study | OSD-569 (CBC), OSD-575 (CMP and serum cytokines), or OSD-656 (urine cytokines) |

Timepoints are pre- and post-flight only. Inspiration4 was a 3-day mission (16–18 Sep 2021); these OSDR clinical tables have **no in-flight samples**.

Known gaps left as in the source (nothing invented):

- 22 CMP values are blank, almost all `BUN/CREATININE RATIO`, plus one `BILIRUBIN; TOTAL` (C001, R+45).
- A few CBC tests are absent for single crew-timepoints (e.g. MCHC for C002 at several visits).
- Three CBC rows were labeled `HEMOGLOBIN (FEMALE)` etc. in the Quest export; those names were normalized to the base analyte. The female reference range on that row was kept.
- Serum Alamar NULISA is missing C003 at L-44 (27 of 28 samples).
- Urine Alamar NULISA has 22 of 28 crew-timepoints; missing: C001 L-3, C001 R+1, C001 R+194, and R+194 for C002, C003, and C004.
- Some CBC/CMP reference ranges differ by sex or visit; `reference_ranges.csv` keeps every distinct combination (51 rows for 39 analytes). Do not assume one range per test.
- Cytokine "percent of pre-flight mean" columns exist in the raw Eve files but were not copied here (they are derived, and they are not clinical reference ranges).

### `reference_ranges.csv`

Unique `(analyte, unit, ref_low, ref_high, panel)` combinations observed in the CBC and CMP source files. Cytokine assays have no clinical ranges in the OSDR tables.

### `radiation_iss.csv` (12,873 rows)

ISS absorbed dose rate from NASA RadLab for **2024-06-01 00:00 through 2024-06-07 23:59** (America-independent ISO timestamps from the API), instruments DosTel1 (6,511 rows) and DosTel2 (6,362 rows), about every two minutes. `dose_equivalent_rate` is present as a column but was empty in this extract; it was left blank. TEPC did not return rows for the instrument names tried (`TEPC`, `ISS-TEPC`, `TEPC1`). A query for 2024-01-01–01-08 returned no DosTel data; the June 2024 week was used instead because it actually contained measurements. API: https://visualization.osdr.nasa.gov/radlab/gui/data-api/

### `donki_sep.csv` (119 events)

Solar energetic particle (SEP) events in calendar year 2024 from the NASA DONKI API (60-day query windows, then de-duplicated). Columns: sepID, eventTime, instruments, link, linkedEvents, submissionTime, versionId.

### `datasets.csv`

Manifest of every study/source in this package: id, title, official URL, files, size (bytes of downloaded raw files), what it contains, license/access.

## Inspiration4 checklist (from the NASA I4 news page)

All 10 studies listed on the official page are in `datasets.csv`.

Included with processed/tabular downloads:

- **OSD-569** Whole blood — CBC tables (omics FASTQ / large RNA workbooks skipped).
- **OSD-570** PBMC — processed snRNA, snATAC, and VDJ Excel files.
- **OSD-571** Plasma — processed proteomics and metabolomics tables (61 MB preprocessed proteomics TSV skipped as a bulky duplicate of the processed XLSX; raw cfDNA/cfRNA sequencing skipped).
- **OSD-575** Serum — CMP and cytokine CSVs.
- **OSD-572** Crew swabs — MetaPhlan taxonomy and pathway-abundance summaries only.
- **OSD-573** Dragon capsule swabs — same style of compact summaries.
- **OSD-574** Skin biopsies — spatial transcriptomics processed XLSX plus MetaPhlan summary.
- **OSD-630** Stool — compact metagenomics summaries.
- **OSD-656** Urine — inflammation multiplex, merged into `labs_long.csv`.

Included in the manifest but with metadata only:

- **OSD-687** T-cell histone marks — the public file list has study metadata plus restricted/raw CUT&RUN FASTQ (hundreds of MB to several GB). No unrestricted processed peak or count table was available, so those sequences were not downloaded.

## OS-568 experiment (requested separately)

https://osdr.nasa.gov/bio/repo/data/experiments/OS-568 maps to NASA OSDR **study OSD-568**, a **mouse** (RR-9, 35 days on ISS) ocular microscopy dataset, not Inspiration4 and not human clinical labs. Linked studies from the same experiment:

- OSD-568 — processed ZO-1 / TUNEL / PECAM tables (image zips skipped).
- OSD-583 — mouse intraocular pressure (tonometry).
- OSD-715 — processed retina proteomics XLSX (~23 MB); raw instrument zips (~4 GB) skipped.

These remain under `raw/OSD-568`, `raw/OSD-583`, and `raw/OSD-715` and were **not** merged into `labs_long.csv`.

## Caveats for the health-monitoring app

- n = 4 civilian astronauts, 3-day mission, pre/post labs only.
- Real continuous astronaut vitals (heart rate, blood pressure, in-flight glucose, ISS ultrasound, LSAH medical records, Standard Measures of flight, and NASA Twins Study clinical files) are not in these open tables.
- A realistic prototype combines these real lab, urine, radiation, and space-weather tables with **clearly labeled simulated vitals**, using the CBC/CMP reference ranges as thresholds.
- Mouse RR-9 ocular/IOP data can illustrate a spaceflight eye-risk analog but must be labeled as rodent analog data.

## Raw downloads

Each source is in `raw/<id>/`. Rebuild tidy files with `python3 build_outputs.py`.
