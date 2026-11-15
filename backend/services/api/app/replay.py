"""Replay helper for the real in-flight radiation series.

The UI replays the recorded DosTel week. At each frame it asks this endpoint
whether the rule that ships in `rules.yaml` would have fired at that instant.
The answer comes from the same rules engine and the same privacy projection as
the dashboard, so the alert shown in the replay is not a UI invention.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app import db
from app.access import ROLES, broadcasts, project_finding
from app.rules_engine import load_rules, radiation_emergency


def parse_at(value: str) -> datetime:
    text = (value or "").strip().replace("Z", "+00:00")
    if not text:
        raise ValueError("at is required, as an ISO 8601 timestamp")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise ValueError("at must be an ISO 8601 timestamp") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def radiation_alert(*, at: str, viewer: str | None = None, role: str = "self") -> dict[str, Any]:
    if role not in ROLES:
        raise ValueError(f"Unknown role: {role}")
    at_dt = parse_at(at)
    with db.connect() as conn:
        dose_rows = conn.execute(
            """
            SELECT recorded_at, instrument_id, absorbed_dose_rate
            FROM radiation_readings
            WHERE recorded_at <= %s
            """,
            (at_dt,),
        ).fetchall()
        sep_rows = conn.execute(
            """
            SELECT sep_id, event_time, instruments, link
            FROM space_weather_events
            """
        ).fetchall()
    rules = load_rules()
    alert = radiation_emergency([dict(row) for row in dose_rows], [dict(row) for row in sep_rows], rules)
    if alert is None:
        return {"at": at_dt.isoformat(), "alert": None, "broadcast": None}
    projected = project_finding(alert, role=role, viewer=viewer)
    broadcast_items = broadcasts([alert])
    return {
        "at": at_dt.isoformat(),
        "alert": projected,
        "broadcast": broadcast_items[0] if broadcast_items else None,
    }
