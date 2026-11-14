# Submission kit — NASA Space Apps Challenge 2026

Project: **Astronaut Health Monitor** (challenge: *Create Health Monitoring
Software for Astronauts on Space Missions*).

| Asset | Where |
| --- | --- |
| Live demo | <https://nasa-health-app.vercel.app> |
| Repository | <https://github.com/NASA-Space-App-Challenge-Health/app> |
| Data notes | [../eda.md](../eda.md), [../predictive.md](../predictive.md), [../research.md](../research.md) |
| Screenshots | [../screenshots/](../screenshots/) |
| One-pager (PDF) | [one-pager.pdf](one-pager.pdf) |
| Cover image (1200×630) | [cover.png](cover.png) |
| Video script | [video-script.md](video-script.md) |

## Before the deadline

- [ ] Record the demo video from [video-script.md](video-script.md) (≤ 2 min, 1080p).
- [ ] Publish the project page on the Space Apps platform: title, short
      description, "what we built", tech stack, data sources, links.
- [ ] Upload the video and paste the live demo + repository links.
- [ ] Use [cover.png](cover.png) as the project thumbnail.
- [ ] Re-read the challenge rules on citations and data use.
- [ ] Final smoke test: open the live demo in an incognito window and walk the
      guided demo once.

## Talking points (short)

- **Real NASA data, labelled on screen:** Inspiration4 CBC/CMP/cytokine labs
  (OSD-569, OSD-575, OSD-656), one ISS DosTel radiation week, 119 DONKI SEP
  events for 2024.
- **Simulated and labelled:** heart rate, SpO2, cabin CO2, temperature, sleep,
  cortisol, hydration, hygiene timing.
- **OCHMO privacy roles:** a crewmate gets a generic emergency notice only; the
  CMO and flight surgeon get the numbers. Potassium and cortisol never broadcast.
- **Plain language:** every chart has a one-line takeaway and a link to the NASA
  source it uses; there is no diagnosis anywhere.
- **Forecasts state their uncertainty:** straight-line fits on 7 draws, 95%
  prediction intervals, and an explicit "not a physiological model" note.

## Environment

- Frontend: React 19 + Vite + Tailwind + Recharts.
- API: Python 3.12 + FastAPI.
- Database: PostgreSQL 16 with pgvector; Neon in production.
- Hosting: one Vercel project (static SPA + Python function).
