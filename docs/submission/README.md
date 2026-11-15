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
- **OCHMO (Office of the Chief Health and Medical Officer) privacy roles:** a
  crewmate gets a generic emergency notice only; the CMO (Crew Medical Officer)
  and the flight surgeon get the numbers. Potassium and cortisol never broadcast.
- **Plain language:** every chart has a one-line takeaway and a link to the NASA
  source it uses; there is no diagnosis anywhere.
- **Forecasts state their uncertainty:** straight-line fits on 7 draws, 95%
  prediction intervals, and an explicit "not a physiological model" note.

## Paper / pitch (Data & Methods)

The article submitted later uses [../methodology.md](../methodology.md):

- §7 is the reference table: OSD-569/575/656 (NASA OSDR), RadLab, DONKI, HRP,
  OCHMO-TB-044/004, NASA-STD-3001, CSA, NTRS 20140003748 / Moore et al. 2014,
  SPRINT, Law et al. 2014.
- §8 is a paper-ready **Data & Methods** text in English that matches the code
  (projection formulas, rule tiers, privacy, limitations).
- [../glossary.md](../glossary.md) expands every acronym (CMO, OCHMO, OSDR, SEP…)
  for the team and for reviewers.
- What is **not** in the product and must stay out of the paper's claims:
  VO₂/Sprint integration, exercise-phase awareness, offline/two-screen demo,
  help request→accept cycle, pgvector/Redis.

## Environment

- Frontend: React 19 + Vite + Tailwind + Recharts.
- API: Python 3.12 + FastAPI.
- Database: PostgreSQL 16 with pgvector; Neon in production.
- Hosting: one Vercel project (static SPA + Python function).
