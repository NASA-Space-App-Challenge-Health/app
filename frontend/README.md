# Crew dashboard (React + Vite)

The product UI. It talks to the FastAPI service with same-origin relative paths
(`/api/dashboard`, `/eda/...`, `/predict/...`, `/recommendations`).

## Structure

```text
index.html            Vite entry
src/main.jsx          React root
src/App.jsx           routes: /login, /dashboard, /dashboard/:categoria,
                      /insights
src/api.js            API client + role/crew constants
src/hooks/useFetch.js loading, error, retry
src/context/          viewer/role context (OCHMO privacy demo)
src/components/       Layout, Card, Chip, SourceLinks, StateView, dashboard/*,
                      insights/*
src/pages/            Login, Dashboard, CategoryPage, Insights, Demo, Profile
public/favicon.svg    app icon
```

## Development

```sh
npm ci
npm run dev        # http://127.0.0.1:5173
```

`vite.config.js` proxies `/api`, `/eda`, `/predict`, `/recommendations`,
`/health`, and `/docs` to `VITE_DEV_API` (default `http://127.0.0.1:8080`), so
the pages never hard-code an API origin and production stays same-origin.

```sh
npm run lint       # oxlint
npm run build      # dist/, staged into public/ for Vercel by scripts/stage_vercel_public.py
```

The design baseline is the deep-space dark surface with Arctic Cyan (`#00e5ff`)
and Royal Purple (`#7851a9`). Colour is never the only state signal: every chip
carries a text label, and explanations sit behind `<details>` so the board stays
short.
