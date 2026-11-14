"""Who may see a finding. Demo roles are not a login.

OCHMO-TB-044: Privacy Act protections, private PMC/PPC, two CMOs per increment,
and the crew surgeon tells the commander only if a condition may affect mission ops.
"""

from __future__ import annotations

from typing import Any

ROLES = ("self", "cmo", "flight_surgeon", "crewmate", "commander")


def project_finding(
    item: dict[str, Any],
    *,
    role: str,
    viewer: str | None,
    shares: dict[str, set[str]] | None = None,
) -> dict[str, Any] | None:
    """Return the slice of a finding this role may see, or None."""
    if role not in ROLES:
        raise ValueError(f"Unknown role: {role}")
    if item.get("broadcast") and item.get("tier") != "emergency":
        raise ValueError("Only an emergency tier may broadcast")
    shares = shares or {}
    subject = item.get("crew_id")
    tier = item.get("tier") or "cmo"

    if tier == "emergency" and item.get("broadcast"):
        return _emergency_view(item, role, viewer, subject)

    if role == "commander":
        if item.get("mission_impact"):
            return _commander_flag(item)
        return None
    if role == "flight_surgeon":
        return _clinical(item)
    if role == "cmo" and tier in {"self", "cmo"}:
        return _clinical(item)
    if role == "self" and _is_subject(viewer, subject):
        return _clinical(item)
    if (
        role == "crewmate"
        and tier == "cmo"
        and subject
        and item.get("indicator") in shares.get(subject, set())
    ):
        shared = _clinical(item)
        shared["shared_by_opt_in"] = True
        return shared
    return None


def broadcasts(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Crew-wide notices. Generic text only."""
    notes = []
    for item in items:
        if item.get("tier") != "emergency" or not item.get("broadcast"):
            continue
        notes.append({
            "id": item["id"],
            "tier": "emergency",
            "broadcast": True,
            "origin": item.get("origin"),
            "title": item.get("public_title") or "Follow procedures",
            "detail": item.get("public_detail") or "Follow procedures. No diagnosis is included.",
            "suggested_action": "Follow procedures.",
            "sources": item.get("sources") or [],
            "mission_impact": bool(item.get("mission_impact")),
        })
    return notes


def _emergency_view(item, role, viewer, subject) -> dict[str, Any]:
    if role in {"cmo", "flight_surgeon"} or (role == "self" and _is_subject(viewer, subject)):
        full = _clinical(item)
        full["broadcast"] = True
        full["public_title"] = item.get("public_title")
        return full
    if role == "commander":
        return {
            "id": item["id"],
            "tier": "emergency",
            "broadcast": True,
            "severity": item.get("severity") or "critical",
            "origin": item.get("origin"),
            "title": item.get("public_title"),
            "detail": item.get("public_detail"),
            "suggested_action": "Follow procedures.",
            "sources": item.get("sources") or [],
            "mission_impact": True,
            "commander_note": "Condition may impact mission ops.",
            "evidence": None,
            "crew_id": None,
        }
    return {
        "id": item["id"],
        "tier": "emergency",
        "broadcast": True,
        "severity": item.get("severity") or "critical",
        "origin": item.get("origin"),
        "title": item.get("public_title"),
        "detail": item.get("public_detail"),
        "suggested_action": "Follow procedures.",
        "sources": item.get("sources") or [],
        "mission_impact": bool(item.get("mission_impact")),
        "evidence": None,
        "crew_id": None,
    }


def _clinical(item: dict[str, Any]) -> dict[str, Any]:
    shown = dict(item)
    shown["broadcast"] = bool(item.get("broadcast")) and item.get("tier") == "emergency"
    return shown


def _commander_flag(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item["id"],
        "tier": item.get("tier"),
        "broadcast": False,
        "origin": item.get("origin"),
        "title": "Condition may impact mission ops",
        "detail": "The flight surgeon flagged a condition that may affect the timeline. No diagnosis is shown.",
        "suggested_action": "Coordinate with the flight surgeon. Do not expect a diagnosis here.",
        "sources": item.get("sources") or [],
        "commander_note": "Condition may impact mission ops.",
        "mission_impact": True,
        "evidence": None,
        "crew_id": None,
    }


def _is_subject(viewer: str | None, subject: str | None) -> bool:
    if subject is None:
        return True
    return bool(viewer) and viewer.upper() == str(subject).upper()
