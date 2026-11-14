import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.nasa_loader import read_bundle  # noqa: E402
from app.rules_engine import (  # noqa: E402
    critical_glucose_alerts,
    load_rules,
    radiation_emergency,
    sleep_cortisol_recommendations,
    vital_emergencies,
    worsening_lab_recommendations,
)
from app.schedule import plan_hygiene  # noqa: E402


class RuleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = read_bundle()
        cls.rules = load_rules()

    def test_real_radiation_pairs_with_the_following_sep(self):
        alert = radiation_emergency(self.bundle["doses"], self.bundle["events"], self.rules)
        self.assertIsNotNone(alert)
        self.assertEqual(alert["severity"], "critical")
        self.assertEqual(alert["origin"], "real")
        self.assertEqual(alert["audience"], "all")
        self.assertGreater(alert["evidence"]["absorbed_dose_rate"], 400)
        self.assertEqual(alert["evidence"]["instrument_id"], "DosTel1")
        self.assertEqual(alert["evidence"]["sep_id"], "2024-06-08T02:25:00-SEP-001")
        self.assertGreater(alert["evidence"]["hours_after_peak"], 48)
        self.assertLess(alert["evidence"]["hours_after_peak"], 96)
        urls = {item["url"] for item in alert["sources"]}
        self.assertIn("https://www.nasa.gov/hrp/hazards/", urls)
        self.assertIn("https://visualization.osdr.nasa.gov/radlab/gui/data-api/", urls)
        self.assertIn("https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/31338/-1", urls)
        self.assertIn("not a personal dosimeter", alert["detail"])

    def test_radiation_rule_rejects_a_distant_sep(self):
        peak = max(self.bundle["doses"], key=lambda row: row["absorbed_dose_rate"])
        far = {
            "sep_id": "far",
            "event_time": peak["recorded_at"] + timedelta(days=30),
            "instruments": "TEST",
            "link": "https://example.invalid",
        }
        self.assertIsNone(radiation_emergency([peak], [far], self.rules))

    def test_real_potassium_shift_is_the_featured_preventive_rule(self):
        found = worsening_lab_recommendations(self.bundle["labs"], self.rules)
        match = [
            item for item in found
            if item["evidence"]["crew_id"] == "C003"
            and item["evidence"]["analyte"] == "POTASSIUM"
            and item["evidence"]["earlier_timepoint"] == "L-3"
            and item["evidence"]["later_timepoint"] == "R+1"
        ]
        self.assertEqual(len(match), 1)
        evidence = match[0]["evidence"]
        self.assertEqual(evidence["earlier_value"], 3.3)
        self.assertEqual(evidence["later_value"], 3.0)
        self.assertEqual(match[0]["origin"], "real")
        urls = {item["url"] for item in match[0]["sources"]}
        self.assertIn("https://osdr.nasa.gov/bio/repo/data/studies/OSD-575", urls)
        self.assertIn("https://www.nasa.gov/hrp/hazards/", urls)
        self.assertIn("before that later result", match[0]["detail"])

    def test_worsening_rule_ignores_a_recovery(self):
        rows = [
            {"crew_id": "C009", "panel": "CMP", "analyte": "POTASSIUM", "timepoint": "L-3",
             "days_from_launch": -3, "value": 3.3, "flag": "low", "unit": "mmol/L",
             "ref_low": 3.5, "ref_high": 5.3, "source_study": "OSD-575"},
            {"crew_id": "C009", "panel": "CMP", "analyte": "POTASSIUM", "timepoint": "R+1",
             "days_from_launch": 1, "value": 4.0, "flag": "normal", "unit": "mmol/L",
             "ref_low": 3.5, "ref_high": 5.3, "source_study": "OSD-575"},
        ]
        found = worsening_lab_recommendations(rows, self.rules)
        self.assertFalse(any(item["evidence"]["crew_id"] == "C009" for item in found))

    def test_sleep_rule_is_labeled_simulated_and_cites_hrp(self):
        now = datetime.now(timezone.utc)
        rows = []
        for index, (sleep, cortisol) in enumerate(((5.1, 21), (4.9, 23), (5.4, 19))):
            when = now + timedelta(hours=index)
            rows.append({"crew_id": "C002", "indicator": "sleep_hours", "value": sleep, "recorded_at": when, "origin": "simulated"})
            rows.append({"crew_id": "C002", "indicator": "cortisol_ug_dl", "value": cortisol, "recorded_at": when, "origin": "simulated"})
        found = sleep_cortisol_recommendations(rows, self.rules)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["origin"], "simulated")
        urls = {item["url"] for item in found[0]["sources"]}
        self.assertIn("https://www.nasa.gov/hrp/risks/", urls)
        quiet = [{"crew_id": "C001", "indicator": "sleep_hours", "value": 7.5, "recorded_at": now, "origin": "simulated"},
                 {"crew_id": "C001", "indicator": "cortisol_ug_dl", "value": 12, "recorded_at": now, "origin": "simulated"}]
        self.assertEqual(sleep_cortisol_recommendations(quiet * 3, self.rules), [])

    def test_heart_rate_and_impact_alerts_from_fixtures(self):
        now = datetime.now(timezone.utc)
        rows = [
            {"crew_id": "C009", "indicator": "heart_rate", "value": 146, "recorded_at": now, "origin": "simulated"},
            {"crew_id": "C009", "indicator": "impact_event", "value": 1, "recorded_at": now, "origin": "simulated"},
        ]
        found = {item["id"]: item for item in vital_emergencies(rows, self.rules)}
        self.assertEqual(found["heart_rate"]["severity"], "critical")
        self.assertEqual(found["impact"]["audience"], "all")
        self.assertIn("https://www.nasa.gov/hrp/risks/", {item["url"] for item in found["heart_rate"]["sources"]})

    def test_real_low_glucose_alert_uses_the_file_value(self):
        alerts = critical_glucose_alerts(self.bundle["labs"], self.rules)
        values = {(item["evidence"]["crew_id"], item["evidence"]["timepoint"], item["evidence"]["value"]) for item in alerts}
        self.assertIn(("C003", "R+45", 36.0), values)
        self.assertTrue(all(item["origin"] == "real" for item in alerts))
        self.assertTrue(all(item["evidence"]["value"] < 54 for item in alerts))

    def test_hygiene_estimate_sends_the_lower_intake_first(self):
        plan = plan_hygiene([
            {"crew_id": "C001", "hygiene_hour": 6.5, "hydration_liters": 2.8},
            {"crew_id": "C002", "hygiene_hour": 7.0, "hydration_liters": 2.4},
            {"crew_id": "C004", "hygiene_hour": 7.25, "hydration_liters": 1.7},
            {"crew_id": "C003", "hygiene_hour": 21.0, "hydration_liters": 2.5},
        ])
        self.assertEqual(plan["order"][0], "C004")
        self.assertEqual(plan["origin"], "simulated")
        self.assertIn("estimate", plan["suggestion"].lower())
