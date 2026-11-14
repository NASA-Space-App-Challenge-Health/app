"""PostgreSQL connection and forward-only SQL migrations.

Each call opens one connection and the caller closes it. There is no pool
kept across requests, which is the serverless-safe pattern (NullPool): a
Vercel instance must not hold a server-side pool open, and PgBouncer in
transaction mode cannot reuse prepared statements.
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit

import psycopg
from psycopg.rows import dict_row

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "postgres", "::1"}


def database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if "sslmode=" in url:
        return url
    host = (urlsplit(url).hostname or "").lower()
    if host in _LOCAL_HOSTS:
        return url
    sep = "&" if "?" in url else "?"
    return url + sep + "sslmode=require"


def connect(*, statement_timeout_ms: int | None = None) -> psycopg.Connection:
    """Open one short-lived connection.

    ``prepare_threshold=None`` disables prepared statements so a pooled
    PgBouncer URL (transaction mode) works. Remote hosts get
    ``sslmode=require`` when the URL does not already set it.
    """
    timeout = statement_timeout_ms
    if timeout is None:
        raw = os.environ.get("DATABASE_STATEMENT_TIMEOUT_MS", "").strip()
        if raw:
            timeout = int(raw)
        elif os.environ.get("VERCEL"):
            timeout = 8000
    kwargs: dict = {
        "connect_timeout": int(os.environ.get("DATABASE_CONNECT_TIMEOUT", "5")),
        "row_factory": dict_row,
        "prepare_threshold": None,
    }
    if timeout:
        kwargs["options"] = f"-c statement_timeout={int(timeout)}"
    return psycopg.connect(database_url(), **kwargs)


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
