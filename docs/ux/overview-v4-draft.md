# Overview v4 — idealização (astronauta/CMO em estação)

Status: rascunho de design, nada implementado. Objetivo: transformar o hero em **command center**, subir o body map para o avatar e trazer Help/Recomendações para o primeiro scroll.

---

## 1. Problema atual (v3.2)

- **Help** e **Recommendations** ficam abaixo de Systems/Labs/Body map: o astronauta precisa rolar para achar o botão mais importante.
- **Body map** está no fim da página, como card separado; a relação com o avatar do hero não é óbvia.
- Hero tem **muito espaço vazio à direita**; o avatar é decorativo, não interativo.
- Em station display, o primeiro scroll deveria bastar: status, próximo passo, ajuda e acesso ao corpo.

## 2. Princípio

> O hero deve concentrar **quem é**, **como está**, **o que fazer agora** e **onde dói**. Tudo o mais é detalhe.

## 3. Proposta A (recomendada) — hero command center

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────┐   C003 · Crew C003            [ NOMINAL ]                 │
│  │  astronauta  │   Inspiration4 · viewing as Self                         │
│  │  interativo  │   Last lab R+194 · POC 22:18 UTC                         │
│  │  hotspots:   │                                                            │
│  │  cabeça,     │   [ Request help ]  [ Radiation replay ]  [ Insights ]    │
│  │  olhos,      │                                                            │
│  │  peito,      │   NEXT ACTION · "One early eosinophil count…"  [ Open ]   │
│  │  braços,     │                                                            │
│  │  pernas,     │                                                            │
│  │  aura        │                                                            │
│  └──────────────┘                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  ALERTA ativo (se houver) — texto + [ Open the replay ]                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  SYSTEMS — 4 cards com barras (inalterado)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  LABS — resumo “7/7 in range” + link                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Avatar = body map**: hotspots sobre a figura (cabeça, olhos, peito, braços/pernas, aura). Cada hotspot tem ponto de status (verde/âmbar/vermelho) + `aria-label`; tap abre painel de detalhe ao lado.
- **Help** vira botão primário do hero; abre um **drawer** (ou modal) com formulário e pedidos abertos. Não ocupa mais um card no fluxo.
- **Next action**: a recomendação mais relevante do papel vira uma faixa de uma linha no hero, com CTA. “All recommendations” leva ao Insights.
- **Body map card** deixa de existir no fluxo; o detalhe da região aparece no drawer/painel (ou navega para a categoria).
- **Recommendations card** deixa de existir no fluxo; o restante fica no Insights.

## 4. Proposta B — astronauta de corpo inteiro

- Silhueta de corpo inteiro (240–280 px) no hero, com hotspots claros:
  - cabeça → head
  - olhos → eyes
  - peito → heart
  - braços/pernas → muscles
  - esqueleto → bones
  - veias/gotas → blood
  - halo/aura → environment
- Detalhe abre em painel lateral fixo (ou drawer) com função, o que o dado mostra, prevenção e fontes.
- Mais “uau” e mais fácil de acertar com luva; custo maior de arte/implementação.

## 5. Proposta C — mínimo esforço

- Mantém avatar atual (busto) **sem hotspots**.
- Sobe **Help** para o hero (botão) e **Next action** para o hero.
- Move o card **Body map** para logo abaixo do hero, antes de Systems.
- Sem drawer: Help continua inline, só que mais acima.
- ~30 min; resolve o principal (acesso), mas não a relação avatar ↔ corpo.

## 6. Interação e acessibilidade

- Hotspots são **botões reais** (HTML sobre o SVG), ≥44×44 px, `aria-label` com região + status textual (“Head: nominal”).
- Status nunca só por cor: ponto + texto no painel/`sr-only`.
- Teclado: Tab percorre os hotspots; Enter abre o painel; Esc fecha.
- Painel de detalhe: `role="dialog"`/drawer com foco preso; no desktop pode ser painel lateral sem modal.
- CMO: mesma interação; o painel mostra detalhe clínico e fontes; o astronauta vê linguagem simples.
- Para a estação: alvos grandes, sem hover obrigatório, contraste AA, nada de tooltip como única fonte.

## 7. Impacto no orçamento de 20 itens

- Hero: status (1) + 2 contextos + 2–3 ações (não contam como variável clínica) + **next action** (1).
- Body map: no máximo **2 chips watch** + hotspots; o detalhe é sob demanda.
- Systems/labs resumidos permanecem.
- Recommendations: 1 no hero (next action) + link; não 2 cards no fluxo.
- Fica **≤20** e o primeiro scroll resolve o essencial.

## 8. Esforço

| Opção | Escopo | Esforço |
|---|---|---|
| C | Hero com Help + Next action; body map logo abaixo | ~30 min |
| A | Avatar busto com hotspots + drawer Help + next action; remove body map/recommendations do fluxo | ~2–3 h |
| B | Silhueta corpo inteiro + hotspots + painel lateral + drawer | ~4–6 h |

## 9. Recomendação

**A agora**, com o avatar atual como base e hotspots em posições relativas (cabeça, olhos, peito, braços, pernas, aura). Se aprovar o “uau”, evoluímos para **B** (corpo inteiro) sem refazer o fluxo.

## 10. Decisões

1. **A**, **B** ou **C**?
2. Tap no corpo deve **abrir detalhe ali** (drawer/painel) ou **navegar para a categoria**?
3. Help: drawer/modal no hero, ou manter painel inline porém acima dos sistemas?
4. Recomendações: **1 next action no hero** + link, ou 2 cards como hoje?
5. Avatar: busto atual com hotspots ou silhueta de corpo inteiro?
