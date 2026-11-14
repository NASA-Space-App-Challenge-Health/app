"""Stage the built React app into public/ for the Vercel CDN.

The Vercel build command runs `npm --prefix frontend ci`, then
`npm --prefix frontend run build`, then this script. Static files in `public/`
are served by the CDN; API paths are rewritten to the FastAPI function in
`api/index.py`.

Local equivalent:

    npm --prefix frontend run build && python3 scripts/stage_vercel_public.py
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def stage(source: Path, dest: Path) -> int:
    """Copy a built Vite tree into the CDN directory. Returns the file count."""
    index = source / "index.html"
    if not index.is_file():
        raise FileNotFoundError(index)

    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(source, dest)
    return sum(1 for path in dest.rglob("*") if path.is_file())


def main() -> int:
    source = ROOT / "frontend" / "dist"
    dest = ROOT / "public"

    try:
        files = stage(source, dest)
    except FileNotFoundError:
        print(
            f"Missing {source / 'index.html'}. Run `npm --prefix frontend ci && "
            "npm --prefix frontend run build` before staging.",
            file=sys.stderr,
        )
        return 1

    print(f"Staged {files} built files from {source.relative_to(ROOT)} into {dest.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
