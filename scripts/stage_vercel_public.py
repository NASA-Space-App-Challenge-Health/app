"""Copy the static dashboard into public/ so the Vercel CDN can serve it."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMES = ("index.html", "app.js", "styles.css", "config.js")


def main() -> None:
    source = ROOT / "frontend"
    dest = ROOT / "public"
    dest.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        shutil.copy2(source / name, dest / name)
    print(f"Staged {len(NAMES)} dashboard files into {dest}")


if __name__ == "__main__":
    main()
