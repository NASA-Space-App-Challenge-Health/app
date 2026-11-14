"""Crew and health-reading persistence."""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import psycopg

from app import db
from app.guidance import (
    INDICATORS,
    classify,
    get_indicator,
    guidance_for,
    validate_reading,
    worst_band,
)
from app.briefing import assemble
from app.nasa_loader import load_nasa
from app.seed import GROUP_ID, GROUP_KIND, GROUP_NAME, RETIRED_DEMO_IDS, SEED_CREW, recorded_at

logger = logging.getLogger(__name__)


class NotFoundError(LookupError):
    pass


class ConflictError(RuntimeError):
    pass


def ensure_ready() -> None:
    last_error: Exception | None = None
    for attempt in range(1, 13):
        try:
            with db.connect() as conn:
                applied = db.apply_migrations(conn)
                _ensure_group(conn)
                _retire_old_demo(conn)
                inserted = seed_simulated_crew(conn)
                loaded = load_nasa(conn)
                conn.commit()
            if applied:
                logger.info("Applied migrations: %s", ", ".join(applied))
            if inserted:
                logger.info("Seeded simulated crew: %s", ", ".join(inserted))
            if loaded:
                logger.info("NASA datasets: %s", loaded)
            return
        except psycopg.OperationalError as exc:
            last_error = exc
            logger.warning("Database not ready (attempt %s/12)", attempt)
            time.sleep(1)
    raise RuntimeError("Database is unavailable") from last_error


def _ensure_group(conn: psycopg.Connection) -> None:
    conn.execute(
        """
        INSERT INTO crew_groups (id, name, kind)
        VALUES (%s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        (GROUP_ID, GROUP_NAME, GROUP_KIND),
    )


def _retire_old_demo(conn: psycopg.Connection) -> None:
    conn.execute("DELETE FROM crew_members WHERE id = ANY(%s)", (list(RETIRED_DEMO_IDS),))
    conn.execute(
        "UPDATE crew_members SET is_cmo = call_sign IN ('C001', 'C002') WHERE call_sign IN ('C001', 'C002', 'C003', 'C004')"
    )


def seed_simulated_crew(conn: psycopg.Connection) -> list[str]:
    inserted: list[str] = []
    now = datetime.now(timezone.utc)
    for member in SEED_CREW:
        call_sign = str(member["call_sign"])
        existing = conn.execute(
            "SELECT id FROM crew_members WHERE call_sign = %s",
            (call_sign,),
        ).fetchone()
        if existing:
            crew_id = existing["id"]
            count = conn.execute(
                "SELECT count(*) AS n FROM health_readings WHERE crew_member_id = %s",
                (crew_id,),
            ).fetchone()
            if count["n"]:
                continue
        else:
            conn.execute(
                """
                INSERT INTO crew_members (
                    id, call_sign, full_name, role, mission, group_id, share_mode, is_cmo
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    member["id"],
                    call_sign,
                    member["full_name"],
                    member["role"],
                    GROUP_NAME,
                    GROUP_ID,
                    member["share_mode"],
                    call_sign in {"C001", "C002"},
                ),
            )
            crew_id = member["id"]
            inserted.append(call_sign)
        for indicator, value, hours_ago in member["readings"]:  # type: ignore[union-attr]
            numeric = validate_reading(str(indicator), value)
            band = classify(str(indicator), numeric)
            spec = get_indicator(str(indicator))
            assert spec is not None
            conn.execute(
                """
                INSERT INTO health_readings (
                    id, crew_member_id, indicator, value_numeric, unit,
                    recorded_at, source, risk_band, origin
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'simulated', %s, 'simulated')
                """,
                (
                    uuid.uuid4(),
                    crew_id,
                    indicator,
                    numeric,
                    spec.unit,
                    recorded_at(int(hours_ago), now=now),
                    band,
                ),
            )
    return inserted


def save_note(*, crew_id: UUID, kind: str, body_region: str | None, note: str) -> dict[str, Any]:
    if kind not in {"symptom", "space_sickness", "eva", "noise", "exercise"}:
        raise ValueError("Unknown note kind")
    if not note.strip():
        raise ValueError("Note is empty")
    note_id = uuid.uuid4()
    with db.connect() as conn:
        member = conn.execute("SELECT id FROM crew_members WHERE id = %s", (crew_id,)).fetchone()
        if member is None:
            raise NotFoundError("Crew member not found")
        conn.execute(
            """
            INSERT INTO clinical_notes (id, crew_member_id, kind, body_region, note)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (note_id, crew_id, kind, body_region, note.strip()),
        )
        conn.commit()
    return {"id": note_id, "kind": kind, "status": "saved", "audience": "self, cmo, flight surgeon"}


def save_image(*, crew_id: UUID, body_region: str, stored_name: str, note: str) -> dict[str, Any]:
    image_id = uuid.uuid4()
    with db.connect() as conn:
        member = conn.execute("SELECT id FROM crew_members WHERE id = %s", (crew_id,)).fetchone()
        if member is None:
            raise NotFoundError("Crew member not found")
        conn.execute(
            """
            INSERT INTO imaging_queue (id, crew_member_id, body_region, stored_name, note)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (image_id, crew_id, body_region, stored_name, note),
        )
        conn.commit()
    return {
        "id": image_id,
        "status": "queued",
        "body_region": body_region,
        "review": "Queued for CMO / flight surgeon review. This screen does not read the image.",
    }


def set_indicator_share(crew_id: UUID, indicator: str, shared: bool) -> dict[str, Any]:
    with db.connect() as conn:
        member = conn.execute("SELECT call_sign FROM crew_members WHERE id = %s", (crew_id,)).fetchone()
        if member is None:
            raise NotFoundError("Crew member not found")
        if shared:
            conn.execute(
                """
                INSERT INTO indicator_shares (crew_member_id, indicator)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                (crew_id, indicator),
            )
        else:
            conn.execute(
                "DELETE FROM indicator_shares WHERE crew_member_id = %s AND indicator = %s",
                (crew_id, indicator),
            )
        conn.commit()
    return {"call_sign": member["call_sign"], "indicator": indicator, "shared": shared}


def import_vitals_csv(text: str) -> dict[str, Any]:
    import csv
    from io import StringIO

    reader = csv.DictReader(StringIO(text))
    required = {"crew_id", "indicator", "value", "recorded_at"}
    if reader.fieldnames is None or not required <= set(reader.fieldnames):
        raise ValueError("CSV needs columns crew_id, indicator, value, recorded_at")
    inserted = 0
    with db.connect() as conn:
        crew = {
            row["call_sign"]: row["id"]
            for row in conn.execute("SELECT id, call_sign FROM crew_members").fetchall()
        }
        for line in reader:
            if not (line.get("crew_id") or "").strip():
                continue
            call = line["crew_id"].strip().upper()
            if call not in crew:
                raise ValueError(f"Unknown crew_id {call}")
            indicator = line["indicator"].strip()
            numeric = validate_reading(indicator, float(line["value"]))
            spec = get_indicator(indicator)
            assert spec is not None
            band = classify(indicator, numeric)
            when = datetime.fromisoformat(line["recorded_at"].strip().replace("Z", "+00:00"))
            if when.tzinfo is None:
                when = when.replace(tzinfo=timezone.utc)
            conn.execute(
                """
                INSERT INTO health_readings (
                    id, crew_member_id, indicator, value_numeric, unit,
                    recorded_at, source, risk_band, origin
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'upload', %s, 'simulated')
                """,
                (uuid.uuid4(), crew[call], indicator, numeric, spec.unit, when, band),
            )
            inserted += 1
        if inserted == 0:
            raise ValueError("CSV has no data rows")
        conn.commit()
    return {"inserted": inserted, "source": "upload", "origin": "simulated"}


def dashboard(viewer: str | None = None, role: str = "self") -> dict[str, Any]:
    with db.connect() as conn:
        return assemble(conn, viewer, role)


def set_share_mode(crew_id: UUID, share_mode: str) -> dict[str, Any]:
    if share_mode not in {"full", "alerts_only"}:
        raise ValueError("share_mode must be full or alerts_only")
    with db.connect() as conn:
        row = conn.execute(
            """
            UPDATE crew_members SET share_mode = %s WHERE id = %s RETURNING call_sign
            """,
            (share_mode, crew_id),
        ).fetchone()
        if row is None:
            raise NotFoundError("Crew member not found")
        conn.commit()
    return get_crew(crew_id)


def get_crew(crew_id: UUID) -> dict[str, Any]:
    for member in dashboard()["crew"]:
        if member["id"] == crew_id:
            return member
    raise NotFoundError("Crew member not found")


def create_crew(*, call_sign: str, full_name: str, role: str, mission: str) -> dict[str, Any]:
    normalized = call_sign.strip().upper()
    full_name = full_name.strip()
    role = role.strip()
    mission = mission.strip()
    if not normalized or not full_name or not role or not mission:
        raise ValueError("Call sign, name, role, and mission are required")
    crew_id = uuid.uuid4()
    try:
        with db.connect() as conn:
            conn.execute(
                """
                INSERT INTO crew_members (id, call_sign, full_name, role, mission)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (crew_id, normalized, full_name, role, mission),
            )
            conn.commit()
    except psycopg.errors.UniqueViolation as exc:
        raise ConflictError("A crew member with that call sign already exists") from exc
    return get_crew(crew_id)


def list_readings(crew_member_id: UUID) -> list[dict[str, Any]]:
    with db.connect() as conn:
        member = conn.execute(
            "SELECT id FROM crew_members WHERE id = %s",
            (crew_member_id,),
        ).fetchone()
        if member is None:
            raise NotFoundError("Crew member not found")
        rows = conn.execute(
            """
            SELECT id, crew_member_id, indicator, value_numeric, unit,
                   recorded_at, source, risk_band
            FROM health_readings
            WHERE crew_member_id = %s
            ORDER BY recorded_at DESC, indicator
            LIMIT 500
            """,
            (crew_member_id,),
        ).fetchall()
    return [_reading_row(row) for row in rows]


def create_reading(
    *,
    crew_member_id: UUID,
    indicator: str,
    value: object,
    recorded_at_value: datetime | None,
) -> dict[str, Any]:
    numeric = validate_reading(indicator, value)
    spec = get_indicator(indicator)
    assert spec is not None
    band = classify(indicator, numeric)
    when = _normalize_time(recorded_at_value)
    reading_id = uuid.uuid4()
    try:
        with db.connect() as conn:
            member = conn.execute(
                "SELECT id FROM crew_members WHERE id = %s",
                (crew_member_id,),
            ).fetchone()
            if member is None:
                raise NotFoundError("Crew member not found")
            conn.execute(
                """
                INSERT INTO health_readings (
                    id, crew_member_id, indicator, value_numeric, unit,
                    recorded_at, source, risk_band
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'manual', %s)
                """,
                (reading_id, crew_member_id, indicator, numeric, spec.unit, when, band),
            )
            conn.commit()
            row = conn.execute(
                """
                SELECT id, crew_member_id, indicator, value_numeric, unit,
                       recorded_at, source, risk_band
                FROM health_readings
                WHERE id = %s
                """,
                (reading_id,),
            ).fetchone()
    except NotFoundError:
        raise
    return _reading_row(row)


def _normalize_time(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    if value > datetime.now(timezone.utc) + timedelta(days=1):
        raise ValueError("recorded_at cannot be more than a day in the future")
    return value


def _crew_payload(row: dict[str, Any], latest_by_indicator: dict[str, Any]) -> dict[str, Any]:
    readings = []
    for spec in INDICATORS:
        current = latest_by_indicator.get(spec.key)
        readings.append(_panel_reading(spec.key, current))
    return {
        "id": row["id"],
        "call_sign": row["call_sign"],
        "full_name": row["full_name"],
        "role": row["role"],
        "mission": row["mission"],
        "overall_band": worst_band(
            [item["risk_band"] for item in readings if item["risk_band"]]
        ),
        "readings": readings,
    }


def _panel_reading(indicator: str, row: dict[str, Any] | None) -> dict[str, Any]:
    spec = get_indicator(indicator)
    assert spec is not None
    if row is None:
        return {
            "id": None,
            "indicator": spec.key,
            "label": spec.label,
            "group": spec.group,
            "value": None,
            "unit": spec.unit,
            "decimals": spec.decimals,
            "recorded_at": None,
            "source": None,
            "risk_band": None,
            "explanation": spec.explanation,
            "guidance": None,
        }
    return {
        "id": row["id"],
        "indicator": spec.key,
        "label": spec.label,
        "group": spec.group,
        "value": row["value_numeric"],
        "unit": row["unit"],
        "decimals": spec.decimals,
        "recorded_at": row["recorded_at"],
        "source": row["source"],
        "risk_band": row["risk_band"],
        "explanation": spec.explanation,
        "guidance": guidance_for(spec.key, row["risk_band"]),
    }


def _reading_row(row: dict[str, Any]) -> dict[str, Any]:
    spec = get_indicator(row["indicator"])
    return {
        "id": row["id"],
        "crew_member_id": row["crew_member_id"],
        "indicator": row["indicator"],
        "label": spec.label if spec else row["indicator"],
        "group": spec.group if spec else "Other",
        "value": row["value_numeric"],
        "unit": row["unit"],
        "decimals": spec.decimals if spec else 1,
        "recorded_at": row["recorded_at"],
        "source": row["source"],
        "risk_band": row["risk_band"],
        "explanation": spec.explanation if spec else "",
        "guidance": guidance_for(row["indicator"], row["risk_band"]) if spec else "",
    }
