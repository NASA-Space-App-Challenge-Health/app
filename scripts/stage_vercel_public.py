"""Copy the static site into public/ so the Vercel CDN can serve it.

Includes the crew board, the insights page, charts, and fonts. API routes
are not files here; vercel.json rewrites those to the FastAPI function.
"""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_NAMES = (
    "labs_long.csv",
    "radiation_iss.csv",
    "donki_sep.csv",
    "reference_ranges.csv",
    "datasets.csv",
)


def main() -> None:
    source = ROOT / "frontend"
    dest = ROOT / "public"
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(
        source,
        dest,
        ignore=shutil.ignore_patterns("*.test.mjs", "__pycache__", "*.pyc"),
    )
    data_dest = dest / "data"
    data_dest.mkdir(parents=True, exist_ok=True)
    for name in CSV_NAMES:
        shutil.copy2(ROOT / "data" / name, data_dest / name)
    print(f"Staged {source} and {len(CSV_NAMES)} CSVs into {dest}")


if __name__ == "__main__":
    main()
