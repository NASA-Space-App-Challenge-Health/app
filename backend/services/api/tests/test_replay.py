"""Radiation replay endpoint: the rule answer at an instant of the recorded week.

The replay UI must not invent an alert: at each frame where the recorded rate
crosses the threshold it asks the API, which runs the same rules engine and the
same OCHMO privacy projection as the dashboard.
"""

import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@unittest.skipUnless(os.environ.get("DATABASE_URL"), "DATABASE_URL is not set")
class RadiationReplayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient

        from app.main import app

        cls._client = TestClient(app)
        cls.client = cls._client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls._client.__exit__(None, None, None)

    def _alert(self, at, viewer="C001", role="self"):
        response = self.client.get(
            "/api/radiation/alert",
            params={"at": at, "viewer": viewer, "role": role},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_before_the_peak_there_is_no_alert(self):
        body = self._alert("2024-06-01T00:00:00Z")
        self.assertIsNone(body["alert"])
        self.assertIsNone(body["broadcast"])

    def test_peak_with_sep_inside_the_window_fires_the_emergency(self):
        body = self._alert("2024-06-05T12:00:00Z", role="cmo")
        self.assertIsNotNone(body["alert"])
        alert = body["alert"]
        self.assertEqual(alert["tier"], "emergency")
        self.assertTrue(alert["broadcast"])
        self.assertGreaterEqual(alert["evidence"]["absorbed_dose_rate"], 400)
        self.assertIn("Radiation contingency", body["broadcast"]["title"])

    def test_crewmate_gets_the_generic_notice_without_clinical_evidence(self):
        body = self._alert("2024-06-05T12:00:00Z", viewer="C004", role="crewmate")
        self.assertIsNotNone(body["alert"])
        self.assertIsNone(body["alert"].get("evidence"))
        self.assertNotIn("absorbed_dose_rate", str(body["alert"]))
        self.assertIn("Radiation contingency", body["broadcast"]["detail"])

    def test_hourly_max_exposes_the_raw_peak_that_the_mean_hides(self):
        response = self.client.get("/predict/radiation")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        means = payload["history"]["y"]
        peaks = payload["history"]["max"]
        self.assertEqual(len(means), len(peaks))
        self.assertLess(max(means), 400, "the hourly mean must stay below the raw-sample rule")
        self.assertGreater(max(peaks), 400, "the hourly max must cross the raw-sample rule")
        self.assertGreaterEqual(max(peaks), 528.4)

    def test_invalid_timestamp_is_rejected(self):
        response = self.client.get("/api/radiation/alert", params={"at": "not-a-date"})
        self.assertEqual(response.status_code, 422, response.text)


if __name__ == "__main__":
    unittest.main()
