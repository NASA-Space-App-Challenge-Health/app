"""Simulated xEMU samples. The generator stays Alisson's; the limit does not."""

from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.xemu import CO2_LIMIT_MMHG, interpret, percent_to_mmhg  # noqa: E402
from app.xemu_sensors import ler_sensores_traje  # noqa: E402


class XemuTests(unittest.TestCase):
    def test_half_percent_is_above_the_three_mmhg_standard(self):
        mmhg = percent_to_mmhg(0.5)
        self.assertAlmostEqual(mmhg, 3.8, places=2)
        self.assertGreater(mmhg, CO2_LIMIT_MMHG)
        summary = interpret({"fc_bpm": 72, "spo2": 98, "co2_percentual": 0.5})
        self.assertTrue(summary["co2_above_habitat_limit"])
        self.assertIsNone(summary["broadcast"])
        self.assertIn("not a diagnosis", summary["plain"]["what_it_means"].lower())
        self.assertIn("ochmo-tb-004", summary["source"]["url"])

    def test_heart_rate_outside_the_app_window_is_the_only_crew_broadcast(self):
        summary = interpret({"fc_bpm": 150, "spo2": 90, "co2_percentual": 0.2})
        self.assertTrue(summary["heart_rate_emergency"])
        self.assertEqual(summary["broadcast"]["broadcast"], True)
        self.assertNotIn("150", summary["broadcast"]["detail"])
        self.assertFalse(summary["co2_above_habitat_limit"])

    def test_generator_still_returns_his_three_fields(self):
        sample = ler_sensores_traje()
        self.assertIn("fc_bpm", sample)
        self.assertIn("spo2", sample)
        self.assertIn("co2_percentual", sample)


@unittest.skipUnless(os.environ.get("DATABASE_URL"), "DATABASE_URL is not set")
class XemuApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient

        from app.main import app

        cls._client = TestClient(app)
        cls.client = cls._client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls._client.__exit__(None, None, None)

    def test_history_returns_the_stored_suit_samples(self):
        from app import db, xemu
        from app.main import history as history_fn  # noqa: F401

        original = xemu._sensors
        xemu._sensors = lambda: {"fc_bpm": 74, "spo2": 97, "co2_percentual": 0.4}
        ids = []
        try:
            first = self.client.post("/api/suit-sensors", params={"crew": "C001"})
            second = self.client.post("/api/suit-sensors", params={"crew": "C001"})
        finally:
            xemu._sensors = original
        for response in (first, second):
            self.assertEqual(response.status_code, 200, response.text)
            ids.extend(item["id"] for item in response.json()["readings"])
        try:
            response = self.client.get("/api/suit-sensors/history", params={"crew": "C001", "limit": 5})
            self.assertEqual(response.status_code, 200, response.text)
            body = response.json()
            self.assertEqual(body["origin"], "simulated")
            self.assertGreaterEqual(body["count"], 2)
            sample = body["samples"][-1]
            self.assertEqual(sample["heart_rate_bpm"], 74.0)
            self.assertEqual(sample["spo2_percent"], 97.0)
            self.assertFalse(sample["heart_rate_emergency"])
            self.assertIn("recorded_at", sample)
        finally:
            with db.connect() as conn:
                conn.execute("DELETE FROM health_readings WHERE id = ANY(%s::uuid[])", (ids,))
                conn.commit()

    def test_post_stores_a_simulated_suit_sample(self):
        from app import xemu

        original = xemu._sensors
        xemu._sensors = lambda: {"fc_bpm": 72, "spo2": 98, "co2_percentual": 0.3}
        try:
            response = self.client.post("/api/suit-sensors", params={"crew": "C001"})
            if response.status_code == 200:
                from app import db

                ids = [item["id"] for item in response.json()["readings"]]
                with db.connect() as conn:
                    conn.execute("DELETE FROM health_readings WHERE id = ANY(%s::uuid[])", (ids,))
                    conn.commit()
        finally:
            xemu._sensors = original
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["origin"], "simulated")
        self.assertEqual(body["crew_id"], "C001")
        self.assertTrue(all(item["origin"] == "simulated" for item in body["readings"]))
        self.assertEqual({item["indicator"] for item in body["readings"]}, {"heart_rate", "spo2", "cabin_co2_mmhg"})
        self.assertIsNone(body["broadcast"])
