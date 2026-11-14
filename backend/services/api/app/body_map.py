"""Clickable body regions. Citations are pages this project opened."""

from __future__ import annotations

from typing import Any

REGIONS = (
    {
        "id": "head",
        "label": "Head, brain, and inner ear",
        "function": "Orientation, thinking, and the vestibular system.",
        "why": "Weightlessness changes the signals the inner ear and brain use to judge direction and speed.",
        "spaceflight": "CSA describes confused perception and space sickness. OCHMO-TB-044 says motion sickness with adaptation lasts, on average, about 3 days. Behavioral notes stay in a private conference.",
        "prevention": "Use the space-sickness self-check early in a mission. Do not post mood or sleep comments on the crew board.",
        "indicators": ("space_sickness", "sleep_hours", "cortisol_ug_dl"),
        "sources": ("ochmo_tb_044", "csa_infographic", "hrp_hazards"),
    },
    {
        "id": "eyes",
        "label": "Eyes",
        "function": "Vision, including the lens.",
        "why": "The Canadian Space Agency infographic links higher radiation doses with cataract risk.",
        "spaceflight": "This panel shows the vehicle DosTel rate and the paired DONKI SEP notice. It is not a personal eye exam.",
        "prevention": "Follow the radiation contingency procedure. An eye symptom still goes to the CMO or flight surgeon, not the whole crew.",
        "indicators": ("radiation",),
        "sources": ("csa_infographic", "hrp_hazards", "radlab_api", "donki_sep_31338"),
    },
    {
        "id": "heart",
        "label": "Heart and vessels",
        "function": "Circulation and how vessels respond to demand.",
        "why": "CSA reports that vessels can stiffen and that astronauts can develop insulin resistance.",
        "spaceflight": "Heart rate here is simulated. Inspiration4 glucose is released research data from OSD-575, not a live finger-stick.",
        "prevention": "Log exercise. An out-of-range research glucose value goes to the CMO and flight surgeon, not a crew broadcast.",
        "indicators": ("heart_rate", "GLUCOSE"),
        "sources": ("csa_infographic", "hrp_hazards", "osd_575"),
    },
    {
        "id": "blood",
        "label": "Blood and immune system",
        "function": "Oxygen carrying, clotting, and defense against infection.",
        "why": "CSA notes less red-cell production can cause anemia, and a low white-cell count leaves someone more open to infection and more sensitive to radiation.",
        "spaceflight": "Inspiration4 CBC and CMP values are released research data. A potassium tip uses the reference range printed on the NASA row.",
        "prevention": "Recheck a worsening lab before the next draw. Tell the flight surgeon. Do not start supplements on your own.",
        "indicators": ("HEMOGLOBIN", "WHITE BLOOD CELL COUNT", "PLATELET COUNT", "POTASSIUM"),
        "sources": ("csa_infographic", "osd_569", "osd_575", "ochmo_tb_044"),
    },
    {
        "id": "muscles",
        "label": "Muscles",
        "function": "Strength, mass, and reflexes.",
        "why": "CSA says muscles lose mass and strength, reflexes slow, and exercise tends to be less effective in space.",
        "spaceflight": "An exercise note stands in for an ARED-style log. It is a crew entry, not a NASA measurement from this data package.",
        "prevention": "Keep the exercise countermeasure on the timeline. OCHMO lists exercise among in-flight countermeasures.",
        "indicators": ("exercise",),
        "sources": ("csa_infographic", "ochmo_tb_044", "hrp_hazards"),
    },
    {
        "id": "bones",
        "label": "Bones",
        "function": "Structure that normally bears weight.",
        "why": "CSA says bones that do not bear weight lose density. Adults past 50 often lose about 1% a year. Astronauts can lose up to 1.5% of bone mass a month.",
        "spaceflight": "This package has no bone-density scan. The panel is a prevention reminder, not a measured result.",
        "prevention": "Exercise and nutrition are the countermeasures named with this risk. Log them rather than guessing a bone number.",
        "indicators": (),
        "sources": ("csa_infographic", "hrp_hazards", "ochmo_tb_044"),
    },
    {
        "id": "environment",
        "label": "Whole body and environment",
        "function": "Radiation, noise, and the work outside the vehicle.",
        "why": "HRP calls space radiation one of the most hazardous parts of spaceflight. OCHMO requires a plan to notify the crew for an off-nominal radiation case, and acoustic monitoring with hearing protection.",
        "spaceflight": "DosTel and DONKI are real vehicle and space-weather records. A pre/post-EVA checklist follows the 15-minute PMC blocks on OCHMO-TB-044 page 9.",
        "prevention": "Hearing protection when noise is high. Pre- and post-EVA health checks. The hygiene timing tool is a team schedule idea, not a measured bathroom cycle.",
        "indicators": ("radiation", "noise", "eva"),
        "sources": ("hrp_hazards", "ochmo_tb_044", "radlab_api", "donki_sep_31338"),
    },
)


def region_status(region: dict[str, Any], visible_flags: list[str]) -> str:
    if not visible_flags:
        return "private" if region["id"] in {"head"} else "nominal"
    if "concern" in visible_flags or "critical" in visible_flags:
        return "concern"
    if "watch" in visible_flags:
        return "watch"
    return "nominal"
