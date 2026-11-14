# Database Schema

> [!IMPORTANT]
> pgvector is a first-class database capability, not an optional future add-on.
> Preserve `vector` extension support, model/dimension metadata, and vector-index
> strategy whenever designing search, recommendation, retrieval, or AI features.

The initial database volume enables the extension through
`init/001-enable-pgvector.sql`. Initialization SQL runs only when PostgreSQL
creates a new volume; application schema changes belong in `migrations/` and
must be safe for existing databases.

For every vector-bearing table, document and enforce:

- embedding model and exact vector dimensions (for example, `vector(1536)`)
- distance metric and query operator (`<=>`, `<->`, or `<#>`)
- index type and rationale (`hnsw` or `ivfflat`), plus its operational tradeoffs
- source content, chunk/version lineage, refresh policy, and deletion behavior

Do not silently replace vector search with JSON, text matching, or Redis data.
Keep vectors and their relational metadata in PostgreSQL unless a deliberate,
documented architecture change says otherwise.

Describe tables, relationships, constraints, indexes, and migration notes below.

## Crew health tables

`migrations/001_crew_health.sql` adds the application tables. The API applies
pending `migrations/*.sql` files on startup and records them in
`schema_migrations`. Do not edit `001_crew_health.sql` after it has been
applied; add a new file.

- `crew_members` — `id` uuid primary key, unique `call_sign`, `full_name`,
  `role`, `mission`, `created_at`.
- `health_readings` — one numeric measurement. `crew_member_id` references
  `crew_members` with `ON DELETE CASCADE`. `source` is `simulated`, `manual`, or `upload`.
  `origin` is `simulated` or `real`. `risk_band` is `nominal`, `watch`, or `concern`.
- `health_readings_latest_idx` on `(crew_member_id, indicator, recorded_at DESC)`
  supports the latest-reading query.

No table stores embeddings. pgvector stays enabled by `init/001-enable-pgvector.sql`
for a later guidance or document index. When that table is added, record the
model, exact `vector(N)` dimension, distance operator, index type, source
lineage, refresh, and deletion behavior here before shipping it. Do not move
readings or future vectors into Redis or JSON as a shortcut.

`002_groups_alerts_nasa.sql` adds `crew_groups` (`kind` is `crew` or `family`; only `crew` is used), `share_mode` on members (`full` or `alerts_only`), and real-data tables `lab_results`, `radiation_readings`, and `space_weather_events`. Simulated vitals stay in `health_readings` with `origin = simulated`. The group is generic so a later family-monitoring use can reuse it. That variant is not built.

Inspiration4 ids C001–C004 are de-identified labels from the OSDR tables, not invented names. Heart rate, sleep, cortisol, hydration, and hygiene timing are simulated.

PostgreSQL is intentionally available only to services in this Compose project.
For local inspection, use `../../docker/compose.sh exec postgres psql -U app -d app`
or add a host-port mapping in `../../docker/compose.local.yaml`. On a host
install, `psql` connects to `127.0.0.1` with `DATABASE_URL` instead.
