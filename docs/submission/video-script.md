# Demo video script — 2 minutes

Target: **1:55–2:00**, 1080p, browser at 100% zoom, incognito window, no
personal tabs. The product is in English; record narration in English (a
Portuguese version follows).

## Pre-flight (before recording)

1. Open <https://nasa-health-app.vercel.app> in a clean incognito window.
2. Set crew to **C001** and role to **Self** in the header.
3. Have a second tab on `/insights` and a third on `/demo`.
4. Hide the bookmarks bar (Ctrl+Shift+B) and the OS dock.
5. Close the guided demo on the board until you reach step 2 of the script.

## Shot list

| Time | Screen | Action | Narration |
| --- | --- | --- | --- |
| 0:00–0:12 | Board (`/dashboard`) | Slow scroll from the header to the vitals grid | "Three days in orbit. Four civilians. NASA released their blood work — we turned it into a crew health board." |
| 0:12–0:28 | Board, emergency card | Click **Full detail, evidence and sources** | "This alert is not invented. The vehicle's peak absorbed dose rate is 528 microgray per hour on June 5, 2024. The next solar particle event came 73 hours later, from DONKI." |
| 0:28–0:45 | Board, chips + vitals | Point at the **Real NASA** and **Simulated** chips | "Every number is labelled. Labs, radiation and solar events are real NASA open data. Heart rate, sleep, cortisol and hydration are simulated — and say so." |
| 0:45–1:02 | Guided demo (`/demo`) | Click through steps 2 and 3 | "The OCHMO privacy model is built in. An emergency reaches the whole crew as a generic notice. A preventive finding — C003 potassium low before the next draw — stays with the CMO and flight surgeon." |
| 1:02–1:20 | **Two windows: help loop** | A (C003, self) clicks **Request help**, chooses Node 2 + reason, sends. B (C001, CMO) shows the request, clicks **I'm responding**. A flips to **Help on the way: C001** | "This is the differentiator: closing the care loop. The astronaut asks for help, the CMO sees the request and accepts, and the board shows who is on the way — with the time it took to accept." |
| 1:20–1:35 | Data insights (`/insights`) | Toggle crew to C003, switch **View → Labs**, hover the glucose chart | "The insights page answers one question at a time. Filters are shareable. Glucose and urea nitrogen are the most flagged tests: 44 of 1,062 rows outside the printed reference range." |
| 1:35–1:45 | Insights, Labs → risk list | Scroll to **Predicted next-draw risk** | "Forecasts show their uncertainty: a straight line on seven draws, a 95% interval, and an explicit note that this is not a physiological model." |
| 1:45–1:57 | Board header + footer | Show the role selector, then the footer disclaimer | "React, FastAPI, PostgreSQL on Neon, deployed on Vercel. It is a demonstration for Space Apps 2026 — not a medical device, and not a diagnosis." |
| 1:57–2:00 | Logo / title card | End card with the URL | "Try it: nasa-health-app.vercel.app." |

## End card

```
T.H.A.I.S. — Astronaut Health Monitor
Tech & Health Astronaut Intelligent System
NASA Space Apps Challenge 2026
nasa-health-app.vercel.app
github.com/NASA-Space-App-Challenge-Health/app
```

## Portuguese narration (if you prefer PT)

| Time | Fala |
| --- | --- |
| 0:00 | "Três dias em órbita, quatro civis. A NASA liberou os exames deles — e nós transformamos isso num painel de saúde da tripulação." |
| 0:12 | "Este alerta não é inventado: o pico de dose do veículo foi 528 microgray por hora em 5 de junho de 2024, e o próximo evento solar veio 73 horas depois — dados do DONKI." |
| 0:28 | "Cada número é rotulado. Exames, radiação e eventos solares são dados abertos reais da NASA. Frequência cardíaca, sono, cortisol e hidratação são simulados — e o produto diz isso." |
| 0:45 | "O modelo de privacidade da OCHMO está embutido: emergência chega para toda a tripulação como aviso genérico; um achado preventivo fica com o CMO e o médico de voo." |
| 1:02 | "Aqui está o diferencial: fechar o ciclo de atendimento. C003 pede ajuda no Node 2; o CMO vê o pedido e aceita; o painel do astronauta mostra 'Ajuda a caminho: C001' com o tempo até o aceite." |
| 1:20 | "A página de insights responde uma pergunta por vez, com filtros compartilháveis. Glicose e ureia são os exames mais sinalizados: 44 de 1.062 linhas fora da faixa de referência." |
| 1:35 | "As previsões mostram a incerteza: uma reta sobre sete coletas, intervalo de 95%, e o aviso explícito de que não é um modelo fisiológico." |
| 1:45 | "React, FastAPI, PostgreSQL no Neon, deploy na Vercel. É uma demonstração para o Space Apps 2026 — não é dispositivo médico nem diagnóstico." |
| 1:57 | "Teste em nasa-health-app.vercel.app." |

## Checklist

- [ ] Audio recorded without room echo (headphones mic or quiet room).
- [ ] Cursor visible but not twitchy; click once per action.
- [ ] No terminal, no personal data, no real crew information on screen.
- [ ] Help loop rehearsed with two windows: A (C003, self) and B (C001, CMO); confirm **Help on the way: C001** appears within 3 s before recording.
- [ ] Fallback if the help loop fails on the day: record 0:00–1:02, the insights segment, and the close without the two-window shot.
- [ ] Captions/subtitles in the uploaded video.
- [ ] File name: `astronaut-health-monitor-spaceapps-2026.mp4`.
