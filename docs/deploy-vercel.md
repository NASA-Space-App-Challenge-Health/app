# Deploy on Vercel

One Vercel project serves the React dashboard and the FastAPI API. The build
compiles the Vite app and stages the built files into `public/` for the CDN.
API routes stay on the FastAPI app exported from `api/index.py`.

`api/index.py` exports the FastAPI `app`. `vercel.json` sets `"framework": null`
(the dashboard preset **Other**), `"outputDirectory": "public"`, and the build
command below. The FastAPI preset breaks production: `/` returns API JSON,
`public/` is not the site, and rewrites hand the function the path
`/api/index`. With **Other**, static files in `public/` are served first, the
function still sees the original path, and the SPA fallback serves
`index.html` on refresh for `/dashboard`, `/insights` and `/demo`.

## Project settings

Import the Git repository. Leave the root as the repository root.

| Setting | Value |
| --- | --- |
| Framework preset | **Other.** `vercel.json` sets `"framework": null`. Do not switch it to FastAPI or Vite. |
| Root directory | Repository root (`.`). Not `frontend/` and not `backend/`. |
| Install command | Default (`npm install` at the root). `requirements.txt` lists the Python packages itself. A root file that only says `-r backend/services/api/requirements.txt` makes the Python build fail with `PYTHON_REQUIREMENTS_PARSE_ERROR`. |
| Build command | `npm --prefix frontend ci && npm --prefix frontend run build && python3 scripts/stage_vercel_public.py` (already in `vercel.json`). |
| Output directory | **`public`**. Already set as `outputDirectory` in `vercel.json`. |
| Development command | Leave empty. Local development uses Docker Compose plus the Vite dev server. |

Python is 3.12 (`.python-version`); Node 22 is the Vercel default and satisfies
Vite.

## Environment variables

Set these on the Vercel project. Do not commit them.

| Name | Required | Value |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon **pooled** URL (hostname contains `-pooler`). `postgres://` is accepted. `channel_binding` is dropped if present; the pooler rejects it. `sslmode=require` is added when the URL does not set one and the host is not local. |
| `LOAD_ON_STARTUP` | Yes | `false`. This skips the CSV load on every cold start. |
| `DATABASE_STATEMENT_TIMEOUT_MS` | No | Leave unset or set `0` on the Neon pooler. A startup `options=-c statement_timeout=...` makes PgBouncer return an error and every database call 503. The app does not send that option when the host contains `-pooler`. |
| `DATABASE_CONNECT_TIMEOUT` | No | Seconds. Default 5. |
| `FRONTEND_ORIGINS` | No | Not needed for the same-origin SPA. Set it only if a second origin will call the API. |
| `REDIS_URL`, `QUEUE_URL` | No | Leave unset. The API does not connect to Redis. |
| `HELP_REQUEST_TIMEOUT_SECONDS` | No | Seconds before a waiting help request is shown as escalated. Default 90. |

## Seed the production database once

Run this from a machine that has the repository and the CSVs under `data/`. It
applies migrations, creates the simulated crew, and loads the NASA CSVs. A
second run does not insert those rows again.

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/services/api/requirements.txt
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DBNAME' \
  PYTHONPATH=backend/services/api \
  .venv/bin/python -m app load
```

Then deploy. The function does not read the CSVs; they are not staged into
`public/` and `vercel.json` excludes `data/**` from the function bundle.

### Applying a new migration

The Vercel function runs with `LOAD_ON_STARTUP=false`, so it does **not** apply
migrations on a cold start. After adding a migration (for example
`005_help_requests.sql`), run the same one-off command once against the Neon
`DATABASE_URL` before deploying. It is idempotent: it applies only the pending
migration and skips CSVs/tables that are already loaded.

## Routing

`vercel.json` rewrites, in order:

- `/api/*`, `/predict`, `/predict/*`, `/recommendations`, `/eda/*`, `/health`,
  `/docs`, `/redoc`, `/openapi.json` → `/api/index` (the FastAPI function).
- everything else → `/index.html` (client-side routes, e.g. `/dashboard`,
  `/dashboard/radiation`, `/insights`, `/demo`, `/profile`).

Hashed assets under `/assets/*` are served straight from the CDN before the
catch-all applies.

## Uploads

Image bytes from `POST /api/images` are written under `UPLOAD_DIR`. On Vercel,
when that variable is unset, the directory is `/tmp/uploads`, created on the
first upload. `/tmp` is the only writable path on a function, and it disappears
with the instance. Treat those files as ephemeral.

`POST /api/uploads` parses a vitals CSV into Postgres and does not write a file.
Notes are rows in Postgres as well. Both last only as long as the database does.

## What the browser calls

The React app always calls same-origin relative paths (`/api/dashboard`,
`/eda/...`, `/predict/...`). In local development the Vite server proxies those
prefixes to the Compose API (`VITE_DEV_API`, default `http://127.0.0.1:8081`);
see `frontend/vite.config.js`. There is no port hard-coded in the client.

## Local Docker

```sh
./backend/docker/compose.sh up --detach --build --wait
bash scripts/serve_frontend.sh
```

The chart endpoints read Postgres, which is seeded from `data/` on startup.
Compose does not set `LOAD_ON_STARTUP`, so the API container still loads the
CSVs. Open the dashboard at <http://127.0.0.1:5173> and the API docs at
<http://127.0.0.1:8080/docs> (or 8081 if `API_PORT` is overridden).
