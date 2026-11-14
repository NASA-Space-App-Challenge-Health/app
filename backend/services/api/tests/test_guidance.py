import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.guidance import (  # noqa: E402
    INDICATORS,
    classify,
    guidance_for,
    validate_reading,
    worst_band,
    IndicatorError,
)
from app.seed import SEED_CREW  # noqa: E402


class GuidanceTests(unittest.TestCase):
    def test_catalog_covers_explanations_and_every_band(self):
        groups = [item.group for item in INDICATORS]
        self.assertEqual(groups[0], "Vitals")
        self.assertIn("Blood glucose", groups)
        self.assertIn("Blood counts", groups)
        self.assertIn("Radiation", groups)
        self.assertEqual(groups[-1], "Simulated vitals")
        for item in INDICATORS:
            self.assertTrue(item.explanation.strip())
            self.assertTrue(item.unit.strip())
            for band in ("nominal", "watch", "concern"):
                text = guidance_for(item.key, band)
                self.assertIn("not a diagnosis", text.lower()) if band == "concern" else None
                self.assertGreater(len(text), 20)

    def test_seed_crew_are_labeled_by_illustrative_bands(self):
        expected = {
            "C001": "nominal",
            "C002": "watch",
            "C003": "nominal",
            "C004": "watch",
        }
        specifics = {
            ("C001", "heart_rate"): "nominal",
            ("C002", "sleep_hours"): "watch",
            ("C002", "cortisol_ug_dl"): "watch",
            ("C004", "hydration_liters"): "watch",
        }
        for member in SEED_CREW:
            bands = []
            for indicator, value, _hours in member["readings"]:
                numeric = validate_reading(indicator, value)
                band = classify(indicator, numeric)
                bands.append(band)
                key = (member["call_sign"], indicator)
                if key in specifics:
                    self.assertEqual(band, specifics[key], key)
            self.assertEqual(worst_band(bands), expected[member["call_sign"]])

    def test_rejects_unknown_nonfinite_and_implausible_values(self):
        with self.assertRaises(IndicatorError):
            validate_reading("not-an-indicator", 1)
        with self.assertRaises(IndicatorError):
            validate_reading("heart_rate", float("nan"))
        with self.assertRaises(IndicatorError):
            validate_reading("blood_glucose", True)
        with self.assertRaises(IndicatorError):
            validate_reading("blood_glucose", 5000)
        self.assertEqual(classify("blood_glucose", validate_reading("blood_glucose", 40)), "concern")

    def test_worst_band_prefers_concern_and_allows_empty(self):
        self.assertIsNone(worst_band([]))
        self.assertEqual(worst_band(["nominal", "watch", "concern"]), "concern")
        self.assertEqual(worst_band(["nominal", "nominal"]), "nominal")
