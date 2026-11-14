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
    DISCLAIMER,
    INDICATORS,
    MISSION,
    classify,
    get_indicator,
    guidance_for,
    validate_reading,
    worst_band,
)
from app.seed import SEED_CREW, recorded_at

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
                inserted = seed_simulated_crew(conn)
                conn.commit()
            if applied:
                logger.info("Applied migrations: %s", ", ".join(applied))
            if inserted:
                logger.info("Seeded simulated crew: %s", ", ".join(inserted))
            return
        except psycopg.OperationalError as exc:
            last_error = exc
            logger.warning("Database not ready (attempt %s/12)", attempt)
            time.sleep(1)
    raise RuntimeError("Database is unavailable") from last_error


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
                INSERT INTO crew_members (id, call_sign, full_name, role, mission)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    member["id"],
                    call_sign,
                    member["full_name"],
                    member["role"],
                    member["mission"],
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
                    recorded_at, source, risk_band
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'simulated', %s)
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


def dashboard() -> dict[str, Any]:
    with db.connect() as conn:
        crew_rows = conn.execute(
            """
            SELECT id, call_sign, full_name, role, mission
            FROM crew_members
            ORDER BY call_sign
            """
        ).fetchall()
        latest = conn.execute(
            """
            SELECT DISTINCT ON (crew_member_id, indicator)
                id, crew_member_id, indicator, value_numeric, unit,
                recorded_at, source, risk_band
            FROM health_readings
            ORDER BY crew_member_id, indicator, recorded_at DESC
            """
        ).fetchall()
    by_crew: dict[UUID, dict[str, Any]] = {}
    sources: set[str] = set()
    for row in latest:
        by_crew.setdefault(row["crew_member_id"], {})[row["indicator"]] = row
        sources.add(row["source"])
    crew = [_crew_payload(row, by_crew.get(row["id"], {})) for row in crew_rows]
    if not sources or sources <= {"simulated"}:
        data_source = "simulated"
    else:
        data_source = "mixed"
    return {
        "data_source": data_source,
        "disclaimer": DISCLAIMER,
        "mission": MISSION,
        "indicators": [item.to_public() for item in INDICATORS],
        "crew": crew,
    }


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
