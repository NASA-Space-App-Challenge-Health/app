"""PostgreSQL connection and forward-only SQL migrations.

Each call opens one connection and the caller closes it. There is no pool
kept across requests, which is the serverless-safe pattern (NullPool): a
Vercel instance must not hold a server-side pool open, and PgBouncer in
transaction mode cannot reuse prepared statements.
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg
from psycopg.rows import dict_row

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "postgres", "::1"}


def _hostname(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


def is_pooler(url: str) -> bool:
    """Neon and similar PgBouncer hosts put ``-pooler`` in the hostname."""
    host = _hostname(url)
    return "-pooler" in host or host.startswith("pooler.")


def _drop_query_key(url: str, key: str) -> str:
    parts = urlsplit(url)
    kept = [(name, value) for name, value in parse_qsl(parts.query, keep_blank_values=True) if name != key]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment))


def database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    # Neon pooler URLs sometimes include channel_binding=require, which the
    # pooled endpoint rejects. Drop it and keep sslmode.
    url = _drop_query_key(url, "channel_binding")
    if "sslmode=" in url or _hostname(url) in _LOCAL_HOSTS:
        return url
    sep = "&" if "?" in url else "?"
    return url + sep + "sslmode=require"


def resolved_statement_timeout(explicit: int | None = None) -> int:
    """Milliseconds, or 0 when no limit should be sent.

    A non-pooler Vercel host still defaults to 8 seconds. A ``-pooler`` host
    does not, because Neon rejects the startup ``options`` parameter. Set
    ``DATABASE_STATEMENT_TIMEOUT_MS=0`` to force that off everywhere.
    """
    if explicit is not None:
        return explicit
    raw = os.environ.get("DATABASE_STATEMENT_TIMEOUT_MS", "").strip()
    if raw:
        return int(raw)
    url = os.environ.get("DATABASE_URL", "")
    if os.environ.get("VERCEL") and url and not is_pooler(database_url()):
        return 8000
    return 0


def connect_kwargs(url: str, timeout_ms: int) -> dict:
    """Libpq kwargs. Poolers must not receive ``options=-c statement_timeout``.

    A positive timeout on a pooler is applied after connect with
    ``set_config(..., is_local=true)`` so it stays inside this transaction.
    """
    kwargs: dict = {
        "connect_timeout": int(os.environ.get("DATABASE_CONNECT_TIMEOUT", "5")),
        "row_factory": dict_row,
        "prepare_threshold": None,
    }
    if timeout_ms and not is_pooler(url):
        kwargs["options"] = f"-c statement_timeout={int(timeout_ms)}"
    return kwargs


def connect(*, statement_timeout_ms: int | None = None) -> psycopg.Connection:
    """Open one short-lived connection."""
    url = database_url()
    timeout = resolved_statement_timeout(statement_timeout_ms)
    conn = psycopg.connect(url, **connect_kwargs(url, timeout))
    if timeout and is_pooler(url):
        conn.execute("SELECT set_config('statement_timeout', %s, true)", (str(int(timeout)),))
    return conn


def migrations_dir() -> Path:
    override = os.environ.get("MIGRATIONS_DIR", "").strip()
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[2] / "database" / "migrations"


def sql_statements(script: str) -> list[str]:
    """Split a simple migration script into individual statements.

    Full-line ``--`` comments are ignored. Statements are separated by a
    semicolon at the end of a line. Dollar-quoted function bodies are not
    supported.
    """
    statements: list[str] = []
    buffer: list[str] = []
    for line in script.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        buffer.append(line)
        if stripped.endswith(";"):
            statement = "\n".join(buffer).strip()
            if statement:
                statements.append(statement)
            buffer = []
    trailing = "\n".join(buffer).strip()
    if trailing:
        raise ValueError("Migration has a statement that does not end with ';'")
    return statements


def apply_migrations(conn: psycopg.Connection) -> list[str]:
    directory = migrations_dir()
    if not directory.is_dir():
        raise RuntimeError(f"Migrations directory is missing: {directory}")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename text PRIMARY KEY,
            applied_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    applied: list[str] = []
    for path in sorted(directory.glob("*.sql")):
        already = conn.execute(
            "SELECT 1 FROM schema_migrations WHERE filename = %s",
            (path.name,),
        ).fetchone()
        if already:
            continue
        for statement in sql_statements(path.read_text(encoding="utf-8")):
            conn.execute(statement)
        conn.execute(
            "INSERT INTO schema_migrations (filename) VALUES (%s)",
            (path.name,),
        )
        applied.append(path.name)
    conn.commit()
    return applied
