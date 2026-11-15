"""Help request loop: persisted workflow, privacy and lifecycle.

The alert system computes findings per request; a help request is a row, so
this suite exercises create -> list -> accept -> close, the privacy projection
of the free-text reason, duplicate prevention and the computed escalation.
"""

import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db  # noqa: E402


@unittest.skipUnless(os.environ.get("DATABASE_URL"), "DATABASE_URL is not set")
class HelpLoopTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient

        from app.main import app

        cls._client = TestClient(app)
        cls.client = cls._client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls._clean()
        cls._client.__exit__(None, None, None)

    def setUp(self):
        self._clean()

    def tearDown(self):
        self._clean()

    @staticmethod
    def _clean():
        with db.connect() as conn:
            conn.execute("DELETE FROM help_requests")
            conn.commit()

    def _create(self, requester="C003", module="Node 2", reason="chest_discomfort", text="chest tightness after exercise"):
        response = self.client.post(
            "/api/help-requests",
            json={
                "requester": requester,
                "module": module,
                "reason_code": reason,
                "reason_text": text,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_create_list_accept_close_flow(self):
        created = self._create()
        self.assertEqual(created["status"], "requested")
        self.assertEqual(created["requester"], "C003")
        self.assertFalse(created["help_on_the_way"])
        self.assertTrue(created["can_accept"] is False)  # requester sees own request

        as_crewmate = self.client.get("/api/help-requests?viewer=C001&role=crewmate")
        self.assertEqual(as_crewmate.status_code, 200, as_crewmate.text)
        body = as_crewmate.json()
        self.assertEqual(body["counts"]["waiting"], 1)
        item = next(entry for entry in body["open"] if entry["id"] == created["id"])
        self.assertEqual(item["module"], "Node 2")
        self.assertEqual(item["reason_label"], "Chest discomfort")
        self.assertIsNone(item["reason_text"], "crewmate must not see the private reason")
        self.assertTrue(item["can_accept"])

        as_self = self.client.get("/api/help-requests?viewer=C003&role=self")
        mine = as_self.json()["mine"]
        self.assertIsNotNone(mine)
        self.assertEqual(mine["reason_text"], "chest tightness after exercise")

        accepted = self.client.post(
            f"/api/help-requests/{created['id']}/accept",
            json={"crew": "C001"},
        )
        self.assertEqual(accepted.status_code, 200, accepted.text)
        accepted_body = accepted.json()
        self.assertEqual(accepted_body["status"], "accepted")
        self.assertEqual(accepted_body["accepted_by"], "C001")
        self.assertTrue(accepted_body["help_on_the_way"])
        self.assertGreaterEqual(accepted_body["time_to_accept_seconds"], 0)

        requester_view = self.client.get("/api/help-requests?viewer=C003&role=self").json()
        self.assertEqual(requester_view["mine"]["status"], "accepted")
        self.assertEqual(requester_view["mine"]["accepted_by"], "C001")
        self.assertTrue(requester_view["mine"]["help_on_the_way"])

        closed = self.client.post(
            f"/api/help-requests/{created['id']}/close",
            json={"crew": "C003"},
        )
        self.assertEqual(closed.status_code, 200, closed.text)
        self.assertEqual(closed.json()["status"], "closed")
        self.assertFalse(closed.json()["can_accept"])

        after = self.client.get("/api/help-requests?viewer=C001&role=crewmate").json()
        self.assertEqual(after["counts"]["open"], 0)

    def test_requester_cannot_accept_own_request(self):
        created = self._create()
        response = self.client.post(
            f"/api/help-requests/{created['id']}/accept",
            json={"crew": "C003"},
        )
        self.assertEqual(response.status_code, 422, response.text)

    def test_one_open_request_per_crew_member(self):
        self._create()
        second = self.client.post(
            "/api/help-requests",
            json={
                "requester": "C003",
                "module": "Columbus",
                "reason_code": "other",
            },
        )
        self.assertEqual(second.status_code, 409, second.text)

    def test_cmo_sees_private_reason_and_crewmate_does_not(self):
        created = self._create(text="private note for the medical officer")
        as_cmo = self.client.get("/api/help-requests?viewer=C002&role=cmo").json()
        item = next(entry for entry in as_cmo["open"] if entry["id"] == created["id"])
        self.assertEqual(item["reason_text"], "private note for the medical officer")
        as_crewmate = self.client.get("/api/help-requests?viewer=C001&role=crewmate").json()
        item = next(entry for entry in as_crewmate["open"] if entry["id"] == created["id"])
        self.assertIsNone(item["reason_text"])

    def test_escalation_is_computed_after_the_timeout(self):
        created = self._create()
        with db.connect() as conn:
            conn.execute(
                "UPDATE help_requests SET expires_at = now() - interval '5 seconds' WHERE id = %s",
                (created["id"],),
            )
            conn.commit()
        listed = self.client.get("/api/help-requests?viewer=C001&role=crewmate").json()
        item = next(entry for entry in listed["open"] if entry["id"] == created["id"])
        self.assertEqual(item["status"], "escalated")
        self.assertTrue(item["can_accept"])

    def test_unrelated_crewmate_cannot_close(self):
        created = self._create()
        response = self.client.post(
            f"/api/help-requests/{created['id']}/close",
            json={"crew": "C004"},
        )
        self.assertEqual(response.status_code, 422, response.text)

    def test_unknown_crew_and_reason_are_rejected(self):
        missing = self.client.post(
            "/api/help-requests",
            json={"requester": "ZZZ9", "module": "Node 2", "reason_code": "other"},
        )
        self.assertEqual(missing.status_code, 404, missing.text)
        bad_reason = self.client.post(
            "/api/help-requests",
            json={"requester": "C001", "module": "Node 2", "reason_code": "vibes"},
        )
        self.assertEqual(bad_reason.status_code, 422, bad_reason.text)

    def test_help_requests_table_is_migrated(self):
        with db.connect() as conn:
            row = conn.execute(
                "SELECT to_regclass('public.help_requests') AS name"
            ).fetchone()
        self.assertEqual(row["name"], "help_requests")


if __name__ == "__main__":
    unittest.main()
