# Deploy on Vercel

One Vercel project serves the static site and the FastAPI API. The build copies the whole `frontend/` tree, including the insights page, into `public/` for the CDN. API routes stay on the FastAPI app exported from `api/index.py`.

This follows the current Vercel Python runtime: a FastAPI `app` in `api/index.py` is a recognized entrypoint, the app becomes one Function, and `vercel.json` rewrites send the API paths to that function. Static files in `public/` are matched before those rewrites.

`/predict` and `/recommendations` are already rewritten to the same function. They answer once the routes from the predictions branch are on `main`. Until then those paths 404 from FastAPI, and the rest of the API still works.

## Project settings

Import the Git repository. Leave the root as the repository root.

| Setting | Value |
| --- | --- |
| Framework preset | **FastAPI**. Vercel detects it from `requirements.txt` and `api/index.py`. Do not pick Other, Next.js, or a static-only preset. |
| Root directory | Repository root (`.`). Not `frontend/` and not `backend/`. |
| Install command | Default. That runs `pip install -r requirements.txt`, which includes the API requirements. |
| Build command | `python3 scripts/stage_vercel_public.py` (already set in `vercel.json`). It copies the whole `frontend/` tree, including `insights.html`, into `public/`, plus the five NASA CSVs into `public/data/` for the insights fallback. |
| Output directory | **Empty.** Do not set `public` or `frontend`. An output directory would publish a static site and drop the Function. |
| Development command | Leave empty. Local development stays on Docker Compose. |

Python is 3.12 (`.python-version`).

## Environment variables

Set these on the Vercel project. Do not commit them.

| Name | Required | Value |
| --- | --- | --- |
| `DATABASE_URL` | Yes | The team's production Postgres URL. `postgres://` is accepted. If `sslmode` is missing and the host is not local, the app adds `sslmode=require`. A pooler URL (PgBouncer, transaction mode) is fine: each request opens one connection and does not prepare statements. |
| `LOAD_ON_STARTUP` | Yes | `false`. This skips the CSV load on every cold start. Vercel also sets `VERCEL=1`, which skips the load when this variable is unset. Set it anyway. |
| `DATABASE_STATEMENT_TIMEOUT_MS` | No | Optional. On Vercel the default is 8000 ms. The one-off seed does not use that default. |
| `DATABASE_CONNECT_TIMEOUT` | No | Seconds. Default 5. |
| `FRONTEND_ORIGINS` | No | Not needed for the same-origin dashboard. Set it only if a second origin will call the API. |
| `REDIS_URL` | No | Leave unset. The API does not connect to Redis. |
| `QUEUE_URL` | No | Leave unset. Compose still injects it for local Redis, and the API ignores it. |

## Seed the production database once

Run this from a machine that has the repository and the CSVs under `data/`. It applies migrations, creates the simulated crew, and loads the NASA CSVs. A second run does not insert those rows again. If the database role cannot create `pgvector`, the seed logs that and continues.

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/services/api/requirements.txt
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DBNAME' \
  PYTHONPATH=backend/services/api \
  .venv/bin/python -m app load
```

Then deploy. The Function does not read the CSVs. The build copies those five files to `public/data/` so the insights page can fall back to them if the API is down. `vercel.json` still excludes `data/**` from the function bundle.

## Uploads

Image bytes from `POST /api/images` are written under `UPLOAD_DIR`. On Vercel, when that variable is unset, the directory is `/tmp/uploads`, created on the first upload. `/tmp` is the only writable path on a function, and it disappears with the instance. Treat those files as ephemeral. Durable file storage would be Vercel Blob, which this app does not use.

`POST /api/uploads` parses a vitals CSV into Postgres and does not write a file. Notes are rows in Postgres as well. Both last only as long as the database does.

## What the browser calls

On Vercel the dashboard uses the same origin, so `fetch("/api/dashboard")` hits this project. On the local static server (`scripts/serve_frontend.sh`, port 5173) it still calls `http://127.0.0.1:8080`. `?api=` overrides either one.

Rewritten paths: `/api/*`, `/predict`, `/predict/*`, `/recommendations`, `/eda/*`, `/health`, `/docs`, `/redoc`, `/openapi.json`.

## Local Docker

Compose is unchanged:

```sh
./backend/docker/compose.sh up --detach --build --wait
bash scripts/serve_frontend.sh
```

Compose does not set `LOAD_ON_STARTUP`, so the API container still loads the CSVs on startup. Redis in Compose stays optional for the app.
