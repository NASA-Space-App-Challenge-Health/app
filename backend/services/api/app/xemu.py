"""Store one simulated xEMU sample in Postgres.

The generator is ler_sensores_traje(), moved from backend/mock_sensors.py.
Cabin carbon dioxide is judged against NASA-STD-3001 Volume 2 Rev D [V2 6004]:
the average one-hour partial pressure in the habitable volume is no more than
3 mmHg. OCHMO-TB-004 states that requirement
(https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/).
3 mmHg is about 0.39% of 760 mmHg. The generator's 0.5% note is not this limit.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.guidance import classify, get_indicator, validate_reading
from app.rules_engine import load_rules
from app.xemu_sensors import ler_sensores_traje

CO2_LIMIT_MMHG = 3.0
CO2_LIMIT_PERCENT = CO2_LIMIT_MMHG / 760.0 * 100.0
CO2_SOURCE = {
    "standard": "NASA-STD-3001 Volume 2 Rev D [V2 6004]",
    "url": "https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/",
    "title": "OCHMO-TB-004 Carbon Dioxide",
}


def percent_to_mmhg(percent: float) -> float:
    return float(percent) / 100.0 * 760.0


def _sensors():
    return ler_sensores_traje()


def interpret(sample: dict[str, Any], rules: dict[str, Any] | None = None) -> dict[str, Any]:
    rules = rules or load_rules()
    hr = float(sample["fc_bpm"])
    spo2 = float(sample["spo2"])
    percent = float(sample["co2_percentual"])
    mmhg = round(percent_to_mmhg(percent), 2)
    hr_spec = rules["emergency"]["heart_rate"]
    hr_emergency = hr < float(hr_spec["low"]) or hr > float(hr_spec["high"])
    over_co2 = mmhg > CO2_LIMIT_MMHG
    return {
        "origin": "simulated",
        "label": (
            "Simulated xEMU suit sensors (heart rate, oxygen, carbon dioxide). "
            "Not a NASA measurement and not a diagnosis."
        ),
        "heart_rate_bpm": hr,
        "spo2_percent": spo2,
        "co2_percent": percent,
        "co2_mmhg": mmhg,
        "co2_above_habitat_limit": over_co2,
        "co2_limit_mmhg": CO2_LIMIT_MMHG,
        "co2_limit_percent_at_760": round(CO2_LIMIT_PERCENT, 2),
        "heart_rate_emergency": hr_emergency,
        "source": CO2_SOURCE,
        "plain": _plain(hr, spo2, mmhg, over_co2, hr_emergency, hr_spec),
        "broadcast": _broadcast(hr_emergency, hr_spec),
    }


def _plain(hr: float, spo2: float, mmhg: float, over_co2: bool, hr_emergency: bool, hr_spec: dict) -> dict[str, str]:
    if hr_emergency:
        heart = (
            f"Simulated heart rate is {hr:g} beats per minute, outside the app window "
            f"{hr_spec['low']:g}–{hr_spec['high']:g}. The crew notice does not include the number."
        )
        who = "The whole crew gets a short notice that someone needs help. The number stays with the CMO and the flight surgeon."
    else:
        heart = f"Simulated heart rate is {hr:g} beats per minute, inside the app window {hr_spec['low']:g}–{hr_spec['high']:g}."
        who = "You and the crew medical officer can see these suit numbers. They are not announced to the whole crew."
    air = (
        f"Simulated cabin carbon dioxide is {mmhg:g} mmHg ({CO2_LIMIT_PERCENT:.2f}% is about the 3 mmHg line at sea-level pressure). "
        "NASA limits the average of one hour to no more than 3 mmHg. This is one sample, not that average."
        if not over_co2
        else (
            f"Simulated cabin carbon dioxide is {mmhg:g} mmHg, above the one-hour habitat limit of 3 mmHg. "
            "Tell the CMO. This is suit air, not a diagnosis, and it is not a crew-wide page."
        )
    )
    oxygen = (
        f"Simulated oxygen on the suit sensor is {spo2:g}%. "
        + ("Ask the CMO to look if it stays under 95." if spo2 < 95 else "That is in the usual demo range.")
    )
    return {
        "title": "Simulated suit check" if not over_co2 else "Simulated cabin carbon dioxide is above the one-hour limit",
        "what_it_means": " ".join((heart, oxygen, air)),
        "why_it_matters_in_space": (
            "OCHMO-TB-004 quotes NASA-STD-3001: the habitat shall keep the average one-hour "
            "carbon dioxide partial pressure at no more than 3 mmHg. "
            "A closed cabin can push that number up. Heart rate and oxygen here are simulated."
        ),
        "what_to_do": (
            "Follow procedures."
            if hr_emergency
            else "Keep the planned air and exercise routine. Tell the CMO about a high carbon dioxide sample. Do not treat this as a diagnosis."
        ),
        "who_is_notified": who,
    }


def _broadcast(hr_emergency: bool, hr_spec: dict) -> dict[str, Any] | None:
    if not hr_emergency:
        return None
    return {
        "tier": "emergency",
        "broadcast": True,
        "title": hr_spec["public_title"],
        "detail": hr_spec["public_detail"],
        "origin": "simulated",
    }


def record_sample(conn, call_sign: str, sample: dict[str, Any] | None = None) -> dict[str, Any]:
    from app.repository import NotFoundError

    sign = call_sign.strip().upper()
    member = conn.execute(
        "SELECT id, call_sign FROM crew_members WHERE call_sign = %s",
        (sign,),
    ).fetchone()
    if member is None:
        raise NotFoundError("Crew member not found")
    reading = sample or _sensors()
    summary = interpret(reading)
    now = datetime.now(timezone.utc)
    stored = []
    for key, value in (
        ("heart_rate", summary["heart_rate_bpm"]),
        ("spo2", summary["spo2_percent"]),
        ("cabin_co2_mmhg", summary["co2_mmhg"]),
    ):
        numeric = validate_reading(key, value)
        spec = get_indicator(key)
        band = classify(key, numeric)
        reading_id = uuid.uuid4()
        conn.execute(
            """
            INSERT INTO health_readings (
                id, crew_member_id, indicator, value_numeric, unit,
                recorded_at, source, risk_band, origin
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'simulated', %s, 'simulated')
            """,
            (reading_id, member["id"], key, numeric, spec.unit, now, band),
        )
        stored.append({
            "id": str(reading_id),
            "indicator": key,
            "value": numeric,
            "unit": spec.unit,
            "risk_band": band,
            "origin": "simulated",
            "source": "simulated",
        })
    summary["crew_id"] = member["call_sign"]
    summary["readings"] = stored
    return summary
