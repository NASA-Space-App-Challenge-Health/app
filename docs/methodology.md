# Metodologia, dados e regras — T.H.A.I.S. / Astronaut Health Monitor

Documento de referência para o time (base para o **Ricardo** estender o
dispositivo/offline) e **base do artigo do pitch** para a NASA. Descreve o que
roda hoje em produção, de onde vêm os dados, o que foi manipulado, como as
projeções e os alertas são calculados, e o que **não** está integrado.

> Escopo: 4 civis da Inspiration4 (missão de 3 dias), 7 coletas pré/pós-voo, uma
> semana de dosimetria da ISS (jun/2024), 119 eventos SEP de 2024. Não é
> prontuário de missão longa, não é dispositivo médico, não é diagnóstico.

## 1. O que está em produção

```
CSV NASA (repo) ──seed idempotente──▶ PostgreSQL/Neon ──SQL──▶ FastAPI ──JSON──▶ React
                                           ▲
                          12 tabelas, migrações 001–004, pgvector habilitado
```

- **Banco**: Postgres 16 (Neon em produção, URL *pooled*; Docker local).
- **API**: FastAPI; as rotas `/eda/*` e `/predict/*` leem o Postgres, não os CSVs.
- **Front**: React consome `same-origin` (`/api/dashboard`, `/api/insights`,
  `/eda/*`, `/predict/*`, `/recommendations`, `/api/demo`).
- **Produção**: `LOAD_ON_STARTUP=false` (não recarrega CSV em cold start);
  seed único rodado por `python -m app load`.
- **Sem alteração manual no banco de produção**: as linhas vêm do seed/loader
  idempotente; uploads, notas e imagens são dados de usuário (demo).

### Tabelas e o que alimenta cada coisa

| Tabela | Conteúdo | Alimenta |
| --- | --- | --- |
| `lab_results` | 13.249 linhas de CBC/CMP/citocinas | `/eda/labs/*`, `/predict/labs*`, cards de lab |
| `radiation_readings` | 12.873 leituras DosTel (jun/2024) | `/eda/radiation/series`, `/predict/radiation` |
| `space_weather_events` | 119 eventos SEP (2024) | pareamento do alerta de radiação |
| `reference_ranges` | 51 faixas (39 analitos, variações por sexo/visita) | conferência de faixas |
| `dataset_catalog` | 16 fontes com URL oficial | rastreabilidade |
| `health_readings` | vitais simulados + uploads | dashboard, `/predict/vitals`, regra de FC/sono/cortisol |
| `crew_members` / `crew_groups` | C001–C004 de-identificados; grupo `crew` | papéis, privacidade, higiene |
| `indicator_shares` | compartilhamento opt-in | visibilidade do crewmate |
| `clinical_notes` / `imaging_queue` | notas privadas; fila de imagem | flight surgeon (demo) |
| `dataset_loads` | controle de idempotência do loader | seed sem duplicar |
| `schema_migrations` | migrações aplicadas | evolução do schema |

## 2. Dados usados

### 2.1 Reais (NASA) — carregados no banco

| Dataset / arquivo | Fonte oficial | Volume | Escopo |
| --- | --- | --- | --- |
| `labs_long.csv` | OSDR **OSD-569** (CBC), **OSD-575** (CMP + citocinas séricas), **OSD-656** (citocinas urinárias) | **13.249** linhas, **524** analitos | 4 civis, 7 timepoints: L-92, L-44, L-3, R+1, R+45, R+82, R+194 |
| `radiation_iss.csv` | NASA **RadLab** (OSDR visualization) | **12.873** leituras | ISS, 01–07/06/2024; DosTel1 (6.511) + DosTel2 (6.362), ~2 min |
| `donki_sep.csv` | NASA **DONKI** (CCMC) | **119** eventos | Eventos SEP de 2024 (janelas de 60 dias, de-duplicadas) |
| `reference_ranges.csv` | derivado das tabelas OSDR acima | **51** faixas | 39 analitos; variação por sexo/visita |
| `datasets.csv` | página oficial dos datasets da Inspiration4 | **16** fontes | manifesto de origem/licença |

- **OSD-687** (marcas de histonas em T-cells) entrou só como metadata: só havia
  FASTQ restrito/bruto.
- **OS-568** é experimento **de camundongo** (olho/IOP pós-voo); ficou separado,
  fora de `labs_long.csv`, rotulado como análogo animal.
- Nenhuma fonte SOMA/Cornell, JAXA, CSA ou GitHub foi usada nos CSVs.

### 2.2 Simulados (declarados na UI)

Séries que **não existem** nas tabelas públicas: frequência cardíaca, SpO₂,
CO₂ de cabine, temperatura corporal, sono, cortisol, hidratação e horário de
higiene. No app, `origin='simulated'` e `source='simulated'`.

- No dashboard, essas séries vêm de um **seed fixo** por tripulante (ex.: C001
  FC 70→74, sono 7,4→7,5 h; C002 sono 5,1→5,4 h e cortisol 21→19 µg/dL, o que
  aciona a regra preventiva de sono/cortisol).
- Existe também um **simulador em Python** (`xemu_sensors.py`): FC 65–100 bpm
  (15% de chance de pico 120–160), SpO₂ 93–100%, CO₂ 0,2–0,8% — exposto em
  `POST /api/suit-sensors`. **A UI atual não chama esse endpoint**; ele é a
  base para a integração de dispositivo/telemetria que o Ricardo vai assumir.
- O limite de CO₂ usa o padrão NASA, **não** a nota do gerador: média de 1 hora
  ≤ **3 mmHg** (NASA-STD-3001 Vol 2 Rev D [V2 6004], citado no OCHMO-TB-004).
  3 mmHg ≈ 0,39% a 760 mmHg.

### 2.3 Verificados, porém **não integrados** ao produto

`data/reference/nasa_saude_tripulacao.json` (Joaquim) contém números conferidos
contra fontes e **não é carregado pela API** (o loader só lê os 5 CSVs). Ele é
referência para o artigo e para a futura tela de VO₂/exercício:

| Indicador | Valor | Fonte | Nota de verificação |
| --- | --- | --- | --- |
| VO₂ de pico pré-voo | **40,6 ± 6,4 mL/kg/min** (n=14) | NTRS 20140003748; Moore et al. 2014 | 9H/5M |
| VO₂ de pico no **FD15** | **−17%** vs pré-voo (IC95% **−22% a −13%**) | idem | estimativa de modelo misto para sujeito médio; **7 dos 14** recuperaram o VO₂ de pico em algum momento |
| Densidade do colo do fêmur | 0,860 → 0,846 / 0,862 → 0,845 g/cm² | SPRINT (English et al. 2020) | −1,7% conjunto pós-voo |
| Massa magra das pernas | 18,77 → 18,64 / 18,37 → 18,28 kg | SPRINT | sem efeito significativo no grupo controle |
| CO₂ de cabine | média 1 h ≤ **3 mmHg** | OCHMO-TB-004 / NASA-STD-3001 | requisito, não média de 24 h |
| Dores de cabeça e CO₂ | **19 de 49** astronautas (≈38,7%) | OCHMO-TB-004 (Law et al. 2014) | associação observacional, não causa individual |

O próprio JSON registra a verificação: **11 de 12 registros conferem** com as
fontes; único ajuste de precisão foi 0,86 → 0,860 g/cm².

## 3. Manipulações feitas nas bases

Tudo abaixo está documentado em [`data/README.md`](../data/README.md) e no
loader (`nasa_loader.py`). Onde houve escolha, **não se inventou valor**.

### 3.1 Limpeza e normalização (pré-repositório)

1. **Apenas hosts oficiais NASA** (osdr.nasa.gov, visualization.osdr.nasa.gov,
   ccmc.gsfc.nasa.gov, nasa.gov).
2. **Formato longo**: uma linha por (tripulante, timepoint, painel, analito,
   estudo). `days_from_launch` foi derivado do rótulo do timepoint.
3. **`flag` calculado na própria linha**: `low`/`normal`/`high` usando
   `ref_low`–`ref_high` inclusivos; `eGFR` tem caso especial (<60 = low, ≥60 =
   normal, sem limite superior).
4. **Sem imputação**: valores ausentes ficam em branco (22 linhas de CMP,
   principalmente BUN/creatinina; alguns CBC por visita; citocinas urinárias
   22/28 amostras).
5. **Normalização de nomes**: 3 linhas de hemograma vinham como
   `HEMOGLOBIN (FEMALE)` etc.; o nome foi normalizado e a faixa de referência
   da linha foi preservada.
6. **Faixas variam por sexo/visita**: `reference_ranges.csv` guarda todas as
   combinações distintas — nunca se assume uma faixa única por analito.
7. **Citocinas não têm faixa clínica** neste recorte; por isso não geram
   `flag` e não entram em contagem de fora de faixa.
8. **Duplicatas removidas** na extração do DONKI (janelas de 60 dias), com
   registro de que 119 linhas podem incluir relatos de instrumentos diferentes
   do mesmo evento solar.
9. **Radiação**: `dose_equivalent_rate` estava vazia na extração e ficou vazia;
   TEPC não retornou linhas para os nomes testados.
10. **Sem dados de voo em andamento**: a Inspiration4 durou 3 dias e as tabelas
    OSDR são pré/pós-voo — não existe coleta em voo.

### 3.2 Ingestão idempotente no Postgres

- `dataset_loads(filename, row_count)` evita recarregar arquivo já aplicado.
- `ON CONFLICT` protege duplicatas: labs por `(crew, timepoint, panel, analyte,
  source_study)`, radiação por `(recorded_at, instrument_id)`, SEP por
  `sep_id`, faixas por `(analyte, unit, panel, ref_low, ref_high)`, catálogo
  por `dataset_id`.
- Migrações `001`–`004` são *forward* e aplicadas no startup, registradas em
  `schema_migrations`. **Nunca se edita migração aplicada.**
- Seed da tripulação/vitais simulados é idempotente e **substitui** registros
  demo antigos por C001–C004.

### 3.3 Especificidade de produção (Neon/Vercel)

- URL **pooled** (`-pooler`): `sslmode=require` é adicionado quando ausente;
  `channel_binding` é removido (o pooler rejeita).
- `options=-c statement_timeout=...` **não** é enviado ao pooler; timeout é
  aplicado com `set_config` na transação. `DATABASE_STATEMENT_TIMEOUT_MS=0`
  desliga o timeout em produção; fora do pooler o default é 8 s.
- `LOAD_ON_STARTUP=false` na Vercel → sem carga de CSV em cold start; o seed é
  feito uma vez pelo comando `python -m app load`.
- A extensão `vector` é tentada no startup; se o papel do banco não puder
  criá-la, o app **segue sem pgvector** (log de warning). Hoje não há tabela
  vetorial.

## 4. Projeções — métodos e fórmulas

Implementação em `backend/services/api/app/predict.py` e `predict_queries.py`.
Tudo é explícito e conservador: **não há novo limite clínico**; as faixas vêm
da própria linha NASA.

### 4.1 Labs (séries com ≥ 3 coletas numéricas)

Seja `d` = dias desde o lançamento, `n` = número de coletas, `x̄`, `Sxx`, `s²`
do ajuste.

```
reta (OLS):        ŷ(d) = b0 + b1·d
robusta:           Theil–Sen = mediana das inclinações (y_j−y_i)/(x_j−x_i)
baseline:          média das coletas pré-voo (d < 0)
próximo passo:     d_next = último d + mediana dos intervalos entre coletas
PI95:              ŷ ± t(0,975; n−2) · √(s² · (1 + 1/n + (d−x̄)²/Sxx))
p_fora:            Φ((low−ŷ)/se) + (1 − Φ((high−ŷ)/se))   [aprox. normal]
z vs faixa:        (valor − (low+high)/2) / ((high−low)/4)
piora:             par consecutivo já fora da faixa e mais longe dela
flags:             already_out_and_worsening | trending_toward_out_of_range
horizontes:        day_30, day_90, day_180 (marcados como dentro/fora do
                   intervalo observado) + next_step (única extrapolação)
```

- **Cuidado com outliers**: MPV e RDW do C003 explodem a reta (ex.: MPV
  L-92 = 330 fora da escala). O código expõe `robust` (Theil–Sen) e o texto do
  produto diz para não levar essas duas séries a briefing.
- **Exemplos reais** (C003): potássio 3,3 (L-3) → 3,0 (R+1), faixa 3,5–5,3;
  OLS +0,001409 mmol/L/dia; Theil–Sen +0,000893; next_step dia 236,5,
  ŷ 3,92, PI95 2,26–5,59, p_fora 0,27. C003 glicose: 75 (L-3), 103 (R+1),
  36 (R+45), 73 (R+194) — a recuperação tardia mostra por que uma reta única
  descreve mal essa série.
- **Ranking de risco** (`/predict/labs/risks`): C004 monócitos absolutos
  988 células/µL em R+194 → next 1004, p_fora 0,72.

### 4.2 Radiação (série de uma semana DosTel)

```
média horária por instrumento (pool entre DosTel1/2 quando mesmo horário)
SES:      L_t = α·y_t + (1−α)·L_{t−1}, α = 0,3
σ:        desvio dos resíduos (y − L) das últimas 48 h
PI95:     L ± 1,96·σ, na horizontal (24 h à frente, sem tendência)
spikes:   amostras horárias ≥ 400 µGy/h (regra, não limiar físico novo)
dose de área acumulada: D(dias) = média_horária · 24 · dias
```

- Números reais: pico **528,47 µGy/h** em **2024-06-05T01:20:03Z** (DosTel1);
  próximo SEP em **2024-06-08T02:25Z** (GOES-P, SEISS >100 MeV), **73,1 h**
  depois; média da semana **15,24 µGy/h**; 20 amostras ≥ 400 µGy/h; dose de
  área em 30/90/180 dias = **10.973 / 32.920 / 65.839 µGy** (≈11,0/32,9/65,8 mGy).
- Aviso obrigatório: é **dose de área do veículo**, não dose pessoal; o SES
  fica perto do nível recente e **não prevê** o próximo spike.

### 4.3 Vitais simulados

- Anomalia = último ponto a **≥ 2 DP** da própria série simulada (não é limiar
  NASA).
- Recomendação de sono/cortisol só se o valor cruz também o corte do
  `rules.yaml` (média de sono < 6 h e cortisol > 18 µg/dL nas últimas 3
  amostras) — regra ilustrativa, não limite de voo.

## 5. Indicações, alertas e privacidade

### 5.1 Regras vigentes (`rules/rules.yaml`)

| Regra | Gatilho | Tier | Broadcast | Fontes |
| --- | --- | --- | --- | --- |
| `radiation_with_sep` | pico DosTel ≥ **400 µGy/h** **e** SEP DONKI em até **96 h** depois | emergency | **sim** | HRP hazards, OCHMO-TB-044, RadLab, DONKI |
| `heart_rate` | FC fora de **40–130 bpm** (última leitura) | emergency | **sim** | HRP risks, OCHMO-TB-044 |
| `impact` | `impact_event` ≥ 1 (não há fonte/entrada no protótipo) | emergency | **sim** | HRP risks, OCHMO-TB-044 |
| `critical_glucose` | glicose de lab **< 54 mg/dL** | cmo | não | OSD-575, HRP hazards |
| `worsening_lab` | já fora da faixa e próxima coleta mais longe dela (CBC/CMP) | cmo | não | OSD-569/575, HRP, OCHMO-TB-044 |
| `sleep_and_cortisol` | média de sono **< 6 h** e cortisol **> 18 µg/dL** (janela 3) | flight_surgeon | não | HRP risks/hazards, OCHMO-TB-044 |

- **Texto público nunca contém diagnóstico**; no caso de FC/impacto, nem o
  número: "Crewmate needs assistance…".
- **Cutoffs são configuração do app**, não limites publicados da NASA — isso
  está escrito no próprio YAML e na UI.
- Limite de CO₂ é a exceção normativa real: 3 mmHg (média de 1 h), NASA-STD-3001
  [V2 6004] via OCHMO-TB-004.

### 5.2 Como os alertas são montados

`briefing.assemble()` consulta o Postgres, roda as regras e projeta cada achado
por papel. **Alertas não são persistidos** — são calculados a cada request
(consequência: o ciclo de ajuda do T.H.A.I.S. precisará de tabela/estado
próprios).

### 5.3 Matriz de visibilidade (`access.py`, base OCHMO-TB-044)

| Papel | Emergência (broadcast) | Clinical `tier=self/cmo` | Privado (sono/cortisol) | Regra |
| --- | --- | --- | --- | --- |
| **self** | vê o próprio achado completo | vê os próprios | vê os próprios | sujeito pode ver o próprio dado |
| **cmo** | vê completo | vê | não | CMO = Oficial Médico da Tripulação |
| **flight_surgeon** | vê completo | vê | **vê** | médico de solo |
| **crewmate** | só aviso genérico | só se o dono optou (`indicator_shares`) | não | privacidade OCHMO |
| **commander** | aviso genérico | não | não | só "condição pode impactar a missão" |

> Verificado em produção: `viewer=C003&role=self` retorna o card de potássio do
> próprio C003; `role=crewmate` retorna 0 cards; emergência chega a todos como
> texto genérico.

## 6. Limitações (para o artigo)

1. **n = 4** civis, missão de **3 dias**, **7 coletas** pré/pós-voo — sem coleta
   em voo; nada disso é padrão de missão longa.
2. Intervalos de predição são **largos por construção** (t com n−2; no máximo
   7 pontos). Não é risco clínico calibrado.
3. Radiação = **uma semana** de um instrumento de **veículo**, não dosimetria
   pessoal; 119 SEPs podem incluir múltiplos relatos do mesmo evento.
4. Regras de FC/sono/cortisol são **configuração de app**, não limites NASA;
   FC é simulada.
5. A regra de FC atual **não considera fase de exercício, histórico ou
   qualidade de sinal** — se o pitch falar disso, é proposta, não implementação.
6. VO₂/SPRINT/CO₂ do JSON de referência **não estão integrados** à API/UI.
7. Alertas **não são persistidos**; não há aceite/escalonamento (o ciclo de
   ajuda é o próximo passo).
8. Sem autenticação: papéis de demo não são login.

## 7. Referências

| Uso no projeto | Fonte |
| --- | --- |
| CBC Inspiration4 | NASA OSDR **OSD-569** — <https://osdr.nasa.gov/bio/repo/data/studies/OSD-569/> |
| CMP + citocinas séricas | NASA OSDR **OSD-575** — <https://osdr.nasa.gov/bio/repo/data/studies/OSD-575> |
| Citocinas urinárias | NASA OSDR **OSD-656** — <https://osdr.nasa.gov/bio/repo/data/studies/OSD-656> |
| Lista oficial dos datasets I4 | <https://www.nasa.gov/osdr-latest-news-i4-mission-datasets/> |
| Dosimetria ISS | NASA **RadLab** — <https://visualization.osdr.nasa.gov/radlab/gui/data-api/> |
| Eventos solares | NASA **DONKI** — <https://ccmc.gsfc.nasa.gov/DONKI/> (exemplo: <https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/31338/-1>) |
| Riscos/hazards do voo | NASA HRP — <https://www.nasa.gov/hrp/hazards/> e <https://www.nasa.gov/hrp/risks/> |
| Operações médicas / privacidade | **OCHMO-TB-044** — <https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf> |
| CO₂ / NASA-STD-3001 | **OCHMO-TB-004** — <https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/> |
| Efeitos no corpo | **CSA** infográfico — <https://www.asc-csa.gc.ca/eng/multimedia/search/image/8056> |
| VO₂ de pico em voo | **NTRS 20140003748** — <https://ntrs.nasa.gov/citations/20140003748>; Moore et al., *J Appl Physiol* 117:231–238, 2014, DOI 10.1152/japplphysiol.01251.2013 |
| SPRINT (osso/músculo) | English et al., *npj Microgravity* 6:21, 2020, DOI 10.1038/s41526-020-00111-x (PMC7434884) |
| Dores de cabeça e CO₂ | Law et al., *J Occup Environ Med*, 2014 (citado no OCHMO-TB-004) |
| Métodos estatísticos | OLS e t de Student (texto padrão); Theil–Sen (Theil 1950; Sen 1968); suavização exponencial simples |

## 8. Bloco em inglês para o artigo (Data & Methods)

> Cole no artigo e ajuste o estilo da revista. Números conferem com o código.

**Data.** We use three real NASA open datasets and one simulated layer. (1)
Inspiration4 de-identified clinical labs from the NASA Open Science Data
Repository: 13,249 long-format rows (CBC from OSD-569; CMP and serum cytokines
from OSD-575; urine cytokines from OSD-656) for four civilian crew members at
seven timepoints from L-92 to R+194 days around a three-day mission. Each row
keeps the reference range printed on the NASA row; flags are computed
inclusively from that range, and missing values are left blank (no imputation).
(2) One week of ISS absorbed dose rate from the NASA RadLab DosTel instruments
(June 1–7, 2024; 12,873 readings at about two-minute cadence; DosTel1 and
DosTel2). (3) 119 solar energetic particle (SEP) events for calendar 2024 from
NASA DONKI. (4) Simulated heart rate, SpO₂, cabin CO₂, body temperature, sleep,
cortisol, hydration and hygiene timing, always labelled as simulated in the
interface.

**Methods.** The API stores the real tables in PostgreSQL 16 and serves them
through FastAPI. Lab projections are explicit and conservative: for each crew
member and CBC/CMP analyte with at least three numeric draws, we fit an
ordinary least-squares line on days from launch and report a robust Theil–Sen
slope beside it, the change from the pre-flight mean, a 95% prediction interval
using the Student-t multiplier for n−2 degrees of freedom, and an approximate
normal probability of falling outside the reference range on the row. Day 30,
90 and 180 are points on the fitted line, marked as inside or outside the
observed span; the only extrapolation is one median gap past the last draw.
Radiation uses hourly means, simple exponential smoothing (α = 0.3) held flat
for 24 hours with a residual-scatter interval, spikes at or above 400 µGy/h,
and a cumulative area dose computed as the week's mean rate × 24 × horizon
(days). Alerts are rule-based (YAML) and tiered: only emergency rules may
broadcast to the whole crew, and public text never names a diagnosis.
OCHMO-TB-044 privacy semantics decide what each role sees (self, Crew Medical
Officer, flight surgeon, crewmate, commander); a crewmate sees a shared
indicator only when its owner opts in. Cabin CO₂ is compared with the
NASA-STD-3001 requirement of a one-hour average ≤ 3 mmHg, as cited in
OCHMO-TB-004.

**Limitations.** n = 4 civilians, three-day flight, pre/post-flight labs only,
one vehicle radiation week, wide prediction intervals, no personal dosimetry,
and no in-flight samples. The risk cutoffs in the rules file are app settings,
not published flight-surgeon limits. A separate verified reference set (VO₂peak
−17% at flight day 15, n = 14, 95% CI −22% to −13%, NTRS 20140003748 / Moore et
al. 2014; SPRINT bone and muscle outcomes; CO₂ headache counts) is cited as
motivation and is **not** shown as a product measurement.

## 9. Nota ao Ricardo — como estender sem quebrar a metodologia

- **Novas leituras** entram por `POST /api/readings` (`source='manual'`, o
  servidor decide a banda) ou pelo adaptador de dispositivo que aceite payload e
  grave em `health_readings` com `origin` explícito (`real`/`simulated`).
  **Nunca** escrever banda calculada no cliente.
- **Novas tabelas** = migração *forward* `005_*.sql`; não editar 001–004.
- **Novas regras** = `rules.yaml` + teste em `tests/` (o CI roda unittest).
- **Projeções** continuam em `predict.py` (funções puras) e consultas em
  `predict_queries.py`; não recalcular no front.
- **Privacidade**: toda exposição passa por `project_finding`/`access.py`;
  não criar atalho que devolva item clínico sem projeção por papel.
- **Dispositivo/LAN**: para demo offline em duas telas, o mínimo é o Vite
  escutar em `0.0.0.0` (o proxy fala com a API em loopback) + firewall; o
  banco continua Postgres local. Não trocar para SQLite: quebraria migrações,
  loader e testes.
- **Simulador**: `xemu_sensors.py` é a fonte da telemetria simulada; se a UI
  passar a chamar `/api/suit-sensors`, o board precisa de polling/refresh
  (hoje ele carrega uma vez).
- **Ciclo de ajuda**: como alertas não são persistidos, o pedido/aceite exige
  tabela própria (ex.: `help_requests`) + endpoints + testes; o critério de
  aceite do P0 é: A pede → B vê em ≤3 s → B aceita → A vê "Ajuda a caminho".
