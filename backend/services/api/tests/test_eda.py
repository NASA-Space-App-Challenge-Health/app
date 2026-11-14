import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@unittest.skipUnless(os.environ.get("DATABASE_URL"), "DATABASE_URL is not set")
class EdaApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient

        from app.main import app

        cls._client = TestClient(app)
        cls.client = cls._client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls._client.__exit__(None, None, None)

    def test_overview_counts_the_loaded_tables(self):
        response = self.client.get("/eda/overview")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["crew_count"], 4)
        self.assertEqual(body["lab_rows"], 13249)
        self.assertEqual(body["sep_events"], 119)
        self.assertEqual(body["radiation_days"], 7)
        self.assertGreater(body["reference_range_rows"], 0)
        self.assertGreater(body["dataset_catalog_rows"], 0)
        self.assertEqual(body["out_of_range_rows"], 44)
        self.assertGreater(body["flagged_analytes"], 0)
        self.assertGreater(body["pct_out_of_range"], 0)

    def test_out_of_range_splits_low_and_high(self):
        response = self.client.get("/eda/labs/out_of_range")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertIn("GLUCOSE", body["analyte"])
        index = body["analyte"].index("GLUCOSE")
        self.assertGreater(body["low"][index] + body["high"][index], 0)

    def test_trends_and_analyte_list(self):
        names = self.client.get("/eda/labs/analytes")
        self.assertEqual(names.status_code, 200)
        self.assertTrue(any(item["analyte"] == "POTASSIUM" for item in names.json()["analytes"]))
        trends = self.client.get("/eda/labs/trends", params={"analyte": "POTASSIUM"})
        self.assertEqual(trends.status_code, 200, trends.text)
        body = trends.json()
        self.assertEqual(len(body["traces"]), 4)
        c003 = next(trace for trace in body["traces"] if trace["name"] == "C003")
        self.assertIn("L-3", c003["x"])
        self.assertEqual(c003["y"][c003["x"].index("L-3")], 3.3)

    def test_shift_sunburst_and_flow_are_plotly_arrays(self):
        shift = self.client.get("/eda/labs/shift").json()
        self.assertGreater(len(shift["analyte"]), 0)
        self.assertEqual(len(shift["analyte"]), len(shift["mean_percent"]))
        sun = self.client.get("/eda/labs/sunburst").json()
        self.assertEqual(len(sun["labels"]), len(sun["parents"]))
        self.assertEqual(len(sun["labels"]), len(sun["values"]))
        self.assertIn("blood/immune", sun["labels"])
        flow = self.client.get("/eda/labs/flow").json()
        phase = flow["phase_to_status"]
        self.assertEqual(len(phase["source"]), len(phase["value"]))
        self.assertIn("pre-flight", phase["label"])

    def test_radiation_series_and_extremes(self):
        radiation = self.client.get("/eda/radiation/series")
        self.assertEqual(radiation.status_code, 200, radiation.text)
        body = radiation.json()
        names = {trace["name"] for trace in body["series"]}
        self.assertIn("DosTel1", names)
        self.assertEqual(len(body["daily"]["x"]), 7)
        self.assertEqual(sum(body["sep_by_month"]["y"]), 119)
        extremes = self.client.get("/eda/extremes").json()
        self.assertGreater(len(extremes["rows"]), 0)
        self.assertIsNotNone(extremes["rows"][0]["z_score"])
        self.assertIn(extremes["rows"][0]["crew_id"], {"C001", "C002", "C003", "C004"})
