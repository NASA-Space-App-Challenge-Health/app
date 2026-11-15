# Evolução v1 → v2 — o que mudou no T.H.A.I.S.

Documento para o time e para o **artigo do pitch**: mostra a base científica da
**v1**, o que foi mantido, o que mudou, o que foi adiado e por quê na **v2**
(versão que está em produção hoje).

> **Documento de embasamento da v1**: "T.H.A.I.S. (Tech & Health Astronaut
> Intelligent System): Arquitetura de Software Edge-First para Monitoramento
> Autônomo e Preditivo da Saúde de Astronautas", 4 páginas, fornecido pelo time
> (nome do arquivo associa o material a Thais Russomano / NASA Team). Guardar
> como referência de projeto, não como publicação revisada por pares; a versão
> do arquivo está em `docs/` quando anexada ao repositório final.

## 1. Resumo em 5 linhas (para o slide)

1. A v1 prometia **autonomia total a bordo**: FastAPI + regras + SQLite local +
   DTN store-carry-forward + HUD tático em React.
2. A v2 manteve a espinha (FastAPI + React + telemetria simulada + suporte à
   decisão) e **trocou o foco**: dados **reais** da NASA, projeções
   estatísticas transparentes, **privacidade OCHMO** e deploy verificável.
3. O que era promessa de arquitetura (DTN, override por ICS, economia de
   energia, ML) ficou **explicitamente fora do escopo da demo**.
4. O que a v2 ganhou que a v1 não tinha: 13.249 exames reais, radiação
   DosTel/DONKI reais, alertas com fonte, papéis por papel clínico, previsões
   com incerteza, app publicado.
5. O ciclo de ajuda (pedido → aceite → "ajuda a caminho") é o **próximo
   incremento** e, quando pronto, será a ponte entre a narrativa da v1 e a v2.

## 2. Base da v1 (o que o artigo propunha)

| Pilar v1 | Descrição no artigo |
| --- | --- |
| **Edge-First / offline** | "100% autônoma localmente"; backend Python/FastAPI processa os sensores e compara com o histórico baseline em **SQLite local**; alertas "Normal/Atenção/Crítico" |
| **Sensores xEMU** | Consome **WHRM** (Wired Heart Rate Monitor: 30–200 bpm, hardline) e **PLSS** (O₂, CO₂, vapor de água, pressão interna); MVP com **mock em Python** |
| **DTN / energia** | Store-carry-forward (RFC 4838): acumula localmente e sincroniza em lote quando há link; leitura crítica aciona **override de emergência** via **ICS (Network-in-a-Box)** exigindo ação manual |
| **HUD** | React + Tailwind, baixa carga cognitiva: semáforos verde/amarelo/vermelho, barras e "Assistente de Decisão" com ações práticas |
| **Tempo real** | Frontend atualiza telemetria **a cada 3 s** via REST |
| **Riscos citados** | ~30 riscos NASA; HRP → EIMO (Earth-Independent Medical Operations); descondicionamento cardiovascular (rigidez carotídea ≈ 10–20 anos em 6 meses); perda óssea 1–2%/mês; saúde mental/cognitiva |
| **Trabalho futuro v1** | ML para análise preditiva mais precisa; validação com missões análogas |

## 3. Snapshot da v2 (o que está em produção hoje)

- **Problema**: ajudar a tripulação a entender uma mudança de saúde, decidir o
  próximo passo e saber quem vê/atende — com dados reais e rótulos honestos.
- **Dados reais**: Inspiration4 (OSD-569/575/656), DosTel (RadLab, 1 semana),
  119 SEPs (DONKI); **simulados**: FC, SpO₂, CO₂, temperatura, sono, cortisol,
  hidratação, higiene.
- **Backend**: FastAPI 0.162 + Postgres 16 (Neon em produção, Docker local),
  SQL puro, migrações forward, loader idempotente, 44 testes.
- **Projeções**: OLS + Theil–Sen, intervalos de predição t de Student (95%),
  probabilidade de sair da faixa, piora entre coletas; radiação com SES α=0,3,
  spikes ≥ 400 µGy/h e dose de área acumulada.
- **Alertas**: regras em YAML, tiers `self/cmo/flight_surgeon/emergency`; só
  emergência faz **broadcast** e o texto público nunca leva diagnóstico;
  limite de CO₂ usa NASA-STD-3001 (3 mmHg, média de 1 h).
- **Privacidade**: matriz OCHMO-TB-044 (self, CMO, flight surgeon, crewmate,
  commander), compartilhamento opt-in por indicador.
- **Frontend**: React 19 + Vite + Tailwind + Recharts; dashboard, páginas por
  sistema, insights com filtros, demo guiada, perfis; mobile com drawer.
- **Deploy/CI**: Vercel (site + função Python) + Neon; GitHub Actions com
  backend, frontend e staging; screenshots e kit de submissão.
- **Ainda não**: pedido→aceite→"ajuda a caminho", ingest de dispositivo real,
  contexto de exercício, offline em duas telas, integração VO₂/Sprint, ML.

## 4. O que foi mantido (continuidade)

- **FastAPI + React + Tailwind** como stack (mesma espinha da v1).
- **Telemetria simulada de traje** como origem dos sinais que a NASA não
  publica (o gerador xEMU continua no código, com endpoint).
- **Suporte à decisão**: traduzir número em ação prática e em "quem é
  notificado".
- **Baixa carga cognitiva**: frases curtas, cartões, detalhe atrás de
  "Learn more", cor nunca como único sinal.
- **Capacidade local**: a stack inteira roda offline via Docker (o app não
  chama serviço externo em runtime; dados são CSV locais).
- **Ideia de emergência que acorda o time**: agora como broadcast genérico
  para a tripulação + notificação privada ao CMO/flight surgeon.

## 5. O que mudou — e por quê

| Dimensão | v1 | v2 | Por que mudou |
| --- | --- | --- | --- |
| **Dados clínicos** | Só telemetria simulada | 13.249 exames reais + radiação/SEP reais + camada simulada rotulada | Credibilidade científica e rastreabilidade; o desafio pede indicadores reais |
| **Banco** | SQLite local | PostgreSQL 16 (Docker local, Neon em prod) | Multi-tela/servidor, migrações versionadas, testes, pooling serverless, caminho futuro para pgvector; **offline continua possível** rodando o Compose local |
| **Motor** | Regras preditivas sobre baseline | Regras YAML + **projeções estatísticas explícitas** | Auditabilidade: OLS/Theil–Sen/IC95% mostram incerteza; nada de caixa-preta |
| **Escopo preditivo** | "Predição" genérica | Labs, radiação e vitais simulados, com fórmulas documentadas | O artigo precisa do método, não só do resultado |
| **Alertas** | Normal/Atenção/Crítico | Tiers OCHMO + broadcast só em emergência + fontes | Privacidade de dados médicos e segurança do texto público |
| **Privacidade** | Não abordada | Matriz por papel (self/CMO/flight surgeon/crewmate/commander) | Requisito OCHMO-TB-044; evita alarme coletivo com dado privado |
| **Sensores** | WHRM 30–200 bpm, PLSS O₂/CO₂/vapor/pressão, mock em tempo real | Gerador xEMU (FC, SpO₂, CO₂%) + endpoint; UI ainda com séries semeadas | Tempo curto de hackathon; integração real ficou como incremento (ingest) |
| **Offline/edge** | Pilar central: 100% local | Local funciona (Docker/Compose); produção é nuvem | Demo precisava ser acessível por link; "offline em duas telas" ficou como teste pendente |
| **DTN / energia** | Store-carry-forward + override ICS | **Não implementado** | Exige rede/ground station, fora do que dá para demonstrar; mantido como visão de missão longa |
| **Interface** | HUD tático, semáforos, barras | Dashboard + insights + demo guiada + papéis | Desktop/juiz e leitura de dados reais; HUD segue como referência de design |
| **Atualização** | Polling de 3 s | Carregamento por view (sem polling) | Simplicidade; polling volta no ciclo de ajuda (aceite precisa refletir em ≤3 s) |
| **ML** | Trabalho futuro | Estatística transparente, sem ML | Com 7 coletas, ML não é defensável; o artigo pode citar como evolução |
| **Operação** | Não descrita | Vercel + Neon + CI + testes + kit de submissão | Precisa estar no ar e citável no pitch |

## 6. O que foi adiado (com status)

| Promessa v1 | Status na v2 | Caminho mínimo |
| --- | --- | --- |
| DTN store-carry-forward e sincronização em lote | ❌ fora do escopo | Documentar como visão; demo com rede local |
| Override de emergência via ICS / Network-in-a-Box | ❌ | Entra no roadmap do ciclo de ajuda/telemetria |
| Economia de energia por prioridade de alerta | ❌ | Só relevante com hardware real |
| ML preditivo | ❌ | Substituir por estatística explícita; citar como trabalho futuro |
| HUD tático com barras | ⚠️ parcial | UI atual mantém cartões/cores; HUD pode virar modo "EVA" |
| WHRM 30–200 bpm / hardline | ⚠️ simulado | Ingest de dispositivo (payload real no endpoint) |
| PLSS com vapor de água e pressão | ⚠️ parcial | Só SpO₂/CO₂% hoje; adicionar sensores no seed/endpoint |
| Polling 3 s | ❌ | Volta junto com o aceite do pedido de ajuda |
| Pedido de ajuda → aceite → "ajuda a caminho" | ❌ (era implícito na v1) | **P0 atual**: tabela + endpoints + UI + polling |

## 7. Como isso aparece no pitch/artigo

Frase segura para a banca:

> "A primeira iteração do T.H.A.I.S. propôs uma arquitetura edge-first com
> banco local e DTN para autonomia em espaço profundo. Na versão atual,
> mantivemos a espinha FastAPI + React + telemetria simulada e priorizamos o que
> dá para provar: dados reais da NASA, projeções com incerteza explícita,
> privacidade por papel OCHMO e um app publicado. DTN, ML e ingest de hardware
> real ficam como roadmap, não como resultado."

O que **não** dizer: que o app atual roda 100% offline por DTN, que tem ML, que
lê o traje real, ou que o alarme de FC entende exercício — nada disso está no
código hoje.

## 8. Bloco em inglês para o artigo (Evolution from v1)

> The first version of T.H.A.I.S. (Tech & Health Astronaut Intelligent System)
> proposed an edge-first architecture: a local SQLite database, a Python/FastAPI
> predictive rule engine over simulated xEMU telemetry (WHRM and PLSS), a
> delay-tolerant networking layer (RFC 4838) with store-carry-forward and an
> ICS emergency override, and a low-cognitive-load HUD in React. The current
> version keeps the FastAPI + React spine, the simulated-suit telemetry and the
> decision-support goal, but shifts the contribution to what can be validated:
> (i) real NASA data (Inspiration4 labs, ISS DosTel radiation, DONKI SEPs) with
> a labelled simulated layer; (ii) explicit statistical projections with
> prediction intervals and no black-box model; (iii) OCHMO-based privacy roles
> and emergency-only broadcasts with source citations; and (iv) a deployed,
> tested application. Delay-tolerant networking, hardware ingestion and machine
> learning are presented as roadmap items rather than claims about the current
> prototype. The baseline document's motivation (long-duration risk, Earth-
> independent medical operations, cardiovascular/bone/mental-health concerns)
> is retained as the clinical rationale.

## 9. Referências da v1 e status de uso na v2

A v1 lista 10 referências, sem URLs/DOIs no documento. Para o artigo do pitch,
elas precisam ser completadas e verificadas antes de citação formal.

| # v1 | Referência (como está no documento) | Uso na v2 |
| --- | --- | --- |
| [1] | Shelar et al. Multisystem physiological changes and accelerated aging in long-duration spaceflight (2026) | Motivação; não citada no produto |
| [2] | NASA Human System Risk Roadmap (HRP) | Substituída por HRP hazards/risks com URL |
| [3] | NASA Earth-Independent Medical Operations (EIMO) Concept of Operations | Base conceitual; v2 expressa via privacidade/papéis |
| [4] | Nature Reviews Cardiology — cardiovascular deconditioning in spaceflight | Motivação; números não re-verificados no repo |
| [5] | ScienceDirect — bone loss and renal stone risk during spaceflight (2025) | Substituída por SPRINT/OSDR verificados |
| [6] | ICES — WHRM for xEMU (2022) | Conceito de hardware; simulador atual não segue a spec |
| [7] | NASA ICES — M-PALSS for PLSS integration (2025) | Conceito de PLSS; v2 só simula O₂/CO₂% |
| [8] | IETF RFC 4838 — DTN Architecture | **Não implementado** na v2 |
| [9] | IEEE — DTN for biomedical telemetry (ECG) in Artemis | **Não implementado**; roadmap |
| [10] | IEEE — Autonomous AI-based health monitoring for deep space (2025) | **Não implementado**; v2 usa estatística explícita |

Referências **novas da v2** (com URL/DOI): ver
[methodology.md](methodology.md#7-referências), incluindo OSDR
OSD-569/575/656, RadLab, DONKI, HRP, OCHMO-TB-044/004, NASA-STD-3001, CSA,
NTRS 20140003748 / Moore et al. 2014, SPRINT (English et al. 2020) e
Law et al. 2014.

## 10. Próximos passos para fechar a ponte v1 ↔ v2

1. **P0** — pedido de ajuda → aceite → "ajuda a caminho" (duas sessões, polling
   ≤3 s, tabela `help_requests`).
2. **P1** — ingest de dispositivo: aceitar payload externo no endpoint de
   telemetria + script bridge.
3. **P1** — offline em duas telas: Vite em `0.0.0.0`, firewall, stack local.
4. **P2** — contexto de exercício para a regra de FC (evitar alarme no treino).
5. **P2** — integrar o JSON de VO₂/Sprint/CO₂ como card de referência.
6. **P3** — DTN/override e ML apenas como roadmap no artigo.
