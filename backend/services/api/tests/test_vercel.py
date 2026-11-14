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
        self.assertIn("**/*.db", config["functions"]["api/index.py"]["excludeFiles"])
        self.assertIsNone(config["framework"])
        self.assertEqual(config["outputDirectory"], "public")

    def test_root_requirements_match_the_api_file(self):
        def lines(path: Path) -> list[str]:
            kept = []
            for line in path.read_text(encoding="utf-8").splitlines():
                text = line.strip()
                if text and not text.startswith("#"):
                    kept.append(text)
            return kept

        self.assertEqual(
            lines(ROOT / "requirements.txt"),
            lines(ROOT / "backend" / "services" / "api" / "requirements.txt"),
        )
        self.assertFalse(any(line.startswith("-r ") for line in lines(ROOT / "requirements.txt")))

    def test_pooler_url_drops_channel_binding_and_skips_startup_options(self):
        saved_url = os.environ.get("DATABASE_URL")
        saved_timeout = os.environ.get("DATABASE_STATEMENT_TIMEOUT_MS")
        saved_vercel = os.environ.get("VERCEL")
        try:
            os.environ["DATABASE_URL"] = (
                "postgresql://u:p@ep-example-pooler.neon.tech/neondb"
                "?sslmode=require&channel_binding=require"
            )
            os.environ["VERCEL"] = "1"
            os.environ.pop("DATABASE_STATEMENT_TIMEOUT_MS", None)
            url = db.database_url()
            self.assertNotIn("channel_binding", url)
            self.assertIn("-pooler", url)
            self.assertTrue(db.is_pooler(url))
            self.assertEqual(db.resolved_statement_timeout(None), 0)
            kwargs = db.connect_kwargs(url, 8000)
            self.assertNotIn("options", kwargs)
            direct = "postgresql://u:p@ep-example.neon.tech/neondb"
            self.assertEqual(
                db.connect_kwargs(direct, 8000)["options"],
                "-c statement_timeout=8000",
            )
        finally:
            if saved_url is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = saved_url
            if saved_timeout is None:
                os.environ.pop("DATABASE_STATEMENT_TIMEOUT_MS", None)
            else:
                os.environ["DATABASE_STATEMENT_TIMEOUT_MS"] = saved_timeout
            if saved_vercel is None:
                os.environ.pop("VERCEL", None)
            else:
                os.environ["VERCEL"] = saved_vercel

    def test_stage_script_stages_the_built_spa(self):
        """The stage script copies a Vite build, and never raw frontend sources."""
        import tempfile

        scripts = ROOT / "scripts"
        sys.path.insert(0, str(scripts))
        try:
            stage_module = importlib.import_module("stage_vercel_public")
        finally:
            sys.path.remove(str(scripts))

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            source = tmp_path / "dist"
            (source / "assets").mkdir(parents=True)
            (source / "index.html").write_text("<!doctype html>", encoding="utf-8")
            (source / "favicon.svg").write_text("<svg/>", encoding="utf-8")
            (source / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")

            dest = tmp_path / "public"
            self.assertEqual(stage_module.stage(source, dest), 3)
            self.assertTrue((dest / "index.html").is_file())
            self.assertTrue((dest / "assets" / "app.js").is_file())
            self.assertFalse((dest / "src").exists())

            # A missing build fails loudly instead of publishing source files.
            with self.assertRaises(FileNotFoundError):
                stage_module.stage(tmp_path / "frontend", dest)

    def test_vercel_build_command_builds_the_frontend_before_staging(self):
        config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
        command = config["buildCommand"]
        self.assertIn("npm --prefix frontend ci", command)
        self.assertIn("npm --prefix frontend run build", command)
        self.assertIn("scripts/stage_vercel_public.py", command)
        # A FastAPI or Vite preset would change how / and the rewrites behave.
        self.assertIsNone(config["framework"])

    def test_rewrites_serve_spa_routes_without_swallowing_assets(self):
        config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
        sources = [item["source"] for item in config["rewrites"]]
        # Client-side routes exist as explicit rewrites so /assets/* and
        # /favicon.svg stay on the CDN. A global "/(.*)" rule used to return
        # index.html for JavaScript and CSS as well.
        for route in ("/login", "/dashboard", "/dashboard/(.*)", "/insights", "/demo", "/profile"):
            self.assertIn(route, sources)
            self.assertEqual(
                config["rewrites"][sources.index(route)]["destination"],
                "/index.html",
            )
        self.assertNotIn("/(.*)", sources)
        self.assertNotIn("/((?!.*).*)", sources)

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
