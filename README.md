# Astronaut Health Monitor

Visual health-monitoring software for astronauts on space missions, built for
the NASA Space Apps Challenge 2026 challenge
[Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/).

One board for the crew: real Inspiration4 labs and ISS/DONKI radiation context
plus simulated heart rate, sleep, cortisol, hydration, and hygiene timing. A
guided demo walks a real emergency alert and a real preventive recommendation,
each with the NASA page it uses. A plain-language insights page turns the same
tables into short takeaways for non-clinicians.

This repository was generated from
[founder-haus-engineering/bootstrap_new_project](https://github.com/founder-haus-engineering/bootstrap_new_project)
and keeps that project's layout, Compose stack, scripts, and agent docs.

![Crew board](docs/screenshots/dashboard.png)

| Data insights | Radiation & temperature |
| --- | --- |
| ![Data insights](docs/screenshots/insights.png) | ![Radiation](docs/screenshots/radiation.png) |

Mobile (390px):

| Board | Navigation |
| --- | --- |
| ![Mobile board](docs/screenshots/mobile-dashboard.png) | ![Mobile drawer](docs/screenshots/mobile-drawer.png) |

## Stack

- Frontend: React 19 with Vite, Tailwind CSS, Recharts, and `react-router-dom`
  in `frontend/`. Same-origin API calls, no hard-coded port.
- API: Python 3.12, FastAPI, and uvicorn in `backend/services/api/`.
- PostgreSQL 16 with pgvector in Docker (`postgres` service). The host-side run
  uses PostgreSQL without requiring the pgvector image.
- Redis (`queue` service) is part of the Compose stack for later jobs. The API
  does not enqueue work yet.

The domain model is a **group** of members. `crew_groups.kind` is `crew` today
and may be `family` later, so the same core could watch an older relative at
home. That variant is not built.

## Screens

| Route | What it shows |
| --- | --- |
| `/login` | Simulated biometric hand-off from the design screens. |
| `/dashboard` | Crew board: status band, emergency notice, crew cards, vitals, labs, body map, hygiene estimate, and the top recommendations. |
| `/dashboard/brain` | Sleep and cortisol (simulated), plus what the public data does not cover. |
| `/dashboard/heart` | Heart rate, SpO2, blood-count labs, glucose trend, and a forecast interval. |
| `/dashboard/radiation` | One ISS DosTel week, DONKI SEP counts, and the area-dose summary. |
| `/dashboard/muscles` | Honest empty panel: the package has no measured bone or muscle values. |
| `/insights` | Plain-language data insights with filters (crew, topic, view, out-of-range). |
| `/demo` | Guided four-step demo: privacy, radiation emergency, potassium prevention, what is still simulated. |
| `/profile` | Crew profile and the released research labs for the selected member. |

The header selects **viewer** (C001–C004) and **role** (self, CMO, flight
surgeon, crewmate, commander). That is the OCHMO privacy demo: a crewmate sees a
generic emergency notice only; potassium and cortisol stay with the flight
surgeon.

## Real vs simulated

- **Real NASA**, badged on screen: Inspiration4 CBC/CMP (`labs_long.csv`, OSD-569
  and OSD-575), urine cytokine rows (OSD-656), one week of ISS DosTel rates
  (`radiation_iss.csv`), and 2024 DONKI SEP events (`donki_sep.csv`). The
  manifest is `data/datasets.csv`.
- **Simulated**, badged on screen: heart rate, SpO2, cabin CO2, body
  temperature, sleep, cortisol, hydration, and hygiene-station timing. Those
  series are not in the public tables.

## Get started

Python 3.12 is required for the host-side API, Node 20.19+ for the frontend, and
Docker with Compose v2 for the full local stack. No NASA API key is required.

### Full stack with Docker

From the repository root, with Docker running:

```sh
./backend/docker/compose.sh up --detach --build --wait
bash scripts/serve_frontend.sh
```

`compose.sh` creates `backend/docker/.env` from the example on first use. Open
the dashboard at <http://127.0.0.1:5173> and the API docs at
<http://127.0.0.1:8080/docs>. `GET /health` checks PostgreSQL.

`bash scripts/start.sh` opens the project menu. If Node is installed,
`npm start` opens the same menu. The Vite dev server proxies `/api`, `/eda`,
`/predict`, and `/recommendations` to the API (default
`http://127.0.0.1:8080`; set `API_PORT` or `VITE_DEV_API` to change it).

### API and dashboard without Docker

Use this when you already have PostgreSQL and do not need Redis or pgvector.
Create the database once, matching the local defaults in
`backend/docker/.env.example`:

```sh
createuser --pwprompt app   # password: app, or set your own and export DATABASE_URL
createdb --owner=app app
```

Then, in two terminals:

```sh
bash scripts/serve_api.sh
bash scripts/serve_frontend.sh
```

`serve_api.sh` creates `.venv`, installs `backend/services/api/requirements.txt`,
and listens on <http://127.0.0.1:8080>. The default database URL is
`postgresql://app:app@127.0.0.1:5432/app`.

## What you should see

The board opens with a **Real NASA / Simulated** chip pair, the C001 view, and
one emergency notice generated from two real records: the peak DosTel1 absorbed
dose rate (528.5 μGy/h on 2024-06-05) and the next DONKI SEP event (2024-06-08,
about 73 hours later). Real lab rows appear with the NASA study id; simulated
vitals carry a **Simulated** chip. Nothing on the page is a real medical record
or a diagnosis.

## Tests

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/services/api/requirements.txt
DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app \
  .venv/bin/python -m unittest discover -s backend/services/api/tests -v

npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend run build
```

`.github/workflows/tests.yml` runs the backend suite against a PostgreSQL
service, lints and builds the frontend, and stages the Vercel output.

## Deploy

One Vercel project serves the React dashboard and the FastAPI function.
`vercel.json` sets the build command, the `public` output directory, and the
rewrites for the API and the client-side routes. Read
[docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md) for project settings, env vars,
and the one-off database seed.

VM deploy (`scripts/deploy_backend.sh` over SSH with Caddy) and Cloudflare Pages
(`scripts/deploy_frontend.sh` for `frontend/dist`) remain available. Read
[@docs/DEPLOYMENT.md](@docs/DEPLOYMENT.md) for setup and commands.

## Configuration

| Variable | Required to run locally? | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes for the host API | `postgresql://app:app@127.0.0.1:5432/app` in `serve_api.sh` | PostgreSQL connection. Compose sets the in-container URL itself. |
| `DATA_DIR` | No | repository `data/` on the host, `/data` in Compose | NASA CSVs. Compose mounts that folder read-only. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Local defaults | `app` / `app` / `app` | Compose database credentials. Change them before any use beyond one machine. |
| `API_PORT` | No | `8080` | Host port for the API. |
| `API_CONTAINER_PORT` | No | `8000` | Port inside the API container. Keep it equal to `PORT`. |
| `PORT` | No | `8000` | Uvicorn listen port. |
| `FRONTEND_PORT` | No | `5173` | Vite dev-server port. |
| `VITE_DEV_API` | No | `http://127.0.0.1:8080` | API origin the Vite proxy targets in development. |
| `FRONTEND_ORIGINS` | No | `http://127.0.0.1:5173,http://localhost:5173` | CORS origins allowed to call the API. |
| `MIGRATIONS_DIR` | No | repository path, or `/migrations` in Compose | Forward SQL migrations. |
| `QUEUE_URL` | No | `redis://queue:6379/0` inside Compose | Unused by the API today. |

No NASA key, OSDR credential, RadLab key, or DONKI key is read by this app. Do
not commit study files, tokens, or `.env`.

## Data scope, stated plainly

Four Inspiration4 civilians, seven pre/post-flight lab timepoints from a
three-day flight, one ISS DosTel week in June 2024 (a vehicle measurement, not a
personal dosimeter), and 119 DONKI SEP rows for 2024. There is no in-flight
blood draw and no continuous crew vitals in the public tables. Risk cutoffs in
`backend/services/api/rules/rules.yaml` are app settings, not flight-surgeon
limits. Read [data/README.md](data/README.md), [docs/EDA.md](docs/EDA.md), and
[docs/PREDICTIVE.md](docs/PREDICTIVE.md) for the numbers and the methods.

## Layout

```text
frontend/                 React dashboard (Vite, Tailwind, Recharts)
backend/services/api/     FastAPI app, rules, tests, Dockerfile
backend/services/database migrations, pgvector init, SCHEMA.md
backend/docker/           Compose stack and local env example
api/index.py              Vercel entrypoint for the FastAPI app
scripts/                  start, serve, stage, and deploy helpers
data/                     NASA open data (CSVs and source manifest)
@docs/                    bootstrap, deployment, research, journal
docs/                     EDA, predictive notes, Vercel deploy
```

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).
