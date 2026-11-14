import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.access import broadcasts, project_finding  # noqa: E402
from app.nasa_loader import read_bundle  # noqa: E402
from app.rules_engine import (  # noqa: E402
    load_rules,
    radiation_emergency,
    sleep_cortisol_recommendations,
    worsening_lab_recommendations,
)


class AccessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rules = load_rules()
        bundle = read_bundle()
        cls.radiation = radiation_emergency(bundle["doses"], bundle["events"], cls.rules)
        cls.potassium = next(
            item for item in worsening_lab_recommendations(bundle["labs"], cls.rules)
            if item["evidence"]["analyte"] == "POTASSIUM" and item["evidence"]["crew_id"] == "C003"
        )
        now = datetime.now(timezone.utc)
        rows = []
        for index, (sleep, cortisol) in enumerate(((5.1, 21), (4.9, 23), (5.4, 19))):
            when = now + timedelta(hours=index)
            rows.append({"crew_id": "C002", "indicator": "sleep_hours", "value": sleep, "recorded_at": when, "origin": "simulated"})
            rows.append({"crew_id": "C002", "indicator": "cortisol_ug_dl", "value": cortisol, "recorded_at": when, "origin": "simulated"})
        cls.behavior = sleep_cortisol_recommendations(rows, cls.rules)[0]

    def test_only_emergencies_broadcast_and_the_text_has_no_diagnosis(self):
        notes = broadcasts([self.radiation, self.potassium, self.behavior])
        self.assertEqual([item["id"] for item in notes], ["radiation_with_sep"])
        blob = (notes[0]["title"] + notes[0]["detail"]).lower()
        self.assertIn("radiation contingency", blob)
        self.assertNotIn("potassium", blob)
        self.assertNotIn("cortisol", blob)
        self.assertNotIn("528", blob)
        self.assertFalse(self.potassium["broadcast"])
        self.assertFalse(self.behavior["broadcast"])
        self.assertEqual(self.potassium["tier"], "cmo")
        self.assertEqual(self.behavior["tier"], "flight_surgeon")

    def test_crewmate_and_commander_do_not_receive_the_potassium_value(self):
        for role in ("crewmate", "commander"):
            shown = project_finding(self.potassium, role=role, viewer="C001", shares={})
            self.assertIsNone(shown)
        crew_broadcast = project_finding(self.radiation, role="crewmate", viewer="C001", shares={})
        self.assertNotIn("528", crew_broadcast["detail"])
        self.assertIsNone(crew_broadcast["evidence"])
        commander = project_finding(self.radiation, role="commander", viewer="C001", shares={})
        self.assertIn("mission ops", commander["commander_note"])
        self.assertIsNone(commander["evidence"])

    def test_flight_surgeon_sees_behavior_and_cmo_does_not(self):
        self.assertIsNone(project_finding(self.behavior, role="cmo", viewer="C001", shares={}))
        seen = project_finding(self.behavior, role="flight_surgeon", viewer="C001", shares={})
        self.assertIn("simulated", seen["detail"].lower())
        self.assertIn("private", seen["suggested_action"].lower())

    def test_opt_in_shares_a_lab_with_a_crewmate_only(self):
        hidden = project_finding(self.potassium, role="crewmate", viewer="C001", shares={})
        self.assertIsNone(hidden)
        shown = project_finding(
            self.potassium,
            role="crewmate",
            viewer="C001",
            shares={"C003": {"POTASSIUM"}},
        )
        self.assertEqual(shown["evidence"]["earlier_value"], 3.3)
        self.assertTrue(shown["shared_by_opt_in"])
