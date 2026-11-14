"""One-station hygiene estimate. Times are simulated, not a vehicle schedule."""

from __future__ import annotations

from typing import Any


def plan_hygiene(members: list[dict[str, Any]], *, window_hours: float = 0.75) -> dict[str, Any]:
    """Suggest an order when estimated hygiene windows overlap.

    ``hygiene_hour`` is a simulated clock hour. Lower recent hydration is asked
    to go first. Callers hide hydration numbers for alerts-only members.
    """
    usable = [item for item in members if item.get("hygiene_hour") is not None]
    usable.sort(key=lambda item: (float(item["hygiene_hour"]), item["crew_id"]))
    overlaps: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for left, right in zip(usable, usable[1:]):
        gap = abs(float(left["hygiene_hour"]) - float(right["hygiene_hour"]))
        gap = min(gap, 24 - gap)
        if gap <= window_hours:
            overlaps.append((left, right))
    if not overlaps:
        return {
            "station": "Hygiene station",
            "origin": "simulated",
            "suggestion": "No overlapping hygiene estimates. These times are estimates, not a vehicle schedule.",
            "order": [item["crew_id"] for item in usable],
            "conflicts": [],
        }
    involved = {}
    for left, right in overlaps:
        involved[left["crew_id"]] = left
        involved[right["crew_id"]] = right
    ordered = sorted(
        involved.values(),
        key=lambda item: (float(item.get("hydration_liters") or 99), float(item["hygiene_hour"])),
    )
    first = ordered[0]
    rest = [item["crew_id"] for item in ordered[1:]]
    suggestion = (
        f"Estimate: {first['crew_id']} should use the single hygiene station now. "
        f"{', '.join(rest)} can wait about 45 minutes. "
        f"The order prefers the lower recent fluid-intake estimate. "
        f"These windows are simulated estimates, not measured bathroom events."
    )
    return {
        "station": "Hygiene station",
        "origin": "simulated",
        "suggestion": suggestion,
        "order": [item["crew_id"] for item in ordered],
        "conflicts": [
            {"crew_ids": [left["crew_id"], right["crew_id"]], "hours_apart": round(abs(float(left["hygiene_hour"]) - float(right["hygiene_hour"])), 2)}
            for left, right in overlaps
        ],
    }
