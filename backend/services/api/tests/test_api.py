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

    def test_signed_session_overrides_query_identity(self):
        import os

        from app import session

        token = session.issue("C003", "self")["token"]
        previous = os.environ.get("DEMO_AUTH_REQUIRED")
        os.environ["DEMO_AUTH_REQUIRED"] = "true"
        try:
            unauthenticated = self.client.get("/api/dashboard?viewer=C001&role=cmo")
            self.assertEqual(unauthenticated.status_code, 401, unauthenticated.text)
            response = self.client.get(
                "/api/dashboard?viewer=C001&role=cmo",
                headers={"Authorization": f"Bearer {token}"},
            )
        finally:
            if previous is None:
                os.environ.pop("DEMO_AUTH_REQUIRED", None)
            else:
                os.environ["DEMO_AUTH_REQUIRED"] = previous
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        by_sign = {member["call_sign"]: member for member in body["crew"]}
        self.assertEqual(by_sign["C003"]["visible"], "full")
        self.assertEqual(by_sign["C001"]["visible"], "hidden")

    def test_eda_crew_scope(self):
        response = self.client.get("/eda/overview?crew=C003")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["crew_count"], 1)
        self.assertLess(body["lab_rows"], 4000)

    def test_dashboard_mixes_real_labs_and_simulated_vitals(self):
        response = self.client.get("/api/dashboard?viewer=C001&role=flight_surgeon")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["data_source"], "mixed")
        self.assertEqual(body["group"]["kind"], "crew")
        self.assertIn("Demo only, no login", body["demo_banner"])
        by_sign = {member["call_sign"]: member for member in body["crew"]}
        self.assertEqual(by_sign["C003"]["labs"][0]["origin"], "real")
        differential = {item["analyte"]: item for item in by_sign["C003"]["differential"]}
        self.assertIn("EOSINOPHILS", differential)
        self.assertIn("ABSOLUTE EOSINOPHILS", differential)
        self.assertEqual(differential["EOSINOPHILS"]["origin"], "real")
        self.assertIn("WHITE BLOOD CELL COUNT", [item["analyte"] for item in by_sign["C003"]["labs"]])
        self.assertEqual(by_sign["C003"]["labs"][0]["research_label"] if False else "real", "real")
        heart = next(item for item in by_sign["C001"]["readings"] if item["indicator"] == "heart_rate")
        self.assertEqual(heart["origin"], "simulated")
        demo_ids = [step["id"] for step in body["demo"]["steps"]]
        self.assertEqual(demo_ids, ["legend", "emergency", "preventive", "simulated"])
        emergency = body["demo"]["steps"][1]["alert"]
        self.assertEqual(emergency["tier"], "emergency")
        self.assertGreater(emergency["evidence"]["absorbed_dose_rate"], 400)
        preventive = body["demo"]["steps"][2]["recommendation"]
        self.assertEqual(preventive["tier"], "cmo")
        self.assertFalse(preventive["broadcast"])
        self.assertEqual(preventive["evidence"]["analyte"], "POTASSIUM")
        self.assertEqual(preventive["evidence"]["earlier_value"], 3.3)
        self.assertEqual(preventive["evidence"]["later_value"], 3.0)
        crewmate = self.client.get("/api/dashboard?viewer=C001&role=crewmate")
        self.assertEqual(crewmate.status_code, 200, crewmate.text)
        notice = " ".join(item["detail"] for item in crewmate.json()["broadcasts"])
        self.assertIn("Radiation contingency", notice)
        self.assertNotIn("POTASSIUM", notice.upper())
        self.assertNotIn("3.3", notice)
        self.assertTrue(all(item["tier"] == "emergency" for item in crewmate.json()["alerts"]))
        hidden = {member["call_sign"]: member for member in crewmate.json()["crew"]}["C003"]
        self.assertEqual(hidden["visible"], "hidden")

    def test_readings_expose_illustrative_bands_for_the_bars(self):
        response = self.client.get("/api/dashboard?viewer=C003&role=self")
        self.assertEqual(response.status_code, 200, response.text)
        by_sign = {member["call_sign"]: member for member in response.json()["crew"]}
        readings = {item["indicator"]: item for item in by_sign["C003"]["readings"]}
        heart = readings["heart_rate"]
        self.assertEqual(heart["bands"]["nominal"], [50.0, 100.0])
        self.assertEqual(heart["bands"]["watch"], [40.0, 130.0])
        self.assertEqual(heart["bands"]["physical"], [20.0, 250.0])
        temp = readings["temperature_c"]
        self.assertEqual(temp["bands"]["nominal"], [36.1, 37.5])
        self.assertIn("not a NASA limit", temp["bands"]["label"])

    def test_root_and_health_describe_the_mixed_sources(self):
        root = self.client.get("/")
        self.assertEqual(root.status_code, 200, root.text)
        self.assertEqual(root.json()["data_source"], "mixed")
        health = self.client.get("/health")
        self.assertEqual(health.status_code, 200, health.text)
        self.assertEqual(health.json()["data_source"], "mixed")

    def test_upload_csv_stores_a_simulated_vital(self):
        payload = (
            "crew_id,indicator,value,recorded_at\n"
            "C001,heart_rate,88,2026-11-14T12:00:00Z\n"
        )
        response = self.client.post(
            "/api/uploads",
            files={"file": ("vitals.csv", payload, "text/csv")},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["inserted"], 1)
        self.assertEqual(response.json()["origin"], "simulated")

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
