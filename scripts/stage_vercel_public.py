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


def main() -> int:
    source = ROOT / "frontend" / "dist"
    dest = ROOT / "public"

    if not (source / "index.html").is_file():
        print(
            f"Missing {source / 'index.html'}. Run `npm --prefix frontend ci && "
            "npm --prefix frontend run build` before staging.",
            file=sys.stderr,
        )
        return 1

    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(source, dest)

    files = sum(1 for path in dest.rglob("*") if path.is_file())
    print(f"Staged {files} built files from {source.relative_to(ROOT)} into {dest.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
