import os
import sys
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402

from app import db  # noqa: E402


@unittest.skipUnless(os.environ.get("DATABASE_URL"), "DATABASE_URL is not set")
class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient

        from app.main import app

        cls._client = TestClient(app)
        cls.client = cls._client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls._delete_test_crew()
        cls._client.__exit__(None, None, None)

    def tearDown(self):
        self._delete_test_crew()

    @staticmethod
    def _delete_test_crew():
        with db.connect() as conn:
            conn.execute("DELETE FROM crew_members WHERE call_sign LIKE 'ZZTEST%'")
            conn.commit()

    def test_migration_script_parses(self):
        script = (db.migrations_dir() / "001_crew_health.sql").read_text(encoding="utf-8")
        statements = db.sql_statements(script)
        self.assertEqual(len(statements), 3)
        self.assertIn("CREATE TABLE crew_members", statements[0])
        self.assertIn("ON DELETE CASCADE", statements[1])

    def test_dashboard_serves_simulated_seed(self):
        response = self.client.get("/api/dashboard")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["data_source"], "simulated")
        self.assertIn("not crew medical records", body["disclaimer"])
        by_sign = {member["call_sign"]: member for member in body["crew"]}
        self.assertEqual(by_sign["OKONKWO"]["overall_band"], "nominal")
        self.assertEqual(by_sign["OKADA"]["overall_band"], "concern")
        self.assertEqual(by_sign["VASQUEZ"]["overall_band"], "watch")
        self.assertEqual(by_sign["CHEN"]["overall_band"], "watch")
        glucose = next(
            item for item in by_sign["OKADA"]["readings"] if item["indicator"] == "blood_glucose"
        )
        self.assertEqual(glucose["source"], "simulated")
        self.assertEqual(glucose["risk_band"], "concern")
        self.assertIn("flight surgeon", glucose["guidance"].lower())
        self.assertTrue(all(item["explanation"] for item in by_sign["CHEN"]["readings"]))

    def test_manual_reading_cannot_set_its_own_band(self):
        created = self.client.post(
            "/api/crew",
            json={
                "call_sign": "ZZTEST",
                "full_name": "Test Crew",
                "role": "Verification",
                "mission": "Demonstration mission",
            },
        )
        self.assertEqual(created.status_code, 201, created.text)
        crew_id = created.json()["id"]
        self.assertIsNone(created.json()["overall_band"])
        forbidden = self.client.post(
            "/api/readings",
            json={
                "crew_member_id": crew_id,
                "indicator": "heart_rate",
                "value": 150,
                "risk_band": "nominal",
            },
        )
        self.assertEqual(forbidden.status_code, 422)
        stored = self.client.post(
            "/api/readings",
            json={"crew_member_id": crew_id, "indicator": "heart_rate", "value": 150},
        )
        self.assertEqual(stored.status_code, 201, stored.text)
        self.assertEqual(stored.json()["source"], "manual")
        self.assertEqual(stored.json()["risk_band"], "concern")
        missing = self.client.get(f"/api/crew/{uuid.uuid4()}")
        self.assertEqual(missing.status_code, 404)

    def test_health_reports_a_database_outage(self):
        original = db.connect

        def fail():
            raise psycopg.OperationalError("down")

        db.connect = fail
        try:
            response = self.client.get("/health")
        finally:
            db.connect = original
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "Database is unavailable")


if __name__ == "__main__":
    unittest.main()
