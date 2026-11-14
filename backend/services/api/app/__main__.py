"""One-off database seed. Does not run on a Vercel cold start.

    DATABASE_URL=postgresql://user:pass@host:5432/db \\
      PYTHONPATH=backend/services/api \\
      python -m app load
"""

from __future__ import annotations

import os
import sys


def main() -> None:
    if sys.argv[1:] != ["load"]:
        raise SystemExit("usage: python -m app load")
    os.environ["LOAD_ON_STARTUP"] = "true"
    os.environ.pop("VERCEL", None)
    from app.repository import ensure_ready

    ensure_ready()
    print("Database schema, simulated crew, and NASA CSVs are loaded. Re-running is safe.")


if __name__ == "__main__":
    main()
