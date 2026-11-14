"""Vercel entrypoint and connection settings. No database required."""

from __future__ import annotations

import importlib
import json
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db  # noqa: E402
from app.repository import load_on_startup, redis_url, upload_dir  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]


class VercelConfigTests(unittest.TestCase):
    def test_asgi_entrypoint_imports_without_a_database(self):
        keys = ("DATABASE_URL", "REDIS_URL", "QUEUE_URL", "LOAD_ON_STARTUP", "VERCEL")
        saved = {key: os.environ.get(key) for key in keys}
        try:
            for key in ("DATABASE_URL", "REDIS_URL", "QUEUE_URL", "VERCEL"):
                os.environ.pop(key, None)
            os.environ["LOAD_ON_STARTUP"] = "false"
            sys.path.insert(0, str(ROOT / "api"))
            module = sys.modules.get("index") or importlib.import_module("index")
            self.assertIsNotNone(module.app)
            self.assertIn("/api/dashboard", str(module.app.url_path_for("get_dashboard")))
            self.assertIsNone(redis_url())
            self.assertFalse(load_on_startup())
        finally:
            for key, value in saved.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

    def test_rewrites_keep_predict_and_recommendations_ready(self):
        config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
        sources = {item["source"] for item in config["rewrites"]}
        self.assertIn("/api/(.*)", sources)
        self.assertIn("/predict", sources)
        self.assertIn("/predict/(.*)", sources)
        self.assertIn("/recommendations", sources)
        self.assertIn("/eda/(.*)", sources)
        self.assertIn("data/**", config["functions"]["api/index.py"]["excludeFiles"])

    def test_public_stage_includes_the_insights_page(self):
        import subprocess

        subprocess.run([sys.executable, str(ROOT / "scripts" / "stage_vercel_public.py")], check=True)
        public = ROOT / "public"
        self.assertTrue((public / "insights.html").is_file())
        self.assertTrue((public / "insights.js").is_file())
        self.assertTrue((public / "config.js").is_file())
        self.assertFalse((public / "insights" / "smoke.test.mjs").exists())
        for name in (
            "labs_long.csv",
            "radiation_iss.csv",
            "donki_sep.csv",
            "reference_ranges.csv",
            "datasets.csv",
        ):
            staged = public / "data" / name
            self.assertTrue(staged.is_file(), name)
            self.assertEqual(staged.read_bytes(), (ROOT / "data" / name).read_bytes())

    def test_vercel_upload_dir_defaults_to_tmp_and_can_be_created(self):
        keys = ("VERCEL", "UPLOAD_DIR")
        saved = {key: os.environ.get(key) for key in keys}
        try:
            os.environ.pop("UPLOAD_DIR", None)
            os.environ.pop("VERCEL", None)
            self.assertEqual(upload_dir(), Path("data/uploads"))
            os.environ["VERCEL"] = "1"
            self.assertEqual(upload_dir(), Path("/tmp/uploads"))
            os.environ["UPLOAD_DIR"] = "/tmp/uploads-override"
            folder = upload_dir()
            folder.mkdir(parents=True, exist_ok=True)
            target = folder / "image.bin"
            target.write_bytes(b"ok")
            self.assertEqual(target.read_bytes(), b"ok")
            target.unlink()
        finally:
            for key, value in saved.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

    def test_remote_database_url_requires_ssl_and_local_does_not(self):
        saved = os.environ.get("DATABASE_URL")
        try:
            os.environ["DATABASE_URL"] = "postgresql://app:app@127.0.0.1:5432/app"
            self.assertNotIn("sslmode=", db.database_url())
            os.environ["DATABASE_URL"] = "postgres://app:secret@db.example.com:5432/app"
            self.assertTrue(db.database_url().startswith("postgresql://"))
            self.assertIn("sslmode=require", db.database_url())
            os.environ["DATABASE_URL"] = "postgresql://app:secret@db.example.com:5432/app?sslmode=verify-full"
            self.assertIn("sslmode=verify-full", db.database_url())
            self.assertNotIn("sslmode=require", db.database_url())
        finally:
            if saved is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = saved

    def test_vercel_env_skips_startup_load_unless_overridden(self):
        saved_load = os.environ.get("LOAD_ON_STARTUP")
        saved_vercel = os.environ.get("VERCEL")
        try:
            os.environ.pop("LOAD_ON_STARTUP", None)
            os.environ["VERCEL"] = "1"
            self.assertFalse(load_on_startup())
            os.environ["LOAD_ON_STARTUP"] = "true"
            self.assertTrue(load_on_startup())
            os.environ["LOAD_ON_STARTUP"] = "false"
            os.environ.pop("VERCEL", None)
            self.assertFalse(load_on_startup())
        finally:
            if saved_load is None:
                os.environ.pop("LOAD_ON_STARTUP", None)
            else:
                os.environ["LOAD_ON_STARTUP"] = saved_load
            if saved_vercel is None:
                os.environ.pop("VERCEL", None)
            else:
                os.environ["VERCEL"] = saved_vercel
