# Frontend

Static crew dashboard. No package manager and no build step. Geist Sans (OFL,
see `fonts/OFL.txt`) is vendored. Tokens live in `styles.css`:
`color-bg-deep-space`, `color-surface`, `color-text-primary`,
`color-accent-arctic-cyan` (`#00E5FF`), and `color-accent-royal-purple`
(`#7851A9`).

## Run

Start the API first, then:

```sh
bash scripts/serve_frontend.sh
```

Open <http://127.0.0.1:5173>. The page always shows a simulated-data banner.
Readings come from `GET /api/dashboard`. `config.js` sets the API origin.
`?api=http://127.0.0.1:8080` overrides it for one visit.

The dashboard talks only to the API. It never receives database credentials.

For Cloudflare Pages, set `FRONTEND_OUTPUT_DIR=frontend`. Point
`CREW_HEALTH_API_BASE` at the public API and add the Pages origin to
`FRONTEND_ORIGINS`.
