"""Signed demo-session helpers and the auth boundary."""

from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import session  # noqa: E402


class DemoSessionTests(unittest.TestCase):
    def test_issue_and_verify_round_trip(self):
        issued = session.issue("C003", "cmo", now=1_800_000_000)
        verified = session.verify(issued["token"], now=1_800_000_100)
        self.assertEqual(verified["viewer"], "C003")
        self.assertEqual(verified["role"], "cmo")

    def test_tampered_token_is_rejected(self):
        issued = session.issue("C001", "self", now=1_800_000_000)
        encoded, signature = issued["token"].split(".", 1)
        tampered = f"{encoded}.{'0' * len(signature)}"
        self.assertIsNone(session.verify(tampered, now=1_800_000_100))

    def test_expired_token_is_rejected(self):
        issued = session.issue("C002", "self", now=1_800_000_000)
        self.assertIsNone(session.verify(issued["token"], now=issued["expires_at"] + 1))

    def test_unknown_identity_is_rejected(self):
        with self.assertRaises(ValueError):
            session.issue("C999", "self")
        with self.assertRaises(ValueError):
            session.issue("C001", "admin")
