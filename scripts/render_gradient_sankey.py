#!/usr/bin/env python3
"""Render gradient sankey clips for the data-insights page.

gradient-sankey 1.2.2 (PyPI, https://github.com/FG-SC/gradient-sankey) draws
true color gradients on Sankey links and can write a PNG or an MP4. It does
not export HTML or JSON. Its animate() path closes ffmpeg's stdin and then
calls communicate(), which raises "flush of closed file" on Python 3.12, so
this script saves each frame with save_frame and assembles the MP4 itself.

    python3 scripts/render_gradient_sankey.py
"""

from __future__ import annotations

import csv
import os
import subprocess
import tempfile
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")

import pandas as pd
from gradient_sankey import SankeyRaceMultiLayerParallel, Theme

ROOT = Path(__file__).resolve().parents[1]
LABS = ROOT / "data" / "labs_long.csv"
OUT_DIR = ROOT / "frontend" / "assets"
TIMEPOINTS = ("L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194")
CREW = ("C001", "C002", "C003", "C004")
STATUS = ("low", "normal", "high")
PHASES = ("pre-flight", "just after flight", "recovery")
COLORS = {
    "C001": "#00E5FF",
    "C002": "#C9B6E8",
    "C003": "#7851A9",
    "C004": "#7EE0C8",
    "pre-flight": "#00E5FF",
    "just after flight": "#C9B6E8",
    "recovery": "#7851A9",
    "low": "#F0C36A",
    "normal": "#7EE0C8",
    "high": "#F2A3C7",
}


def look() -> Theme:
    theme = Theme.dark()
    theme.background = "#070b14"
    theme.text = "#e8eef7"
    theme.title_text = "#e8eef7"
    theme.link.alpha = 0.9
    theme.link.glow = 0
    return theme


def phase_of(timepoint: str, days: str) -> str:
    if int(days) < 0:
        return "pre-flight"
    if timepoint == "R+1":
        return "just after flight"
    return "recovery"


def load_rows() -> list[dict[str, str]]:
    with LABS.open(newline="", encoding="utf-8") as handle:
        return [
            row
            for row in csv.DictReader(handle)
            if row["panel"] in {"CBC", "CMP"}
            and row["flag"] in STATUS
            and row["timepoint"] in TIMEPOINTS
            and row["crew_id"] in CREW
        ]


def write_clip(sankey, frames: int, poster: Path, video: Path, title: str) -> None:
    theme = look()
    frame_dir = Path(tempfile.mkdtemp(prefix="sankey-frames-"))
    paths = []
    for index in range(frames):
        path = frame_dir / f"frame-{index}.png"
        sankey.save_frame(
            str(path),
            frame_index=index,
            title=title,
            figsize=(11, 6.2),
            dpi=110,
            theme=theme,
            ranking_mode=False,
            stacked_mode=True,
        )
        paths.append(path)
    poster.write_bytes(paths[-1].read_bytes())
    listing = frame_dir / "frames.txt"
    lines = []
    for path in paths:
        lines.append(f"file '{path.name}'")
        lines.append("duration 1")
    lines.append(f"file '{paths[-1].name}'")
    listing.write_text("\n".join(lines) + "\n", encoding="utf-8")
    encoded = subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(listing),
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-r", "8",
            str(video),
        ],
        cwd=frame_dir,
        capture_output=True,
        text=True,
    )
    if encoded.returncode != 0:
        raise RuntimeError(encoded.stderr[-800:])
    for path in paths:
        path.unlink(missing_ok=True)
    listing.unlink(missing_ok=True)
    frame_dir.rmdir()
    print(f"{poster.name} {poster.stat().st_size} bytes")
    print(f"{video.name} {video.stat().st_size} bytes")


def main() -> None:
    rows = load_rows()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    theme = look()

    crew_records = []
    for index, timepoint in enumerate(TIMEPOINTS, start=1):
        stamp = f"{index:02d} {timepoint}"
        for crew in CREW:
            for status in STATUS:
                value = sum(1 for row in rows if row["timepoint"] == timepoint and row["crew_id"] == crew and row["flag"] == status)
                if value:
                    crew_records.append({"time": stamp, "source": crew, "target": status, "value": value})
    crew = SankeyRaceMultiLayerParallel.from_dataframe(
        df=pd.DataFrame(crew_records),
        layers=[list(CREW), list(STATUS)],
        time_col="time",
        source_col="source",
        target_col="target",
        value_col="value",
        node_colors=COLORS,
    )
    write_clip(
        crew,
        len(TIMEPOINTS),
        OUT_DIR / "crew-status-gradient.png",
        OUT_DIR / "crew-status-gradient.mp4",
        "Crew to lab status",
    )

    for row in rows:
        row["phase"] = phase_of(row["timepoint"], row["days_from_launch"])
    steps = (
        ("01 pre-flight", {"pre-flight"}),
        ("02 just after flight", {"pre-flight", "just after flight"}),
        ("03 recovery", set(PHASES)),
    )
    phase_records = []
    for stamp, included in steps:
        for phase in PHASES:
            if phase not in included:
                continue
            for status in STATUS:
                value = sum(1 for row in rows if row["phase"] == phase and row["flag"] == status)
                if value:
                    phase_records.append({"time": stamp, "source": phase, "target": status, "value": value})
    phase = SankeyRaceMultiLayerParallel.from_dataframe(
        df=pd.DataFrame(phase_records),
        layers=[list(PHASES), list(STATUS)],
        time_col="time",
        source_col="source",
        target_col="target",
        value_col="value",
        node_colors=COLORS,
    )
    write_clip(
        phase,
        len(steps),
        OUT_DIR / "phase-status-gradient.png",
        OUT_DIR / "phase-status-gradient.mp4",
        "Phase to lab status",
    )


if __name__ == "__main__":
    main()
