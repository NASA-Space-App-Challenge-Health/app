# Overview v3 — draft para discussão

Status: rascunho, nada implementado. Objetivo: simplificar o Overview com **cards agregados por sistema** e **barras de faixa** (alta/baixa), sem inventar score nem misturar dado real com simulado.

---

## 1. O que a referência faz bem

- Perfil do astronauta em coluna fixa (identidade, missão, status).
- **General overview** com anel, status, alertas e última avaliação.
- **Action directive** com CTA.
- **4 cards por sistema** (Brain & Balance, Cardiovascular, Radiation & Temperature, Muscles/Nerves/Bones), cada um com 3–5 linhas `label → valor → barra`.
- Tudo cabe em ~1,2 telas; a leitura é "estou bem?" antes de "abrir detalhe".

## 2. O que temos hoje no Overview

- Hero com avatar, status, chips e ações rápidas.
- Alerta de emergência.
- Tripulação, 8 cards de vitais (valor + chip NOMINAL/SIMULATED, **sem barra**).
- Tabela de labs (valor, faixa, flag, estudo — **sem barra**).
- Body map, higiene, recomendações. Página longa (~3.900 px desktop).

## 3. Lacunas que o usuário apontou

1. **Sem noção de alta/baixa**: temperatura aparece "36,5 °C / NOMINAL", mas não se vê onde está dentro da faixa.
2. **Sem agregação por sistema**: para saber "coração ok?" é preciso rolar ou entrar na categoria.
3. **Ruído de chips**: cada card repete `SIMULATED`; o valor não é o protagonista.
4. **Nenhum resumo honesto** de quantos sinais estão na faixa.

## 4. Proposta — wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│ HERO  avatar · C003 Crew C003 · NOMINAL · atenção: 1 aviso                  │
│       [Request help] [Radiation replay] [Data insights]                     │
│       JUMP TO: Alerts · Systems · Vitals · Help · Labs · Body map           │
├────────────────────────────────────────────────────────────────────────────┤
│ ALERTA (se existir)  Radiation contingency — [Open the replay]              │
├────────────────────────────────────────────────────────────────────────────┤
│ AT A GLANCE — 4 cards de sistema                                            │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────┐ │
│ │ Brain & balance  │ │ Blood & heart    │ │ Radiation & temp │ │ Muscles  │ │
│ │ Sleep   7.0 h ▓▓ │ │ HR      73  ▓▓▓  │ │ Temp  36.5 ▓▓▓   │ │ Sem      │ │
│ │ Cortisol 13  ▓▓  │ │ SpO2    98  ▓▓▓  │ │ Peak  528.5 ▓▓▓▓ │ │ medição  │ │
│ │ Sem EEG no dado  │ │ K       3.8  ▓▓   │ │ 30d   10973 µGy  │ │ real; só │ │
│ │ 1 sinal POC      │ │ 4/4 labs in range│ │ 1 emergency      │ │ guidance │ │
│ │ → categoria      │ │ → categoria      │ │ → categoria      │ │ → cat.   │ │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────┘ │
├────────────────────────────────────────────────────────────────────────────┤
│ REAL NASA LABS — 4 marcadores com barra (ou tabela atual + barras)          │
│ POTASSIUM 3.8 ──▓──── 3.5–5.3  In range  OSD-575 R+194                      │
│ GLUCOSE   73  ──▓──── 65–99    In range  OSD-575 R+194                      │
│ HEMOGLOBIN 13.3 ─▓─── 11.7–15.5 In range OSD-569 R+194                      │
│ PLATELETS 185 ──▓──── 140–400  In range  OSD-569 R+194                      │
├────────────────────────────────────────────────────────────────────────────┤
│ VITALS (grid atual, agora com barra + banda nominal/watch)                   │
│  HR 73 [50─100 nominal, watch 40–130]  SIMULATED  NOMINAL                   │
│  SpO2 98 [95–100]                      SIMULATED  NOMINAL                   │
│  Temp 36.5 [36.1–37.5; watch 35.0–38.3] SIMULATED NOMINAL                   │
│  Sleep 7.0 h [7–9 ilustrativo]           SIMULATED NOMINAL                   │
│  Hydration 2.5 L [2–3 ilustrativo]        SIMULATED NOMINAL                  │
│  Cortisol 13 µg/dL [sem faixa NASA]       SIMULATED NOMINAL                  │
├────────────────────────────────────────────────────────────────────────────┤
│ HELP · CREW · BODY MAP · HYGIENE · RECOMMENDATIONS                          │
└────────────────────────────────────────────────────────────────────────────┘
```

## 5. Anatomia do card de sistema (proposta)

```
┌───────────────────────────────────────────────┐
│ Blood & heart                   4/4 in range │  ← contagem, não score
│ ┌───────────────────────────────────────────┐ │
│ │ Heart rate        73 bpm   ▓▓▓▓░░  NOMINAL│ │  ← barra de faixa
│ │ Oxygen saturation 98 %     ▓▓▓▓▓  NOMINAL │ │
│ │ Potassium         3.8 mmol ▓▓░░░  IN RANGE│ │  ← lab real: barra 3.5–5.3
│ │ Glucose           73 mg/dL ▓▓░░░  IN RANGE│ │
│ └───────────────────────────────────────────┘ │
│ [Real NASA · OSD-575] [Simulated]   → open    │
└───────────────────────────────────────────────┘
```

- Máximo **4 linhas** por card; se não houver dado, empty state honesto.
- Cada linha: `label · valor · unidade · barra · status`.
- Origem por linha: `Real NASA` ou `Simulated`; o card pode ter as duas e mostra as duas chips no rodapé.
- CTA do card: leva para a página da categoria (detalhe, gráficos, evidência).

## 6. Mapeamento de dados reais disponíveis

| Sistema | Linha | Fonte | Valor exemplo (C003) | Faixa |
|---|---|---|---|---|
| Blood & heart | Heart rate | Simulada (POC) | 73 bpm | nominal 50–100 (ilustrativa) |
| Blood & heart | SpO₂ | Simulada (POC) | 98 % | nominal 95–100 |
| Blood & heart | Potassium | Real OSD-575 | 3,8 mmol/L | 3,5–5,3 (linha NASA) |
| Blood & heart | Glucose | Real OSD-575 | 73 mg/dL | 65–99 (linha NASA) |
| Brain & balance | Sleep | Simulada (POC) | 7,0 h | 7–9 ilustrativa |
| Brain & balance | Cortisol | Simulada (POC) | 13,0 µg/dL | **sem faixa NASA** → sem barra |
| Radiation & temp | Body temp | Simulada (POC) | 36,5 °C | nominal 36,1–37,5; watch 35,0–38,3 |
| Radiation & temp | Radiation peak | Real RadLab | 528,5 µGy/h | regra 400 µGy/h (amostra bruta) |
| Radiation & temp | 30-day area dose | Real RadLab | 10.973,2 µGy | derivação do arquivo |
| Muscles & bones | — | — | sem medição real | guidance CSA/HRP/OCHMO |

## 7. Regras de honestidade

- **Nada de "Health Quality 98%"**: a referência usa um score composto que não temos. Usamos **contagens**: "4/4 labs in range", "1 emergency", "2 POC signals".
- Faixas:
  - Labs reais: `ref_low/ref_high` impressos nas linhas NASA.
  - Vitais simulados: **banda ilustrativa POC** (`nominal_low/high`, `watch_low/high`) já existente em `guidance.py`; precisa ser **exposta pela API** (hoje o payload só traz `risk_band`).
  - Rotular a barra: "ilustrative POC band, not a NASA limit".
- **Sem ECG, PA, densidade óssea, flight day ou "Online"** — não existem nos dados.
- **Sem misturar** real e simulado na mesma média/score.

## 8. Mudança necessária no backend

`guidance.py` já define `physical`, `nominal_low/high` e `watch_low/high` por indicador, mas `to_public()` só devolve `key/label/group/unit/decimals/explanation`. Para as barras:

```json
"bands": {
  "physical": [20, 250],
  "nominal": [50, 100],
  "watch": [40, 130],
  "label": "illustrative POC band, not a NASA limit"
}
```

Adicionar em `reading` (dashboard e category) e um teste no backend. Labs já têm `ref_low/ref_high`.

## 9. Fases e esforço

- **P0 — barras onde já existe dado (2–3 h):** expor `bands` no backend + componente `MetricBar` + usar em `VitalsGrid` e na tabela de labs. Resolve "não sei se está alta/baixa".
- **P1 — 4 cards de sistema no Overview (2 h):** agregados, com 3–4 linhas, contagem e CTA; referência visual.
- **P2 — limpeza (1 h):** decidir se os cards de sistema **substituem** os 8 cards de vitais no Overview (recomendo) e se a tabela de labs fica ou vira resumo com 4 marcadores.

## 10. Decisões que preciso de você

1. **Cards de sistema substituem os 8 vitais no Overview** ou ficam como uma faixa adicional acima deles? (Recomendo substituir no Overview e manter o grid completo em Blood & heart.)
2. **Labs no Overview**: tabela atual com barras ou bloco de 4 marcadores (como na página Status)?
3. **Quais 4 sistemas** e quais linhas em cada um? (Minha sugestão está na seção 6.)
4. **Barra em todo lugar** (Overview + categoria + Status) ou só no Overview/categoria?
5. **Meta de altura**: Overview em até ~2 telas no desktop (hoje ~3.900 px) é aceitável?

## 11. Não copiar da referência

- Health Quality 98%, ECG "sinus rhythm", PA 118/76, densidade óssea 100%, flight day 14/30.
- "Send to HUD"/"Online" (implica telemetria ao vivo que não temos).
- Barras de percentual sem unidade real (Balance 99%, Concentration 95%).

Esses itens são bonitos no mock, mas criam afirmações clínicas ou operacionais que o dado não sustenta.
