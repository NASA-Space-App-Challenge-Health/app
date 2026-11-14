"""Vercel FastAPI entrypoint.

The platform looks for an `app` object in `api/index.py`. Rewrites in
`vercel.json` send `/api/*`, `/predict`, `/recommendations`, `/eda/*`,
and `/health` to this function. FastAPI still matches the original path,
so `/predict` and `/recommendations` work when those routes are deployed.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "services" / "api"))

from app.main import app  # noqa: E402

__all__ = ["app"]
