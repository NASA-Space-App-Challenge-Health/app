"""Illustrative health-indicator catalog.

Bands are Earth-reference windows for this demonstration. They are not
flight-surgeon limits, not individualized, and not a diagnosis.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


class IndicatorError(ValueError):
    """A reading cannot be stored because the indicator or value is invalid."""


DISCLAIMER = (
    "Educational demonstration for the NASA Space Apps Challenge 2026. "
    "Inspiration4 CBC/CMP values, ISS DosTel dose rates, and 2024 DONKI SEP "
    "events are real NASA open data and are labeled real. Heart rate, sleep, "
    "cortisol, hydration, and hygiene timing are simulated and labeled "
    "simulated. Nothing here is a diagnosis or a flight-surgeon limit."
)

MISSION = "Demonstration mission"


def _bands(
    *,
    nominal_low: float,
    nominal_high: float,
    watch_low: float,
    watch_high: float,
):
    def classify(value: float) -> str:
        if nominal_low <= value <= nominal_high:
            return "nominal"
        if watch_low <= value <= watch_high:
            return "watch"
        return "concern"

    return classify


def _messages(subject: str, watch: str) -> dict[str, str]:
    return {
        "nominal": (
            f"{subject} is inside the illustrative nominal band. Log it and "
            "continue the scheduled monitoring cadence."
        ),
        "watch": watch,
        "concern": (
            f"{subject} is outside the illustrative watch band. Pause "
            "noncritical work, recheck the measurement, and contact the "
            "flight surgeon now. Follow the mission medical checklist. "
            "This screen is not a diagnosis. Do not start or change "
            "medication on your own."
        ),
    }


@dataclass(frozen=True)
class Indicator:
    key: str
    label: str
    group: str
    unit: str
    decimals: int
    explanation: str
    physical: tuple[float, float]
    guidance: dict[str, str]
    classify: object

    def to_public(self) -> dict[str, object]:
        return {
            "key": self.key,
            "label": self.label,
            "group": self.group,
            "unit": self.unit,
            "decimals": self.decimals,
            "explanation": self.explanation,
        }


def _indicator(**kwargs: object) -> Indicator:
    return Indicator(**kwargs)  # type: ignore[arg-type]


INDICATORS: tuple[Indicator, ...] = (
    _indicator(
        key="heart_rate",
        label="Heart rate",
        group="Vitals",
        unit="bpm",
        decimals=0,
        explanation=(
            "How often the heart beats each minute. Rest often sits near "
            "50–100 beats per minute; exercise, stress, and spaceflight move it."
        ),
        physical=(20, 250),
        guidance=_messages(
            "Heart rate",
            "Recheck after two quiet minutes. Note exercise, caffeine, and "
            "workload, and tell the flight surgeon on the next medical pass.",
        ),
        classify=_bands(nominal_low=50, nominal_high=100, watch_low=40, watch_high=130),
    ),
    _indicator(
        key="spo2",
        label="Oxygen saturation",
        group="Vitals",
        unit="%",
        decimals=0,
        explanation=(
            "Estimate of how much oxygen the blood is carrying. Cabin air, "
            "workload, and a loose sensor can all move this percent."
        ),
        physical=(50, 100),
        guidance=_messages(
            "Oxygen saturation",
            "Recheck the sensor fit. Stay seated or stabilized, breathe "
            "normally, and tell the flight surgeon if the value stays here.",
        ),
        classify=_bands(nominal_low=95, nominal_high=100, watch_low=92, watch_high=100),
    ),
    _indicator(
        key="cabin_co2_mmhg",
        label="Cabin carbon dioxide",
        group="Vitals",
        unit="mmHg",
        decimals=2,
        explanation=(
            "Simulated suit-cabin carbon dioxide partial pressure. "
            "NASA-STD-3001 Volume 2 [V2 6004], as stated in OCHMO-TB-004, "
            "limits the average one-hour cabin CO2 to no more than 3 mmHg "
            "(about 0.39% at 760 mmHg). One sample is not that one-hour average."
        ),
        physical=(0, 40),
        guidance=_messages(
            "Cabin carbon dioxide",
            "This sample is near the one-hour habitat limit. It is simulated suit air, "
            "not a diagnosis. Tell the CMO. The whole crew is not paged for this.",
        ),
        classify=_bands(nominal_low=0, nominal_high=3, watch_low=0, watch_high=3),
    ),
    _indicator(
        key="temperature_c",
        label="Body temperature",
        group="Vitals",
        unit="°C",
        decimals=1,
        explanation=(
            "Body temperature in degrees Celsius. A rising or falling "
            "temperature is worth reporting even when other vitals look calm."
        ),
        physical=(30, 43),
        guidance=_messages(
            "Temperature",
            "Recheck with the same method. Note chills, flushing, or recent "
            "exercise, and include the value on the next medical pass.",
        ),
        classify=_bands(nominal_low=36.1, nominal_high=37.5, watch_low=35.0, watch_high=38.3),
    ),
    _indicator(
        key="systolic_bp",
        label="Systolic blood pressure",
        group="Vitals",
        unit="mmHg",
        decimals=0,
        explanation=(
            "The higher blood-pressure number, when the heart contracts, "
            "in millimeters of mercury."
        ),
        physical=(50, 250),
        guidance=_messages(
            "Systolic pressure",
            "Recheck after a few quiet minutes. Note caffeine, salt, and "
            "how the cuff was worn, and tell the flight surgeon on the next pass.",
        ),
        classify=_bands(nominal_low=90, nominal_high=129, watch_low=80, watch_high=159),
    ),
    _indicator(
        key="diastolic_bp",
        label="Diastolic blood pressure",
        group="Vitals",
        unit="mmHg",
        decimals=0,
        explanation=(
            "The lower blood-pressure number, when the heart rests between "
            "beats, in millimeters of mercury."
        ),
        physical=(30, 150),
        guidance=_messages(
            "Diastolic pressure",
            "Recheck with the cuff at heart level. Report dizziness or a "
            "persistent change to the flight surgeon.",
        ),
        classify=_bands(nominal_low=60, nominal_high=84, watch_low=50, watch_high=99),
    ),
    _indicator(
        key="blood_glucose",
        label="Blood glucose",
        group="Blood glucose",
        unit="mg/dL",
        decimals=0,
        explanation=(
            "Sugar in the blood, in milligrams per deciliter. Meals, "
            "exercise, illness, and some medicines move it."
        ),
        physical=(20, 600),
        guidance=_messages(
            "Blood glucose",
            "Recheck with a clean sample. Note the last meal, exercise, and "
            "fluids. Tell the flight surgeon on the next medical pass. Do "
            "not change any medication on your own.",
        ),
        classify=_bands(nominal_low=70, nominal_high=140, watch_low=54, watch_high=199),
    ),
    _indicator(
        key="wbc",
        label="White blood cells",
        group="Blood counts",
        unit="10^9/L",
        decimals=1,
        explanation=(
            "White blood cells, which respond to infection and stress, "
            "in billions per liter."
        ),
        physical=(0.1, 50),
        guidance=_messages(
            "White-cell count",
            "Repeat on the next scheduled blood draw. Note fever, sore "
            "throat, or unusual fatigue to the flight surgeon.",
        ),
        classify=_bands(nominal_low=4.0, nominal_high=11.0, watch_low=3.0, watch_high=15.0),
    ),
    _indicator(
        key="rbc",
        label="Red blood cells",
        group="Blood counts",
        unit="10^12/L",
        decimals=1,
        explanation="Red blood cells, which carry oxygen, in trillions per liter.",
        physical=(1, 9),
        guidance=_messages(
            "Red-cell count",
            "Repeat on the next scheduled blood draw and compare with "
            "hemoglobin. Tell the flight surgeon if you feel unusually weak.",
        ),
        classify=_bands(nominal_low=4.0, nominal_high=5.8, watch_low=3.5, watch_high=6.5),
    ),
    _indicator(
        key="hemoglobin",
        label="Hemoglobin",
        group="Blood counts",
        unit="g/dL",
        decimals=1,
        explanation=(
            "The oxygen-carrying protein in red blood cells, in grams per "
            "deciliter. Fluid shifts in space can change the number."
        ),
        physical=(3, 25),
        guidance=_messages(
            "Hemoglobin",
            "Recheck on the next scheduled blood count. Note fatigue, "
            "dizziness, or unusual shortness of breath to the flight surgeon. "
            "Do not start supplements or medication on your own.",
        ),
        classify=_bands(nominal_low=12.0, nominal_high=17.5, watch_low=10.0, watch_high=18.5),
    ),
    _indicator(
        key="platelets",
        label="Platelets",
        group="Blood counts",
        unit="10^9/L",
        decimals=0,
        explanation="Cell fragments that help blood clot, in billions per liter.",
        physical=(5, 1500),
        guidance=_messages(
            "Platelet count",
            "Repeat on the next scheduled blood draw. Report easy bruising "
            "or bleeding to the flight surgeon. Avoid new medications unless "
            "the flight surgeon directs it.",
        ),
        classify=_bands(nominal_low=150, nominal_high=450, watch_low=100, watch_high=600),
    ),
    _indicator(
        key="radiation_dose_msv",
        label="Radiation dose",
        group="Radiation",
        unit="mSv",
        decimals=1,
        explanation=(
            "Illustrative cumulative mission dose in millisieverts. Real "
            "limits depend on the person, the vehicle, and the flight plan. "
            "This demo does not read a live dosimeter."
        ),
        physical=(0, 5000),
        guidance=_messages(
            "Cumulative dose",
            "Confirm the number with the radiation officer. Limit "
            "nonessential time in thinly shielded areas until the flight "
            "surgeon and radiation console review it.",
        ),
        classify=_bands(nominal_low=0, nominal_high=50, watch_low=0, watch_high=200),
    ),
    _indicator(
        key="sleep_hours",
        label="Sleep",
        group="Simulated vitals",
        unit="h",
        decimals=1,
        explanation=(
            "Simulated hours asleep. The public Inspiration4 tables in this "
            "repo do not include a sleep series."
        ),
        physical=(0, 18),
        guidance=_messages(
            "Sleep",
            "Protect the next sleep period and tell a crewmate if this is a run of short nights.",
        ),
        classify=_bands(nominal_low=6, nominal_high=9, watch_low=4, watch_high=11),
    ),
    _indicator(
        key="cortisol_ug_dl",
        label="Cortisol",
        group="Simulated vitals",
        unit="μg/dL",
        decimals=1,
        explanation=(
            "Simulated morning cortisol estimate. It is not an OSD-575 assay "
            "and the cutoff in the rules file is an app setting."
        ),
        physical=(0, 80),
        guidance=_messages(
            "Cortisol",
            "This is a simulated trend. Ask a crewmate to check in if sleep is short too.",
        ),
        classify=_bands(nominal_low=5, nominal_high=18, watch_low=3, watch_high=28),
    ),
    _indicator(
        key="hydration_liters",
        label="Hydration",
        group="Simulated vitals",
        unit="L",
        decimals=1,
        explanation=(
            "Simulated recent fluid intake, used only to estimate hygiene-station "
            "timing. Not a measured urine volume."
        ),
        physical=(0, 8),
        guidance=_messages(
            "Hydration",
            "Note fluids on the next check. This estimate also feeds the hygiene-station suggestion.",
        ),
        classify=_bands(nominal_low=2, nominal_high=3.5, watch_low=1.5, watch_high=5),
    ),
    _indicator(
        key="hygiene_hour",
        label="Hygiene window",
        group="Simulated vitals",
        unit="h",
        decimals=2,
        explanation=(
            "Simulated clock hour for a hygiene-station visit. It is an estimate, "
            "not a recorded bathroom event."
        ),
        physical=(0, 23.99),
        guidance=_messages(
            "Hygiene timing",
            "If two estimates overlap, one person should go now. The time is an estimate.",
        ),
        classify=_bands(nominal_low=0, nominal_high=23.99, watch_low=0, watch_high=23.99),
    ),
    _indicator(
        key="impact_event",
        label="Impact flag",
        group="Simulated vitals",
        unit="flag",
        decimals=0,
        explanation=(
            "1 means a simulated or uploaded fall/impact flag. No public "
            "Inspiration4 fall series is in this package."
        ),
        physical=(0, 1),
        guidance=_messages(
            "Impact",
            "If this flag is set, a crewmate should check for injury and call the flight surgeon.",
        ),
        classify=_bands(nominal_low=0, nominal_high=0, watch_low=0, watch_high=0),
    ),
)

_BY_KEY = {item.key: item for item in INDICATORS}


def get_indicator(key: str) -> Indicator | None:
    return _BY_KEY.get(key)


def validate_reading(indicator: str, value: object) -> float:
    spec = get_indicator(indicator)
    if spec is None:
        raise IndicatorError(f"Unknown indicator: {indicator}")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise IndicatorError("Value must be a number")
    numeric = float(value)
    if not math.isfinite(numeric):
        raise IndicatorError("Value must be a finite number")
    low, high = spec.physical
    if numeric < low or numeric > high:
        raise IndicatorError(
            f"{spec.label} must be between {low:g} and {high:g} {spec.unit}"
        )
    return numeric


def classify(indicator: str, value: float) -> str:
    spec = get_indicator(indicator)
    if spec is None:
        raise IndicatorError(f"Unknown indicator: {indicator}")
    band = spec.classify(value)
    if band not in {"nominal", "watch", "concern"}:
        raise IndicatorError(f"Unhandled band for {indicator}")
    return band


def guidance_for(indicator: str, band: str) -> str:
    spec = get_indicator(indicator)
    if spec is None or band not in spec.guidance:
        raise IndicatorError(f"No guidance for {indicator} ({band})")
    return spec.guidance[band]


def worst_band(bands: list[str]) -> str | None:
    rank = {"nominal": 0, "watch": 1, "concern": 2}
    present = [band for band in bands if band in rank]
    if not present:
        return None
    return max(present, key=rank.__getitem__)
