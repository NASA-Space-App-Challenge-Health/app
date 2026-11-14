# Deploy on Vercel

One Vercel project serves the static site and the FastAPI API. The build copies the whole `frontend/` tree, including the insights page, into `public/` for the CDN. API routes stay on the FastAPI app exported from `api/index.py`.

`api/index.py` exports the FastAPI `app`. `vercel.json` sets `"framework": null` (the dashboard preset **Other**), `"outputDirectory": "public"`, and the build command below. The FastAPI preset is what broke production: `/` returned API JSON, `public/` was not the site, and rewrites handed the function the path `/api/index`, so `/api/dashboard` and `/eda` 404ed. With Other, static files in `public/` are served first and the function still sees the original path.

## Project settings

Import the Git repository. Leave the root as the repository root.

| Setting | Value |
| --- | --- |
| Framework preset | **Other.** `vercel.json` sets `"framework": null`. Do not switch it back to FastAPI. |
| Root directory | Repository root (`.`). Not `frontend/` and not `backend/`. |
| Install command | Default. `requirements.txt` lists the packages itself. A file that only says `-r backend/services/api/requirements.txt` makes the Python build fail with `PYTHON_REQUIREMENTS_PARSE_ERROR`. |
| Build command | `python3 scripts/stage_vercel_public.py` (already in `vercel.json`). Copies `frontend/` into `public/`, the five NASA CSVs into `public/data/`, and `data/reference/nasa_saude_tripulacao.json` into `public/data/reference/`. |
| Output directory | **`public`**. Already set as `outputDirectory` in `vercel.json`. |
| Development command | Leave empty. Local development stays on Docker Compose. |

Python is 3.12 (`.python-version`).

## Environment variables

Set these on the Vercel project. Do not commit them.

| Name | Required | Value |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon **pooled** URL (hostname contains `-pooler`). `postgres://` is accepted. `channel_binding` is dropped if present; the pooler rejects it. `sslmode=require` is added when the URL does not set one and the host is not local. |
| `LOAD_ON_STARTUP` | Yes | `false`. This skips the CSV load on every cold start. |
| `DATABASE_STATEMENT_TIMEOUT_MS` | No | Leave unset or set `0` on the Neon pooler. A startup `options=-c statement_timeout=...` makes PgBouncer return an error and every database call 503. The app does not send that option when the host contains `-pooler`. A positive value on a pooler is applied with `SET` inside the transaction instead. A direct (non-pooler) Vercel host still defaults to 8000 ms. |
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
