// Shared vocabulary for the Data insights page: crew list, filter topics,
// chart colours, and small format helpers. Kept as plain data/functions so the
// page and its panels stay presentational.

export const CREW_IDS = ['C001', 'C002', 'C003', 'C004']

export const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'labs', label: 'Labs' },
  { id: 'radiation', label: 'Radiation' },
  { id: 'recommendations', label: 'Recommendations' },
]

// Topic taxonomy shown in the filter bar. CBC/CMP are derived from the panel
// field of /eda/labs/analytes; cytokines are the assays with no panel/range.
export const TOPICS = [
  { id: 'cbc', label: 'Blood cells', hint: 'CBC', panel: 'CBC' },
  { id: 'cmp', label: 'Metabolism', hint: 'CMP', panel: 'CMP' },
  { id: 'cyto', label: 'Cytokines', hint: 'no range' },
  { id: 'rad', label: 'Radiation' },
]

export const TOPIC_IDS = TOPICS.map((topic) => topic.id)
export const TOPIC_LABEL = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic.label]))
export const VIEW_LABEL = Object.fromEntries(VIEWS.map((view) => [view.id, view.label]))

export const CHART_COLORS = ['#00e5ff', '#7851a9', '#34d399', '#fbbf24', '#f87171', '#a78bfa']
export const CHART_GRID = 'rgba(255, 255, 255, 0.07)'
export const CHART_AXIS = { fill: '#94a3b8', fontSize: 11 }
export const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: '#171b2e',
    border: '1px solid #242a44',
    borderRadius: 12,
    color: '#e2e8f0',
    fontSize: 12,
  },
  labelStyle: { color: '#cbd5e1', fontSize: 11 },
  itemStyle: { color: '#e2e8f0', fontSize: 12 },
}
export const CHART_LEGEND = { fontSize: 11, color: '#94a3b8' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function analyteTopic(panel) {
  if (panel === 'CBC') return 'cbc'
  if (panel === 'CMP') return 'cmp'
  return 'cyto'
}

// A lab row belongs to a topic when its panel is in the selected topics. When
// the analyte map is missing (analytes call failed) keep the row if any lab
// topic is on, so the page still shows real data instead of going blank.
export function matchesLabTopic(analyte, panelByAnalyte, topics) {
  const panel = panelByAnalyte?.[analyte]
  if (!panel) return topics.has('cbc') || topics.has('cmp')
  return topics.has(analyteTopic(panel))
}

export function isOutOfRange(flag) {
  return flag === 'low' || flag === 'high'
}

export function formatCount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatValue(value, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

export function formatPercent(value, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${value.toFixed(digits)}%`
}

export function formatSignedPercent(value, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}

// ISO timestamp to a stable UTC label without depending on the browser zone.
export function formatUtc(iso) {
  if (typeof iso !== 'string') return '—'
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  return match ? `${match[1]} ${match[2]} UTC` : iso
}

export function formatDay(iso) {
  if (typeof iso !== 'string') return '—'
  const match = iso.match(/^\d{4}-\d{2}-(\d{2})$/)
  return match ? `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7)} ${Number(match[1])}` : iso
}

export function formatMonth(ym) {
  if (typeof ym !== 'string') return '—'
  const match = ym.match(/^\d{4}-(\d{2})/)
  return match ? MONTHS[Number(match[1]) - 1] ?? ym : ym
}

// Next-step out-of-range probability from a /predict/labs/risks row.
export function riskProbability(risk) {
  const forecasts = risk?.forecasts
  if (!Array.isArray(forecasts) || forecasts.length === 0) return null
  const next = forecasts.find((item) => item.label === 'next_step') ?? forecasts[0]
  return typeof next?.p_out_of_range === 'number' ? next.p_out_of_range : null
}

export function riskMeta(risk) {
  const next = Array.isArray(risk?.forecasts)
    ? risk.forecasts.find((item) => item.label === 'next_step') ?? risk.forecasts[0]
    : null
  return next ?? null
}

export function tierMeta(tier) {
  if (tier === 'emergency') return { kind: 'emergency', label: 'Emergency · broadcast' }
  if (tier === 'cmo') return { kind: 'watch', label: 'CMO + flight surgeon' }
  if (tier === 'commander') return { kind: 'watch', label: 'Commander only' }
  return { kind: 'neutral', label: 'Personal card' }
}

export function confidenceKind(confidence) {
  if (confidence === 'high') return 'nominal'
  if (confidence === 'medium') return 'watch'
  return 'neutral'
}

// Flatten the mixed `technical` object the API returns into label/value rows.
export function technicalRows(technical) {
  if (!technical || typeof technical !== 'object') return []
  const rows = []
  const push = (label, value) => {
    if (value === undefined || value === null || value === '') return
    rows.push([label, String(value)])
  }
  const unit = technical.unit ? ` ${technical.unit}` : ''
  if (technical.plain_name) push('Test', `${technical.plain_name} (${technical.analyte ?? 'analyte'})`)
  else if (technical.analyte) push('Test', technical.analyte)
  if (technical.value !== undefined) {
    const at = technical.timepoint ? ` at ${technical.timepoint}` : ''
    push('Latest value', `${formatValue(technical.value, 2)}${unit}${at}`)
  }
  const range = technical.reference_range
  if (range && (range.low !== undefined || range.high !== undefined)) {
    const low = range.low === null || range.low === undefined ? '—' : formatValue(range.low, 2)
    const high = range.high === null || range.high === undefined ? '—' : formatValue(range.high, 2)
    push('Printed range', `${low}–${high}${unit}`)
    if (range.note) push('Range note', range.note)
  }
  if (technical.flag) push('Lab flag', technical.flag)
  if (technical.next_step) {
    const next = technical.next_step
    if (typeof next.p_out_of_range === 'number') {
      push('Next-step out-of-range chance', formatPercent(next.p_out_of_range * 100, 0))
    }
    if (typeof next.yhat === 'number') {
      push('Straight-line next step', `${formatValue(next.yhat, 2)}${unit}`)
    }
    if (typeof next.pi95_low === 'number' && typeof next.pi95_high === 'number') {
      push('95% band', `${formatValue(next.pi95_low, 2)}–${formatValue(next.pi95_high, 2)}${unit}`)
    }
    if (next.assumption) push('Forecast caveat', next.assumption)
  }
  if (technical.trend) push('Trend', technical.trend)
  if (Array.isArray(technical.flags) && technical.flags.length > 0) {
    push('Model flags', technical.flags.join(', '))
  }
  if (typeof technical.n === 'number') push('Observed draws', technical.n)
  if (typeof technical.sleep_hours === 'number') push('Latest sleep', `${formatValue(technical.sleep_hours, 1)} h`)
  if (typeof technical.cortisol_ug_dl === 'number') {
    push('Latest cortisol', `${formatValue(technical.cortisol_ug_dl, 1)} µg/dL`)
  }
  if (technical.label) push('Label', technical.label)
  if (technical.origin) push('Origin', technical.origin)
  return rows
}

// Extreme lab rows, picked so the examples read plainly (lowest glucose,
// highest potassium, ...) instead of being dominated by one rounding artifact.
export const EXTREME_SPECS = [
  { analyte: 'GLUCOSE', pick: 'min', label: 'Lowest glucose' },
  { analyte: 'POTASSIUM', pick: 'max', label: 'Highest potassium' },
  { analyte: 'HEMOGLOBIN', pick: 'min', label: 'Lowest hemoglobin' },
  { analyte: 'PLATELET COUNT', pick: 'min', label: 'Lowest platelet count' },
  { analyte: 'AST', pick: 'max', label: 'Highest AST' },
]

export function pickExtremeRow(rows, analyte, pick, crew, topics, panelByAnalyte) {
  const candidates = rows.filter(
    (row) =>
      row.analyte === analyte &&
      crew.has(row.crew_id) &&
      matchesLabTopic(row.analyte, panelByAnalyte, topics),
  )
  if (candidates.length === 0) return null
  return candidates.reduce((best, row) =>
    pick === 'max' ? (row.value > best.value ? row : best) : row.value < best.value ? row : best,
  )
}
