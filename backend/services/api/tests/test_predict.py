import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.predict import lab_forecast, p_out_of_range, radiation_forecast  # noqa: E402


class PredictMathTests(unittest.TestCase):
    def test_interval_covers_a_straight_line_and_states_uncertainty(self):
        points = [
            {"day": day, "value": 2.0 + 0.1 * day + noise, "timepoint": str(day), "ref_low": 0, "ref_high": 50, "flag": "normal"}
            for day, noise in ((-90, 0.2), (-40, -0.3), (-3, 0.4), (1, -0.2), (45, 0.1))
        ]
        result = lab_forecast(points)
        self.assertIsNotNone(result)
        self.assertEqual(result["n"], 5)
        self.assertIn("tiny", result["uncertainty"])
        nxt = result["forecasts"][0]
        self.assertGreater(nxt["pi95_high"], nxt["yhat"])
        self.assertLess(nxt["pi95_low"], nxt["yhat"])
        self.assertFalse(nxt["inside_observed_span"])
        day30 = next(item for item in result["forecasts"] if item["label"] == "day_30")
        self.assertTrue(day30["inside_observed_span"])

    def test_already_out_and_worsening_uses_the_reference_flag(self):
        points = [
            {"day": -3, "value": 3.3, "timepoint": "L-3", "ref_low": 3.5, "ref_high": 5.3, "flag": "low"},
            {"day": 1, "value": 3.0, "timepoint": "R+1", "ref_low": 3.5, "ref_high": 5.3, "flag": "low"},
            {"day": 45, "value": 4.4, "timepoint": "R+45", "ref_low": 3.5, "ref_high": 5.3, "flag": "normal"},
        ]
        result = lab_forecast(points)
        self.assertIn("already_out_and_worsening", result["flags"])
        self.assertEqual(result["worsening_pairs"][0]["earlier_value"], 3.3)
        self.assertIsNotNone(p_out_of_range(3.0, 0.2, 3.5, 5.3))

    def test_radiation_forecast_is_an_area_rate_and_uses_the_rule_threshold(self):
        hourly = [{"hour": f"2024-06-01T{h:02d}:00", "rate": 10.0 + (200 if h == 3 else 0)} for h in range(24)]
        hourly.append({"hour": "2024-06-02T01:00", "rate": 450.0})
        result = radiation_forecast(hourly, spike_at_least=400, horizon_hours=6)
        self.assertEqual(result["spike_threshold_ugy_h"], 400)
        self.assertTrue(any(item["rate"] >= 400 for item in result["spikes_at_or_above_rule"]))
        self.assertEqual(len(result["forecast"]), 6)
        self.assertIn("not a personal dose", result["cumulative"][0]["label"].lower())
        self.assertEqual(result["cumulative"][0]["days"], 30)


@unittest.skipUnless(os.environ.get("DATABASE_URL"), "DATABASE_URL is not set")
class PredictApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient

        from app.main import app

        cls._client = TestClient(app)
        cls.client = cls._client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls._client.__exit__(None, None, None)

    def test_potassium_forecast_and_ranked_risks(self):
        response = self.client.get("/predict/labs", params={"crew": "C003", "analyte": "POTASSIUM"})
        self.assertEqual(response.status_code, 200, response.text)
        item = response.json()["items"][0]
        self.assertEqual(item["n"], 7)
        self.assertIn("already_out_and_worsening", item["flags"])
        self.assertEqual(len(item["history"]["x"]), 7)
        self.assertEqual(len(item["forecast_y"]), 4)
        risks = self.client.get("/predict/labs/risks")
        self.assertEqual(risks.status_code, 200, risks.text)
        self.assertGreater(risks.json()["count"], 0)
        self.assertIn("flags", risks.json()["risks"][0])

    def test_radiation_projection_and_role_privacy(self):
        radiation = self.client.get("/predict/radiation")
        self.assertEqual(radiation.status_code, 200, radiation.text)
        body = radiation.json()
        self.assertGreater(len(body["history"]["y"]), 24)
        self.assertTrue(body["sep_after_peak"])
        self.assertGreater(len(body["spikes_at_or_above_rule"]), 0)
        self.assertGreaterEqual(body["spikes_at_or_above_rule"][0]["rate"], 400)
        self.assertIn("not a personal dose", body["cumulative"][0]["label"].lower())
        crewmate = self.client.get("/recommendations", params={"role": "crewmate", "viewer": "C001"})
        self.assertEqual(crewmate.status_code, 200, crewmate.text)
        payload = crewmate.json()
        text = " ".join(item.get("detail") or "" for item in payload["recommendations"]).upper()
        self.assertNotIn("POTASSIUM", text)
        self.assertTrue(all(item.get("tier") == "emergency" for item in payload["broadcasts"]))
        surgeon = self.client.get("/recommendations", params={"role": "flight_surgeon", "crew": "C003"})
        titles = " ".join(item.get("title", "") for item in surgeon.json()["recommendations"]).lower()
        self.assertIn("potassium", titles)
        self.assertTrue(all(not item.get("broadcast") for item in surgeon.json()["recommendations"] if "potassium" in item.get("title", "").lower()))
