# API service

Python 3.12 FastAPI service for crew members and health readings. Compose builds
`Dockerfile` here (`build: ../services/api` in `../../docker/compose.yaml`).
The process listens on `PORT` (default 8000). The host mapping is `API_PORT`
(default 8080) in `../../docker/.env`.

## Run

Docker, from the repository root:

```sh
./backend/docker/compose.sh up --detach --build --wait
```

Host process, with `DATABASE_URL` pointing at PostgreSQL:

```sh
bash scripts/serve_api.sh
```

## HTTP

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Service description. HTTP 200 for the deploy probe. |
| `GET` | `/health` | PostgreSQL readiness. 503 when the database is down. |
| `GET` | `/api/dashboard?viewer=C001` | Crew board, alerts, demo script, hygiene estimate, and insights. `viewer` is whose privacy view you are using. |
| `GET` | `/api/demo` | Guided demo steps: radiation emergency, then the potassium preventive rule. |
| `GET` | `/api/insights` | Common lab flags, worsening pairs, extremes. |
| `POST` | `/api/crew/{id}/sharing` | Body `{"share_mode": "full"}` or `"alerts_only"`. |
| `POST` | `/api/uploads` | Multipart CSV of simulated vitals. See `data/UPLOAD_SCHEMA.md`. |
| `GET` | `/eda/overview` and the other `/eda/...` routes | Chart JSON from Postgres. See `docs/eda.md`. |
| `GET` | `/api/crew` | Crew roster and overall band. |
| `POST` | `/api/crew` | Add a crew member. No readings yet. |
| `GET` | `/api/crew/{id}` | One crew member, with every indicator filled or marked missing. |
| `GET` | `/api/readings?crew_member_id=` | Reading history, newest first. |
| `POST` | `/api/readings` | Store a number. The server sets `source=manual` and the risk band. |
| `GET` | `/docs` | Interactive OpenAPI. |

C001–C004 are the de-identified Inspiration4 ids. Heart rate, sleep, cortisol, hydration, and hygiene timing are simulated. Labs, DosTel, and DONKI rows are real. There is no authentication.
Bind the service to loopback, which Compose already does, until auth exists.

PostgreSQL is the system of record. Redis is injected as `QUEUE_URL` and is
not used yet. Schema changes go in `../database/migrations/` and are applied
on startup. Decisions are recorded in `../database/SCHEMA.md`.
