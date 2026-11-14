"""Load the committed NASA CSVs into PostgreSQL once."""

from __future__ import annotations

import csv
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


KEY_ANALYTES = (
    "GLUCOSE",
    "HEMOGLOBIN",
    "WHITE BLOOD CELL COUNT",
    "PLATELET COUNT",
    "POTASSIUM",
    "SODIUM",
    "CREATININE",
)


def data_dir() -> Path:
    override = __import__("os").environ.get("DATA_DIR", "").strip()
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[4] / "data"


def _float(value: str) -> float | None:
    text = (value or "").strip()
    if not text:
        return None
    return float(text)


def _flag(value: str) -> str | None:
    text = (value or "").strip().lower()
    if text in {"low", "normal", "high"}:
        return text
    return None


def _dt(value: str) -> datetime:
    text = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def read_bundle(directory: Path | None = None) -> dict[str, list[dict[str, Any]]]:
    root = directory or data_dir()
    labs = []
    with (root / "labs_long.csv").open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            labs.append({
                "crew_id": row["crew_id"],
                "timepoint": row["timepoint"],
                "days_from_launch": int(row["days_from_launch"]),
                "panel": row["panel"],
                "analyte": row["analyte"],
                "value": _float(row["value"]),
                "unit": row["unit"],
                "ref_low": _float(row["ref_low"]),
                "ref_high": _float(row["ref_high"]),
                "flag": _flag(row["flag"]),
                "source_study": row["source_study"],
            })
    doses = []
    with (root / "radiation_iss.csv").open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rate = _float(row["absorbed_dose_rate"])
            if rate is None:
                continue
            doses.append({
                "recorded_at": _dt(row["timestamp"]),
                "instrument_id": row["instrument_id"],
                "absorbed_dose_rate": rate,
                "dose_equivalent_rate": _float(row["dose_equivalent_rate"]),
            })
    events = []
    with (root / "donki_sep.csv").open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            events.append({
                "sep_id": row["sepID"],
                "event_time": _dt(row["eventTime"]),
                "instruments": row["instruments"],
                "link": row["link"],
                "linked_events": row["linkedEvents"],
            })
    return {"labs": labs, "doses": doses, "events": events}


def load_nasa(conn, directory: Path | None = None) -> dict[str, int]:
    root = directory or data_dir()
    loaded: dict[str, int] = {}
    bundle = None
    for filename in (
        "labs_long.csv",
        "radiation_iss.csv",
        "donki_sep.csv",
        "reference_ranges.csv",
        "datasets.csv",
    ):
        existing = conn.execute(
            "SELECT row_count FROM dataset_loads WHERE filename = %s",
            (filename,),
        ).fetchone()
        if existing:
            loaded[filename] = existing["row_count"]
            continue
        if bundle is None:
            bundle = read_bundle(root)
        if filename == "labs_long.csv":
            crew = {
                row["call_sign"]: row["id"]
                for row in conn.execute("SELECT id, call_sign FROM crew_members").fetchall()
            }
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO lab_results (
                        id, crew_member_id, timepoint, days_from_launch, panel, analyte,
                        value_numeric, unit, ref_low, ref_high, flag, source_study, origin
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'real'
                    )
                    ON CONFLICT (crew_member_id, timepoint, panel, analyte, source_study) DO NOTHING
                    """,
                    [
                        (
                            uuid.uuid4(),
                            crew[row["crew_id"]],
                            row["timepoint"],
                            row["days_from_launch"],
                            row["panel"],
                            row["analyte"],
                            row["value"],
                            row["unit"],
                            row["ref_low"],
                            row["ref_high"],
                            row["flag"],
                            row["source_study"],
                        )
                        for row in bundle["labs"]
                        if row["crew_id"] in crew
                    ],
                )
            count = len(bundle["labs"])
        elif filename == "radiation_iss.csv":
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO radiation_readings (
                        recorded_at, instrument_id, absorbed_dose_rate, dose_equivalent_rate, origin
                    ) VALUES (%s, %s, %s, %s, 'real')
                    ON CONFLICT (recorded_at, instrument_id) DO NOTHING
                    """,
                    [
                        (
                            row["recorded_at"],
                            row["instrument_id"],
                            row["absorbed_dose_rate"],
                            row["dose_equivalent_rate"],
                        )
                        for row in bundle["doses"]
                    ],
                )
            count = len(bundle["doses"])
        elif filename == "donki_sep.csv":
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO space_weather_events (
                        sep_id, event_time, instruments, link, linked_events, origin
                    ) VALUES (%s, %s, %s, %s, %s, 'real')
                    ON CONFLICT (sep_id) DO NOTHING
                    """,
                    [
                        (
                            row["sep_id"],
                            row["event_time"],
                            row["instruments"],
                            row["link"],
                            row["linked_events"],
                        )
                        for row in bundle["events"]
                    ],
                )
            count = len(bundle["events"])
        elif filename == "reference_ranges.csv":
            count = _load_reference_ranges(conn, root)
        else:
            count = _load_dataset_catalog(conn, root)
        conn.execute(
            "INSERT INTO dataset_loads (filename, row_count) VALUES (%s, %s)",
            (filename, count),
        )
        loaded[filename] = count
    return loaded


def _load_reference_ranges(conn, root: Path) -> int:
    rows = []
    with (root / "reference_ranges.csv").open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows.append((
                row["analyte"],
                row["unit"],
                _float(row["ref_low"]),
                _float(row["ref_high"]),
                row["panel"],
            ))
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO reference_ranges (analyte, unit, ref_low, ref_high, panel)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (analyte, unit, panel, ref_low, ref_high) DO NOTHING
            """,
            rows,
        )
    return len(rows)


def _load_dataset_catalog(conn, root: Path) -> int:
    rows = []
    with (root / "datasets.csv").open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            size = (row.get("size") or "").strip()
            rows.append((
                row["id"],
                row["title"],
                row.get("official_url") or "",
                row.get("files") or "",
                int(size) if size else None,
                row.get("what_it_contains") or "",
                row.get("license_access") or "",
            ))
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO dataset_catalog (
                dataset_id, title, official_url, files, size_bytes, what_it_contains, license_access
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (dataset_id) DO NOTHING
            """,
            rows,
        )
    return len(rows)
