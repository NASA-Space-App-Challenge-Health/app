# Glossário de siglas e nomenclatura

Um lugar único para as siglas do projeto, do app, do pitch e do artigo.
Na interface as siglas ficam curtas (por exemplo **CMO**), mas toda primeira
menção em documento deve expandir. Se algo faltar, acrescente aqui em vez de
inventar.

## 1. NASA, missão e operações

| Sigla / termo | Significado | Onde aparece / como usamos |
| --- | --- | --- |
| **NASA** | National Aeronautics and Space Administration | Agência dos dados e do desafio |
| **Space Apps** | NASA International Space Apps Challenge | Hackathon de 2026; problema "Create Health Monitoring Software for Astronauts on Space Missions" |
| **ISS** | International Space Station (Estação Espacial Internacional) | Origem da semana de dosimetria DosTel |
| **LEO** | Low Earth Orbit (órbita baixa) | Contexto de radiação e evacuação médica |
| **EVA** | Extravehicular Activity (atividade extraveicular) | Check de 15 min pré/pós-EVA citado do OCHMO-TB-044 |
| **CMO** | Crew Medical Officer (Oficial Médico da Tripulação) | Papel no seletor do app; `C001` e `C002` são os CMOs do demo |
| **Flight surgeon** | Médico de voo (solo, no controle da missão) | Papel no app; vê itens clínicos e privados (sono/cortisol) |
| **Commander** | Comandante da missão | Papel no app; recebe só "condição pode impactar a missão", nunca diagnóstico |
| **Crewmate** | Colega de tripulação (não médico) | Papel no app; só vê números que o dono libera (`indicator_shares`) + aviso genérico |
| **HRP** | Human Research Program (NASA) | Fonte dos "5 hazards" e dos riscos de voo |
| **OCHMO** | Office of the Chief Health and Medical Officer (NASA) | Fonte das regras de operações médicas e CO₂ |
| **OSDR** | Open Science Data Repository (NASA) | Repositório dos estudos OSD-569/575/656 |
| **OSD-xxx** | Identificador de estudo do OSDR (ex.: OSD-569, OSD-575, OSD-656, OSD-687) | `source_study` nas linhas de laboratório |
| **DONKI** | Database Of Notifications, Knowledge, Information (NASA CCMC) | Fonte dos 119 eventos SEP de 2024 |
| **CCMC** | Community Coordinated Modeling Center (NASA) | Operador do DONKI |
| **SEP** | Solar Energetic Particle event (evento de partículas solares energéticas) | Alerta de radiação pareia pico DosTel + próximo SEP |
| **RadLab** | Radiation Data Lab (API de dosimetria do OSDR/NASA) | Fonte de `radiation_iss.csv` |
| **DosTel** | Dosimeter/Telescope — instrumento de dosimetria da ISS | `DosTel1` e `DosTel2` em `radiation_iss.csv` |
| **TEPC** | Tissue Equivalent Proportional Counter | Instrumento tentado no RadLab, sem dados no recorte |
| **NASA-STD-3001 [V2 6004]** | Padrão NASA de fatores humanos; item de CO₂ da cabine | Limite de 3 mmHg (média de 1 hora) |
| **OCHMO-TB-044** | Technical Brief de operações médicas do OCHMO | Papéis, privacidade (PMC/PPC), check EVA, higiene |
| **OCHMO-TB-004** | Technical Brief de CO₂ do OCHMO | Limite de CO₂ e estudo de dores de cabeça |
| **PMC / PPC** | Private Medical Conference / Private Psychological Conference | Conferência médica/psicológica privada (OCHMO-TB-044) |
| **CSA** | Canadian Space Agency (Agência Espacial Canadense) | Infográfico sobre efeitos do voo no corpo |
| **NTRS** | NASA Technical Reports Server | Resumo do estudo de VO₂ (NTRS 20140003748) |
| **Inspiration4** | Missão civil de 3 dias (16–18/09/2021) | Coorte de 4 civis dos exames reais |
| **FD15** | Flight Day 15 (15º dia de voo) | Momento do achado de −17% no VO₂ de pico |
| **L-92 / R+1 etc.** | Dias relativos ao lançamento (**L** = launch minus; **R** = recovery plus) | Timepoints: L-92, L-44, L-3, R+1, R+45, R+82, R+194 |
| **Módulo** | Módulo pressurizado da estação/habitat (ex.: Node 2, Columbus) | Conceito do chamado de ajuda do T.H.A.I.S. |
| **xEMU** | Exploration Extravehicular Mobility Unit (traje de exploração) | Nome do simulador de sensores (`xemu`) |
| **PLSS** | Portable Life Support System (sistema de suporte à vida do traje) | Sensor de CO₂ simulado |
| **WHRM** | Monitor cardíaco usado no simulador de traje | Gera a FC simulada |
| **SpO₂** | Peripheral oxygen saturation (saturação periférica de oxigênio) | Vital simulado (%) |

## 2. Clínico e laboratorial

| Sigla / termo | Significado | Onde aparece |
| --- | --- | --- |
| **CBC** | Complete Blood Count (hemograma completo) | `panel` = CBC; OSD-569 |
| **CMP** | Comprehensive Metabolic Panel (painel metabólico) | `panel` = CMP; OSD-575 |
| **BUN** | Blood Urea Nitrogen (ureia no sangue) | Analito mais sinalizado do arquivo |
| **eGFR** | estimated Glomerular Filtration Rate (filtração glomerular estimada) | Caso especial de faixa (só limite inferior 60) |
| **MPV** | Mean Platelet Volume (volume médio de plaquetas) | Série com outlier; não usar em briefing |
| **RDW** | Red cell Distribution Width (amplitude de distribuição dos eritrócitos) | Série com outlier; não usar em briefing |
| **IL-6** | Interleucina-6 | Citocina em OSD-575/656 |
| **CRP** | C-reactive protein (proteína C-reativa) | Citocina/inflamação |
| **VO₂peak** | Peak oxygen uptake (consumo de pico de oxigênio, mL/kg/min) | Estudo de referência (n=14, −17% no FD15) |
| **DXA** | Dual-energy X-ray Absorptiometry (densitometria óssea) | Estudo SPRINT (densidade do colo do fêmur, massa magra) |
| **ppCO₂** | Partial pressure of carbon dioxide (pressão parcial de CO₂) | Limite OCHMO/NASA-STD de 3 mmHg |
| **Faixa de referência** | `ref_low`–`ref_high` impressos na própria linha NASA | Comparação `flag`: `low`, `normal`, `high` |

## 3. Estatística e projeções

| Sigla / termo | Significado | Uso no projeto |
| --- | --- | --- |
| **OLS** | Ordinary Least Squares (mínimos quadrados ordinários) | Reta principal das projeções de labs |
| **Theil–Sen** | Estimador robusto de inclinação (mediana das inclinações entre pares) | Comparação robusta por outlier |
| **SES** | Simple Exponential Smoothing (suavização exponencial simples) | Projeção de radiação, α = 0,3 |
| **PI95** | Prediction Interval de 95% (intervalo de predição) | Faixa larga por n pequeno |
| **IC95 / 95% CI** | Intervalo de confiança de 95% | Ex.: VO₂ −17% (IC95% −22% a −13%) |
| **DP / SD** | Desvio padrão | Séries simuladas e estudos |
| **EP / SE** | Erro padrão | Intervalos de predição |
| **z-score** | (valor − centro) / (meia-faixa/2); aqui a faixa é tratada como ~4 DP | Ordenação, não score clínico |
| **p_fora** | Probabilidade aproximada de cair fora da faixa sob a normal | `p_out_of_range` nas projeções |
| **CI (contexto)** | Continuous Integration (integração contínua) | GitHub Actions; não confundir com intervalo de confiança |

## 4. Engenharia de software

| Sigla / termo | Significado | Onde |
| --- | --- | --- |
| **API** | Application Programming Interface | FastAPI (`/api`, `/eda`, `/predict`, `/recommendations`) |
| **REST** | Representational State Transfer | Estilo dos endpoints JSON |
| **JSON / CSV** | Formatos de dados | Payloads e tabelas NASA |
| **SPA** | Single Page Application | React com `react-router` |
| **PWA** | Progressive Web App (service worker/offline) | **Não implementado** |
| **CI/CD** | Continuous Integration / Continuous Delivery | GitHub Actions + deploy Vercel |
| **SSR / CSR** | Server-Side Rendering / Client-Side Rendering | Aqui só CSR (Vite) |
| **ORM** | Object-Relational Mapping | **Não usamos**; SQL puro com psycopg |
| **Neon** | Postgres serverless (produção) | Banco de produção, URL pooled |
| **Vercel** | Plataforma de deploy (site + função Python) | Produção |
| **Docker / Compose** | Containers e orquestração local | `backend/docker/compose.yaml` |
| **pgvector** | Extensão de vetores do Postgres | Habilitada, **sem uso vetorial ainda** |
| **Redis** | Store em memória | Serviço `queue` no Compose, **sem uso no request path** |
| **Vite** | Bundler/dev server do front | `frontend/` |
| **Tailwind** | Framework CSS utilitário | Design system |
| **Recharts** | Biblioteca de gráficos React | Gráficos do app |

## 5. Nomenclatura do app (contratos de dados)

| Termo | Valores / significado |
| --- | --- |
| `viewer` | De quem é a visão (`C001`–`C004`) |
| `role` | `self`, `cmo`, `flight_surgeon`, `crewmate`, `commander` |
| `tier` | Nível de privacidade do achado: `self`, `cmo`, `flight_surgeon`, `emergency` |
| `broadcast` | Aviso à tripulação inteira. **Só** `tier=emergency` pode ser `true`; texto genérico, sem diagnóstico |
| `origin` | `real` (NASA) ou `simulated` (gerado) |
| `source` | `simulated`, `manual` (upload/entrada) — o servidor decide a banda de risco |
| `share_mode` | `full` ou `alerts_only` (o que o tripulante compartilha com colegas) |
| `indicator_shares` | Compartilhamento opt-in de um indicador específico |
| `data_source` | `simulated`, `mixed` — resumo do board |
| `group.kind` | `crew` hoje; `family` previsto para cuidado domiciliar |
| **T.H.A.I.S.** | Nome do produto/projeto. A expansão da sigla ainda **não está definida**; até o artigo, use "T.H.A.I.S. — Astronaut Health Monitor" e não invente expansão |
| **Astronaut Health Monitor** | Nome do produto no app, README e kit de submissão |

## 6. Como citar / escrever

- Primeira menção em texto: **CMO (Crew Medical Officer)**; depois só "CMO".
- Preferir o nome humano do exame com o código técnico entre parênteses:
  "açúcar no sangue (glicose)", "células brancas (white blood cells)".
- Nunca chamar achado de diagnóstico: usar "achado", "sinal", "recomendação",
  "aviso".
- Dados reais sempre com o estudo de origem (`OSD-569`, `OSD-575`, `OSD-656`)
  e dados simulados sempre com o rótulo **simulated**.
