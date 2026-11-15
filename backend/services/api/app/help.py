"""Help loop: a crew member asks for assistance, another accepts.

This is the first persisted workflow in the app. Alerts elsewhere are computed
per request (see `briefing.py`); a help request is a row with a status, a
timestamp and an assignee, so the requester can see "help on the way" after the
other side accepts.

Privacy (OCHMO-TB-044): the whole crew may see that someone needs help, the
module and a generic reason code. The free-text reason is visible only to the
CMO, the flight surgeon and the requester.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.access import ROLES

REASON_CODES = {
    "injury": "Injury or fall",
    "chest_discomfort": "Chest discomfort",
    "breathing": "Breathing trouble",
    "dizziness": "Dizziness",
    "illness": "Feeling unwell",
    "radiation": "Radiation concern",
    "other": "Other",
}

MODULES = (
    "Node 1",
    "Node 2",
    "Columbus",
    "Cupola",
    "US Lab",
    "Airlock",
    "Service Module",
)

ACTIVE_STATUSES = ("requested", "accepted", "escalated")
DETAIL_ROLES = {"cmo", "flight_surgeon"}
DEFAULT_TIMEOUT_SECONDS = 90


class HelpError(Exception):
    """Base error for the help loop; mapped to an HTTP status in `main.py`."""


class HelpNotFound(HelpError):
    pass


class HelpConflict(HelpError):
    pass


class HelpValidation(HelpError):
    pass


def timeout_seconds() -> int:
    raw = os.environ.get("HELP_REQUEST_TIMEOUT_SECONDS", "").strip()
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_TIMEOUT_SECONDS
    return value if value > 0 else DEFAULT_TIMEOUT_SECONDS


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _crew_id(conn, call_sign: str | None) -> uuid.UUID | None:
    if not call_sign:
        return None
    row = conn.execute(
        "SELECT id FROM crew_members WHERE call_sign = %s",
        (call_sign.strip().upper(),),
    ).fetchone()
    return None if row is None else row["id"]


def _effective_status(row: dict[str, Any], now: datetime) -> str:
    status = row["status"]
    if status == "requested" and row["expires_at"] <= now:
        return "escalated"
    return status


def _project(row: dict[str, Any], *, viewer_sign: str | None, role: str) -> dict[str, Any]:
    now = _now()
    status = _effective_status(row, now)
    requester_sign = row["requester_call_sign"]
    accepted_sign = row["accepted_call_sign"]
    created_at = row["created_at"]
    accepted_at = row["accepted_at"]
    age_seconds = max(int((now - created_at).total_seconds()), 0)
    time_to_accept = None
    if accepted_at is not None:
        time_to_accept = max(int((accepted_at - created_at).total_seconds()), 0)
    is_requester = viewer_sign is not None and viewer_sign == requester_sign
    sees_detail = role in DETAIL_ROLES or is_requester
    return {
        "id": str(row["id"]),
        "requester": requester_sign,
        "module": row["requester_module"],
        "reason_code": row["reason_code"],
        "reason_label": REASON_CODES.get(row["reason_code"], row["reason_code"]),
        "reason_text": row["reason_text"] if sees_detail else None,
        "severity": row["severity"],
        "status": status,
        "created_at": created_at.isoformat(),
        "age_seconds": age_seconds,
        "expires_at": row["expires_at"].isoformat(),
        "accepted_by": accepted_sign,
        "accepted_at": None if accepted_at is None else accepted_at.isoformat(),
        "help_on_the_way": status == "accepted",
        "time_to_accept_seconds": time_to_accept,
        "can_accept": (
            status in ("requested", "escalated")
            and viewer_sign is not None
            and viewer_sign != requester_sign
        ),
        "can_close": (
            status in ("requested", "escalated", "accepted")
            and (
                is_requester
                or (accepted_sign is not None and viewer_sign == accepted_sign)
                or role in DETAIL_ROLES
            )
        ),
    }


def _fetch(conn, request_id: str) -> dict[str, Any]:
    try:
        parsed = uuid.UUID(str(request_id))
    except (TypeError, ValueError) as exc:
        raise HelpNotFound("Help request not found") from exc
    row = conn.execute(
        """
        SELECT h.*, r.call_sign AS requester_call_sign, a.call_sign AS accepted_call_sign
        FROM help_requests h
        JOIN crew_members r ON r.id = h.requester_crew_id
        LEFT JOIN crew_members a ON a.id = h.accepted_by_crew_id
        WHERE h.id = %s
        """,
        (parsed,),
    ).fetchone()
    if row is None:
        raise HelpNotFound("Help request not found")
    return row


def _validate_role(role: str) -> str:
    if role not in ROLES:
        raise HelpValidation(f"Unknown role: {role}")
    return role


def create_request(
    conn,
    *,
    requester: str,
    module: str,
    reason_code: str,
    reason_text: str | None = None,
    severity: str = "assist",
) -> dict[str, Any]:
    role = "self"
    _validate_role(role)
    sign = (requester or "").strip().upper()
    requester_id = _crew_id(conn, sign)
    if requester_id is None:
        raise HelpNotFound(f"Crew member {sign or requester} not found")
    if reason_code not in REASON_CODES:
        raise HelpValidation("Reason code is not supported")
    if severity not in ("assist", "emergency"):
        raise HelpValidation("Severity must be assist or emergency")
    clean_module = (module or "").strip()
    if not clean_module or len(clean_module) > 40:
        raise HelpValidation("Module must have 1 to 40 characters")
    clean_text = (reason_text or "").strip() or None
    if clean_text is not None and len(clean_text) > 300:
        raise HelpValidation("Reason text is limited to 300 characters")

    existing = conn.execute(
        """
        SELECT id FROM help_requests
        WHERE requester_crew_id = %s AND status IN ('requested', 'accepted', 'escalated')
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (requester_id,),
    ).fetchone()
    if existing is not None:
        raise HelpConflict("You already have an open help request")

    now = _now()
    request_id = uuid.uuid4()
    expires_at = now + timedelta(seconds=timeout_seconds())
    conn.execute(
        """
        INSERT INTO help_requests (
            id, requester_crew_id, requester_module, reason_code, reason_text,
            severity, status, created_at, expires_at
        ) VALUES (%s, %s, %s, %s, %s, %s, 'requested', %s, %s)
        """,
        (request_id, requester_id, clean_module, reason_code, clean_text, severity, now, expires_at),
    )
    row = _fetch(conn, str(request_id))
    return _project(row, viewer_sign=sign, role=role)


def list_requests(conn, *, viewer: str | None = None, role: str = "self") -> dict[str, Any]:
    role = _validate_role(role)
    viewer_sign = (viewer or "").strip().upper() or None
    now = _now()
    rows = conn.execute(
        """
        SELECT h.*, r.call_sign AS requester_call_sign, a.call_sign AS accepted_call_sign
        FROM help_requests h
        JOIN crew_members r ON r.id = h.requester_crew_id
        LEFT JOIN crew_members a ON a.id = h.accepted_by_crew_id
        WHERE h.status IN ('requested', 'accepted', 'escalated')
        ORDER BY h.created_at DESC
        LIMIT 12
        """
    ).fetchall()
    open_items = [
        _project(row, viewer_sign=viewer_sign, role=role)
        for row in rows
        if _effective_status(row, now) in ACTIVE_STATUSES
    ]
    mine = None
    if viewer_sign is not None:
        owner_rows = conn.execute(
            """
            SELECT h.*, r.call_sign AS requester_call_sign, a.call_sign AS accepted_call_sign
            FROM help_requests h
            JOIN crew_members r ON r.id = h.requester_crew_id
            LEFT JOIN crew_members a ON a.id = h.accepted_by_crew_id
            WHERE r.call_sign = %s
            ORDER BY h.created_at DESC
            LIMIT 1
            """,
            (viewer_sign,),
        ).fetchall()
        if owner_rows:
            mine = _project(owner_rows[0], viewer_sign=viewer_sign, role=role)
    waiting = sum(1 for item in open_items if item["status"] in ("requested", "escalated"))
    accepted = sum(1 for item in open_items if item["status"] == "accepted")
    return {
        "server_time": now.isoformat(),
        "timeout_seconds": timeout_seconds(),
        "open": open_items,
        "mine": mine,
        "counts": {
            "open": len(open_items),
            "waiting": waiting,
            "accepted": accepted,
        },
    }


def accept_request(conn, *, request_id: str, crew: str) -> dict[str, Any]:
    row = _fetch(conn, request_id)
    sign = (crew or "").strip().upper()
    crew_id = _crew_id(conn, sign)
    if crew_id is None:
        raise HelpNotFound(f"Crew member {sign or crew} not found")
    status = _effective_status(row, _now())
    if status not in ("requested", "escalated"):
        raise HelpConflict("This request is no longer open")
    if sign == row["requester_call_sign"]:
        raise HelpValidation("You cannot accept your own request")
    now = _now()
    conn.execute(
        """
        UPDATE help_requests
        SET status = 'accepted', accepted_by_crew_id = %s, accepted_at = %s
        WHERE id = %s
        """,
        (crew_id, now, row["id"]),
    )
    updated = _fetch(conn, request_id)
    return _project(updated, viewer_sign=sign, role="self")


def close_request(conn, *, request_id: str, crew: str, role: str = "self") -> dict[str, Any]:
    role = _validate_role(role)
    row = _fetch(conn, request_id)
    sign = (crew or "").strip().upper()
    if _crew_id(conn, sign) is None:
        raise HelpNotFound(f"Crew member {sign or crew} not found")
    if row["status"] == "closed":
        raise HelpConflict("This request is already closed")
    allowed = (
        sign == row["requester_call_sign"]
        or sign == row["accepted_call_sign"]
        or role in DETAIL_ROLES
    )
    if not allowed:
        raise HelpValidation("Only the requester, the responder or the CMO can close this request")
    conn.execute(
        "UPDATE help_requests SET status = 'closed', closed_at = %s WHERE id = %s",
        (_now(), row["id"]),
    )
    updated = _fetch(conn, request_id)
    return _project(updated, viewer_sign=sign, role=role)


def get_request(conn, *, request_id: str, viewer: str | None = None, role: str = "self") -> dict[str, Any]:
    role = _validate_role(role)
    row = _fetch(conn, request_id)
    viewer_sign = (viewer or "").strip().upper() or None
    return _project(row, viewer_sign=viewer_sign, role=role)
