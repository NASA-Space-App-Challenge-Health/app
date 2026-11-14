"""Copy the static site into public/ so the Vercel CDN can serve it.

Includes the crew board, the insights page, charts, and fonts. API routes
are not files here; vercel.json rewrites those to the FastAPI function.
"""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


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
    print(f"Staged {source} into {dest}")


if __name__ == "__main__":
    main()
