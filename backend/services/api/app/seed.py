"""Fictional crew and simulated readings inserted when a member has none."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.guidance import MISSION

# Fixed ids keep the demo stable across restarts. Names are fictional.
SEED_CREW: tuple[dict[str, object], ...] = (
    {
        "id": UUID("11111111-1111-4111-8111-111111111111"),
        "call_sign": "OKONKWO",
        "full_name": "Amara Okonkwo",
        "role": "Commander",
        "mission": MISSION,
        "readings": (
            ("heart_rate", 68, 2),
            ("spo2", 98, 2),
            ("temperature_c", 36.6, 2),
            ("systolic_bp", 116, 2),
            ("diastolic_bp", 74, 2),
            ("blood_glucose", 92, 3),
            ("wbc", 6.1, 8),
            ("rbc", 4.8, 8),
            ("hemoglobin", 14.2, 8),
            ("platelets", 230, 8),
            ("radiation_dose_msv", 18.4, 1),
        ),
    },
    {
        "id": UUID("22222222-2222-4222-8222-222222222222"),
        "call_sign": "OKADA",
        "full_name": "Ren Okada",
        "role": "Pilot",
        "mission": MISSION,
        "readings": (
            ("heart_rate", 84, 1),
            ("spo2", 97, 1),
            ("temperature_c", 36.8, 1),
            ("systolic_bp", 124, 1),
            ("diastolic_bp", 78, 1),
            ("blood_glucose", 214, 1),
            ("wbc", 7.4, 7),
            ("rbc", 5.1, 7),
            ("hemoglobin", 15.0, 7),
            ("platelets", 260, 7),
            ("radiation_dose_msv", 24.0, 1),
        ),
    },
    {
        "id": UUID("33333333-3333-4333-8333-333333333333"),
        "call_sign": "VASQUEZ",
        "full_name": "Luz Vasquez",
        "role": "Science officer",
        "mission": MISSION,
        "readings": (
            ("heart_rate", 76, 4),
            ("spo2", 98, 4),
            ("temperature_c", 36.5, 4),
            ("systolic_bp", 108, 4),
            ("diastolic_bp", 70, 4),
            ("blood_glucose", 101, 5),
            ("wbc", 5.2, 9),
            ("rbc", 4.1, 9),
            ("hemoglobin", 11.1, 9),
            ("platelets", 128, 9),
            ("radiation_dose_msv", 31.0, 4),
        ),
    },
    {
        "id": UUID("44444444-4444-4444-8444-444444444444"),
        "call_sign": "CHEN",
        "full_name": "Mateo Chen",
        "role": "Mission specialist",
        "mission": MISSION,
        "readings": (
            ("heart_rate", 112, 1),
            ("spo2", 93, 1),
            ("temperature_c", 37.2, 1),
            ("systolic_bp", 138, 1),
            ("diastolic_bp", 88, 1),
            ("blood_glucose", 118, 2),
            ("wbc", 12.4, 6),
            ("rbc", 4.6, 6),
            ("hemoglobin", 13.6, 6),
            ("platelets", 190, 6),
            ("radiation_dose_msv", 86.0, 1),
        ),
    },
)


def recorded_at(hours_ago: int, *, now: datetime | None = None) -> datetime:
    current = now or datetime.now(timezone.utc)
    return current - timedelta(hours=hours_ago)
