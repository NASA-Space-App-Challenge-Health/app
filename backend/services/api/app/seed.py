"""De-identified Inspiration4 crew ids plus simulated vitals.

Real labs, DosTel rates, and DONKI events are loaded from data/*.csv.
Heart rate, sleep, cortisol, hydration, and hygiene timing are simulated
because those series are not in the public tables. C002's sleep and cortisol
are low and high enough to fire the simulated preventive rule.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

GROUP_ID = UUID("a0000000-0000-4000-8000-000000000001")
GROUP_NAME = "Inspiration4 open data"
GROUP_KIND = "crew"

# Previous fictional demo people. Removed when this seed is applied.
RETIRED_DEMO_IDS = (
    UUID("11111111-1111-4111-8111-111111111111"),
    UUID("22222222-2222-4222-8222-222222222222"),
    UUID("33333333-3333-4333-8333-333333333333"),
    UUID("44444444-4444-4444-8444-444444444444"),
)


def _id(suffix: str) -> UUID:
    return UUID(f"c00{suffix}0000-0000-4000-8000-00000000000{suffix}")


def _series(indicator: str, values: tuple[float, ...]) -> tuple[tuple[str, float, int], ...]:
    # hours_ago, oldest first so the last value is the latest.
    span = len(values)
    return tuple((indicator, value, (span - index) * 8) for index, value in enumerate(values, start=1))


SEED_CREW: tuple[dict[str, object], ...] = (
    {
        "id": _id("1"),
        "call_sign": "C001",
        "full_name": "Crew C001",
        "role": "Inspiration4 crew, de-identified",
        "share_mode": "full",
        "readings": (
            _series("heart_rate", (70, 72, 68, 74))
            + _series("sleep_hours", (7.4, 7.6, 7.2, 7.5))
            + _series("cortisol_ug_dl", (12, 11, 13, 12))
            + _series("hydration_liters", (2.7, 2.9, 2.8, 2.8))
            + (("hygiene_hour", 6.5, 1),)
            + (("spo2", 98, 2), ("temperature_c", 36.6, 2))
        ),
    },
    {
        "id": _id("2"),
        "call_sign": "C002",
        "full_name": "Crew C002",
        "role": "Inspiration4 crew, de-identified",
        "share_mode": "full",
        "readings": (
            _series("heart_rate", (76, 80, 78, 77))
            + _series("sleep_hours", (5.1, 4.9, 5.4))
            + _series("cortisol_ug_dl", (21, 23, 19))
            + _series("hydration_liters", (2.3, 2.2, 2.4))
            + (("hygiene_hour", 7.0, 1),)
            + (("spo2", 97, 2), ("temperature_c", 36.7, 2))
        ),
    },
    {
        "id": _id("3"),
        "call_sign": "C003",
        "full_name": "Crew C003",
        "role": "Inspiration4 crew, de-identified",
        "share_mode": "full",
        "readings": (
            _series("heart_rate", (66, 71, 69, 73))
            + _series("sleep_hours", (7.1, 6.9, 7.4, 7.0))
            + _series("cortisol_ug_dl", (13, 12, 14, 13))
            + _series("hydration_liters", (2.5, 2.6, 2.4, 2.5))
            + (("hygiene_hour", 21.0, 1),)
            + (("spo2", 98, 2), ("temperature_c", 36.5, 2))
        ),
    },
    {
        "id": _id("4"),
        "call_sign": "C004",
        "full_name": "Crew C004",
        "role": "Inspiration4 crew, de-identified",
        "share_mode": "alerts_only",
        "readings": (
            _series("heart_rate", (74, 75, 73, 76))
            + _series("sleep_hours", (6.6, 6.4, 6.8, 6.5))
            + _series("cortisol_ug_dl", (15, 14, 16, 15))
            + _series("hydration_liters", (1.9, 1.7, 1.8))
            + (("hygiene_hour", 7.25, 1),)
            + (("spo2", 97, 2), ("temperature_c", 36.6, 2))
        ),
    },
)


def recorded_at(hours_ago: int, *, now: datetime | None = None) -> datetime:
    current = now or datetime.now(timezone.utc)
    return current - timedelta(hours=hours_ago)
