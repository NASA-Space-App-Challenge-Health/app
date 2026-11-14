# Backend

This directory is a Docker Compose application made of three independent images:

- `api` is the FastAPI crew-health service. Compose builds
  `services/api/Dockerfile`. See `services/api/README.md`.
- `postgres` is PostgreSQL with the `pgvector` extension enabled.
- `queue` is Redis, a small queue/broker suitable for background work.

Use the backend-owned Compose wrapper from the project root:

```sh
./backend/docker/compose.sh up --wait
```

The API listens on `API_CONTAINER_PORT` (8000) inside the container and is
published on `127.0.0.1:API_PORT` (8080). Set those in `backend/docker/.env`.
Redis is still started for later jobs; this API stores readings in PostgreSQL
only.
`docker/compose.local.yaml` is strictly for developer-machine overrides; the
wrapper loads it automatically and keeps it out of version control.

The wrapper is also the single entry point for `ps`, `logs`, `down`, and other
Docker Compose subcommands:

```sh
./backend/docker/compose.sh ps
./backend/docker/compose.sh logs --follow api
```

Database initialization SQL belongs in `services/database/init/`; versioned
application migrations belong in `services/database/migrations/`.

## Production

Vercel runs the API as one Python function (`api/index.py`) and serves the built
frontend from the same project. Read `../docs/deploy-vercel.md` for project
settings, environment variables, and the one-off database seed. There is no VM
or Pages deploy path.
