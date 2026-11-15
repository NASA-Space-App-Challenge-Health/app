# Submission kit — NASA Space Apps Challenge 2026

Project: **T.H.A.I.S. — Astronaut Health Monitor**
(T.H.A.I.S. = **Tech & Health Astronaut Intelligent System**; challenge:
*Create Health Monitoring Software for Astronauts on Space Missions*).

| Asset | Where |
| --- | --- |
| Live demo | <https://nasa-health-app.vercel.app> |
| Repository | <https://github.com/NASA-Space-App-Challenge-Health/app> |
| Data notes | [../eda.md](../eda.md), [../predictive.md](../predictive.md), [../research.md](../research.md) |
| Screenshots | [../screenshots/](../screenshots/) |
| Help loop proof | [../screenshots/help-loop.png](../screenshots/help-loop.png) |
| One-pager (PDF) | [one-pager.pdf](one-pager.pdf) |
| Cover image (1200×630) | [cover.png](cover.png) |
| Video script | [video-script.md](video-script.md) |

## Before the deadline

- [ ] Record the demo video from [video-script.md](video-script.md) (≤ 2 min, 1080p).
- [ ] Publish the project page on the Space Apps platform: title, short
      description, "what we built", tech stack, data sources, links.
- [ ] Upload the video and paste the live demo + repository links.
- [ ] Use [cover.png](cover.png) as the project thumbnail.
- [ ] Rehearse the two-session help loop (C003 asks, C001 accepts) and confirm
      **Help on the way** appears in ≤3 s before recording.
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
- **Provenance on every card:** each number carries a `Real NASA` or `Simulated`
  chip (with a tooltip), plus the study or instrument when it applies. The board
  header lists the data sources and the footer repeats that NASA open data is
  labelled Real NASA and the POC layer is labelled Simulated.
- **Forecasts state their uncertainty:** straight-line fits on 7 draws, 95%
  prediction intervals, and an explicit "not a physiological model" note.
- **Help loop (closes the care loop):** a crew member asks for help, another
  crew member accepts, and the requester sees "Help on the way" plus the time
  until acceptance (two browser sessions, persisted request, 3 s poll). The
  free-text reason stays private to the CMO, the flight surgeon and the
  requester.

## Paper / pitch (Data & Methods)

The article submitted later uses [../methodology.md](../methodology.md):

- §7 is the reference table: OSD-569/575/656 (NASA OSDR), RadLab, DONKI, HRP,
  OCHMO-TB-044/004, NASA-STD-3001, CSA, NTRS 20140003748 / Moore et al. 2014,
  SPRINT, Law et al. 2014.
- §8 is a paper-ready **Data & Methods** text in English that matches the code
  (projection formulas, rule tiers, privacy, limitations).
- [../evolution-v1-v2.md](../evolution-v1-v2.md) documents the jump from the
  v1 baseline article (edge-first, SQLite, DTN, HUD) to the current version:
  what was kept, what changed and why, what was deferred, the v1 reference
  mapping ([1]–[10]) and an English "Evolution from v1" paragraph.
- [../glossary.md](../glossary.md) expands every acronym (CMO, OCHMO, OSDR, SEP,
  DTN, HUD…) for the team and for reviewers.
- What is **not** in the product and must stay out of the paper's claims:
  VO₂/Sprint integration, exercise-phase awareness, offline/two-screen demo,
  help request→accept cycle, pgvector/Redis.

## Environment

- Frontend: React 19 + Vite + Tailwind + Recharts.
- API: Python 3.12 + FastAPI.
- Database: PostgreSQL 16 with pgvector; Neon in production.
- Hosting: one Vercel project (static SPA + Python function).
