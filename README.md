# Astronaut Health Monitor

Visual health-monitoring software for astronauts on space missions, built for
the NASA Space Apps Challenge 2026 challenge
[Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/).

Crew members review vitals, blood glucose, blood counts, and radiation exposure,
with plain-language explanations, illustrative risk bands, and guidance on what
to do next. The dashboard ships with **simulated** placeholder readings so the
interface can be built before real NASA datasets are connected.

This repository was generated from
[founder-haus-engineering/bootstrap_new_project](https://github.com/founder-haus-engineering/bootstrap_new_project)
and keeps that project's layout, Compose stack, scripts, and agent docs.

## Stack

- Frontend: static HTML, CSS, and JavaScript in `frontend/`. Geist, a deep-space
  dark surface, Arctic Cyan (`#00E5FF`), and Royal Purple (`#7851A9`).
- API: Python 3.12, FastAPI, and uvicorn in `backend/services/api/`.
- PostgreSQL 16 with pgvector in Docker (`postgres` service). The host-side run
  below uses PostgreSQL without requiring the pgvector image.
- Redis (`queue` service) is part of the Compose stack for later jobs. The API
  does not enqueue work yet. Health readings are stored in PostgreSQL only.

## Get started

Python 3.12 is required for the host-side API. Docker with Compose v2 is
required for the full local stack (API, PostgreSQL with pgvector, and Redis).
No NASA API key is required to run what is here.

### Full stack with Docker

From the repository root, with Docker running:

```sh
./backend/docker/compose.sh up --detach --build --wait
bash scripts/serve_frontend.sh
```

`compose.sh` creates `backend/docker/.env` from the example on first use.
Open the dashboard at <http://127.0.0.1:5173> and the API docs at
<http://127.0.0.1:8080/docs>. `GET /health` checks PostgreSQL.

`bash scripts/start.sh` opens the project menu. If Node is installed,
`npm start` opens the same menu. The menu's Start action runs the Compose
stack. Serve the dashboard with `scripts/serve_frontend.sh` either way.

### API and dashboard without Docker

Use this when you already have PostgreSQL and do not need Redis or pgvector
for the skeleton. Create the database once, matching the local defaults in
`backend/docker/.env.example`:

```sh
createuser --pwprompt app   # password: app, or set your own and export DATABASE_URL
createdb --owner=app app
```

Or, as the `postgres` superuser: `CREATE ROLE app LOGIN PASSWORD 'app';` and
`CREATE DATABASE app OWNER app;`

Then, in two terminals:

```sh
bash scripts/serve_api.sh
bash scripts/serve_frontend.sh
```

`serve_api.sh` creates `.venv`, installs `backend/services/api/requirements.txt`,
and listens on <http://127.0.0.1:8080>. The default database URL is
`postgresql://app:app@127.0.0.1:5432/app`.

## What you should see

The dashboard banner says **Simulated data**. Four fictional crew members
appear (Okonkwo, Okada, Vasquez, Chen) with vitals, glucose, blood counts, and
a cumulative radiation figure. Each reading has an explanation, a Nominal /
Watch / Concern label, and guidance that tells the crew to follow the mission
medical checklist and contact the flight surgeon. Nothing on the page is a
real medical record or a diagnosis.

## Tests

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/services/api/requirements.txt
DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app \
  .venv/bin/python -m unittest discover -s backend/services/api/tests -v
```

## Simulated data

Seeded rows use `source = simulated`. A `POST /api/readings` stores
`source = manual` and the server assigns the risk band; clients cannot submit
one. Bands are broad Earth-reference windows for the demo, not individualized
flight limits. There is no authentication. Keep the API on loopback unless you
add auth, and do not load real crew medical data into this skeleton.

## Planned open data

These sources are **not** downloaded or called yet. Notes and future snapshots
belong under [`data/`](data/README.md).

| Source | What it is for | URL |
| --- | --- | --- |
| NASA OSDR OSD-575 | Inspiration4 metabolic panel | https://osdr.nasa.gov/bio/repo/data/studies/OSD-575 |
| NASA OSDR OSD-569 | Inspiration4 blood counts | https://osdr.nasa.gov/bio/repo/data/studies/OSD-569/ |
| NASA RadLab | ISS radiation dosimetry API | https://visualization.osdr.nasa.gov/radlab/api/ |
| NASA DONKI | Solar energetic particle events | https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP |

## Configuration

| Variable | Required to run locally? | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes for the host API | `postgresql://app:app@127.0.0.1:5432/app` in `serve_api.sh` | PostgreSQL connection. Compose sets the in-container URL itself. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Local defaults | `app` / `app` / `app` | Compose database credentials. Change them before any use beyond one machine. |
| `API_PORT` | No | `8080` | Host port for the API. |
| `API_CONTAINER_PORT` | No | `8000` | Port inside the API container. Keep it equal to `PORT`. |
| `PORT` | No | `8000` | Uvicorn listen port. |
| `FRONTEND_PORT` | No | `5173` | Static dashboard server. |
| `FRONTEND_ORIGINS` | No | `http://127.0.0.1:5173,http://localhost:5173` | CORS origins allowed to call the API. |
| `MIGRATIONS_DIR` | No | repository path, or `/migrations` in Compose | Forward SQL migrations. |
| `QUEUE_URL` | No | `redis://queue:6379/0` inside Compose | Unused by the API today. |
| `frontend/config.js` `CREW_HEALTH_API_BASE` | No | `http://127.0.0.1:8080` | API origin the dashboard calls. A `?api=` query parameter overrides it. |

No NASA key, OSDR credential, RadLab key, or DONKI key is read by this app.
When DONKI is integrated later, that API accepts `api_key=DEMO_KEY` for light
demos and a key from <https://api.nasa.gov> if you pass the demo quota. OSDR
downloads may require accepting NASA's data-use terms in a browser. Do not
commit study files, tokens, or `.env`.

VM deploy additionally needs `BACKEND_SSH_HOST`, `BACKEND_DEPLOY_DIR`, and
`BACKEND_DOMAIN`. Cloudflare Pages needs `FRONTEND_OUTPUT_DIR` (use `frontend`,
there is no compile step) and `PAGES_PROJECT_NAME`. Set the dashboard's
`CREW_HEALTH_API_BASE` to the public API origin and add that Pages origin to
`FRONTEND_ORIGINS` before deploying. The API has no auth. Do not put real
health data behind the public Compose/Caddy port until that changes.
`BACKEND_HEALTH_PATH` defaults to `/`, which returns HTTP 200. `/health` also
checks the database.

## Deploy

- `scripts/deploy_frontend.sh` uploads your chosen static build to Cloudflare
  Pages (`pages.dev`). Set `FRONTEND_OUTPUT_DIR` and `PAGES_PROJECT_NAME`.
- `scripts/deploy_backend.sh` deploys all Docker services to a persistent Linux
  VM over SSH. Set `BACKEND_SSH_HOST`, `BACKEND_DEPLOY_DIR`, and `BACKEND_DOMAIN`.
  Use `--dry-run` to preview without connecting.

Read [@docs/DEPLOYMENT.md](@docs/DEPLOYMENT.md) for setup and commands. Both local
and VM-hosted Compose use persistent database and queue volumes. Back up the VM's
data and server environment file before storing important data.

## Layout

```text
frontend/                 static crew dashboard
backend/services/api/     FastAPI app and Dockerfile
backend/services/database migrations, pgvector init, SCHEMA.md
backend/services/queue/   Redis notes
backend/docker/           Compose stack and local env example
scripts/                  start, serve, and deploy helpers
data/                     planned NASA open-data notes (nothing fetched yet)
@docs/                    bootstrap, deployment, research, journal
```

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).
[@docs/BOOTSTRAP.md](@docs/BOOTSTRAP.md) records how this workspace was generated.

## Repository notes

The target repository originally contained only `README.md` with the heading
`# app`. That path conflicts with the template README. Bootstrap leaves existing
files in place, so this README was rewritten afterward: it keeps the template's
setup and deploy sections, and names this Space Apps project. The generator
also names `package.json` from the checkout directory; `workspace` was changed
to `astronaut-health-monitor`. No other files were in the target repository.
The nginx placeholder image in Compose was replaced with the FastAPI build,
and `API_CONTAINER_PORT` moved from 80 to 8000.
