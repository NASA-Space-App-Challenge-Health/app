"""Signed demo sessions.

This is not an authentication system. The Space Apps demo has no login: a crew
member is simulated by a biometric hand-off. The server still signs the selected
viewer/role so the API can distinguish an app-issued identity from a hand-edited
``?viewer=...&role=...`` query string. Production requires the header whenever
``DEMO_AUTH_REQUIRED`` (or Vercel itself) says so.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

from app.access import ROLES

CREW_SIGNS = ("C001", "C002", "C003", "C004")
DEFAULT_TTL_SECONDS = 8 * 60 * 60


def _secret() -> bytes:
    value = os.environ.get("DEMO_SESSION_SECRET", "").strip()
    # Development fallback only. Set DEMO_SESSION_SECRET on the deployment.
    return (value or "thais-demo-session-development-only").encode("utf-8")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _sign(payload: str) -> str:
    signature = hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).digest()
    return _b64(signature)


def ttl_seconds() -> int:
    raw = os.environ.get("DEMO_SESSION_TTL_SECONDS", "").strip()
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_TTL_SECONDS
    return value if value > 0 else DEFAULT_TTL_SECONDS


def issue(viewer: str, role: str, *, now: int | None = None) -> dict[str, Any]:
    viewer = (viewer or "").strip().upper()
    role = (role or "self").strip()
    if viewer not in CREW_SIGNS:
        raise ValueError("Unknown crew member")
    if role not in ROLES:
        raise ValueError("Unknown role")
    issued_at = int(time.time() if now is None else now)
    payload = {
        "v": viewer,
        "r": role,
        "iat": issued_at,
        "exp": issued_at + ttl_seconds(),
    }
    encoded = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    return {
        "token": f"{encoded}.{_sign(encoded)}",
        "token_type": "Bearer",
        "expires_at": payload["exp"],
        "viewer": viewer,
        "role": role,
    }


def verify(token: str, *, now: int | None = None) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    encoded, signature = token.split(".", 1)
    if not hmac.compare_digest(signature, _sign(encoded)):
        return None
    try:
        payload = json.loads(_unb64(encoded))
    except (ValueError, json.JSONDecodeError):
        return None
    viewer = str(payload.get("v", "")).upper()
    role = str(payload.get("r", ""))
    exp = int(payload.get("exp", 0))
    if viewer not in CREW_SIGNS or role not in ROLES:
        return None
    if exp <= int(time.time() if now is None else now):
        return None
    return {"viewer": viewer, "role": role, "expires_at": exp}


def auth_required() -> bool:
    raw = os.environ.get("DEMO_AUTH_REQUIRED", "").strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    # A deployed Vercel function always requires the signed demo identity.
    return bool(os.environ.get("VERCEL"))
