"""PostgreSQL connection and forward-only SQL migrations."""

from __future__ import annotations

import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row


def database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return url


def connect() -> psycopg.Connection:
    return psycopg.connect(database_url(), connect_timeout=5, row_factory=dict_row)


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
