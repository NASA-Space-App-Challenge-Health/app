// Shared formatting helpers for the dashboard panels. Every helper accepts
// null/undefined: the API hides fields for the privacy demo and some readings
// (for example cabin CO2) can come back without a value.

const INTEGER_KEYS = new Set([
  'absorbed_dose_rate',
  'mean_rate_ugy_h',
  'area_dose_ugy',
  'hours_after_peak',
  'samples',
])

const KEY_LABELS = {
  absorbed_dose_rate: 'Absorbed dose rate',
  recorded_at: 'Recorded at',
  instrument_id: 'Instrument',
  sep_id: 'SEP event',
  sep_time: 'SEP time',
  sep_instruments: 'SEP instruments',
  sep_link: 'SEP record',
  hours_after_peak: 'Hours after peak',
  mean_rate_ugy_h: 'Mean rate',
  area_dose_ugy: 'Area dose',
  days: 'Days',
  label: 'Label',
  crew_id: 'Crew',
  value: 'Value',
  unit: 'Unit',
}

export function safeArray(value) {
  return Array.isArray(value) ? value : []
}

export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  const places = Math.max(0, Math.min(4, Number(decimals) || 0))
  return number.toFixed(places)
}

// Measurements keep the precision in the source row but drop trailing zeros:
// 84 stays 84, 14.1 stays 14.1, 1.29 stays 1.29.
export function formatMeasurement(value) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  return String(Math.round(number * 100) / 100)
}

// Reference ranges read better without forced decimals: 65–99, 0.6–1.35.
export function formatRange(low, high, unit = '') {
  const suffix = unit ? ` ${unit}` : ''
  const hasLow = low !== null && low !== undefined && Number.isFinite(Number(low))
  const hasHigh = high !== null && high !== undefined && Number.isFinite(Number(high))
  if (hasLow && hasHigh) {
    return `${roundForDisplay(low)}–${roundForDisplay(high)}${suffix}`
  }
  if (hasLow) return `≥ ${roundForDisplay(low)}${suffix}`
  if (hasHigh) return `≤ ${roundForDisplay(high)}${suffix}`
  return '—'
}

function roundForDisplay(value) {
  return String(Math.round(Number(value) * 100) / 100)
}

function pad(value) {
  return String(value).padStart(2, '0')
}

// ISO timestamps from the API are UTC; show one compact, unambiguous form.
export function formatTimestamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())} UTC`
}

export function formatDay(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function humanizeKey(key) {
  if (!key) return ''
  if (KEY_LABELS[key]) return KEY_LABELS[key]
  const text = String(key).replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function bandKind(band) {
  if (band === 'concern' || band === 'critical') return 'concern'
  if (band === 'watch') return 'watch'
  if (band === 'nominal') return 'nominal'
  return 'neutral'
}

export function flagKind(flag) {
  if (!flag) return 'neutral'
  const value = String(flag).toLowerCase()
  if (value === 'normal') return 'nominal'
  if (value === 'high' || value === 'low' || value === 'abnormal') return 'watch'
  return 'neutral'
}

export function flagLabel(flag) {
  if (!flag) return 'No flag'
  const value = String(flag).toLowerCase()
  if (value === 'normal') return 'In range'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function originKind(origin) {
  if (origin === 'real') return 'real'
  if (origin === 'simulated') return 'simulated'
  return 'neutral'
}

export function originLabel(origin) {
  if (origin === 'real') return 'Real NASA'
  if (origin === 'simulated') return 'Simulated'
  return 'Unknown source'
}

export function confidenceKind(confidence) {
  if (confidence === 'high') return 'real'
  if (confidence === 'medium') return 'nominal'
  if (confidence === 'low') return 'watch'
  return 'neutral'
}

export function formatPercent(probability) {
  if (probability === null || probability === undefined) return '—'
  const number = Number(probability)
  if (!Number.isFinite(number)) return '—'
  return `${Math.round(number * 100)}%`
}

export function evidenceRows(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return []
  return Object.entries(evidence)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
    .map(([key, value]) => ({ key, label: humanizeKey(key), value: formatEvidenceValue(key, value) }))
}

function formatEvidenceValue(key, value) {
  if (INTEGER_KEYS.has(key) && Number.isFinite(Number(value))) {
    return String(Math.round(Number(value) * 100) / 100)
  }
  return String(value)
}

// Reference ranges for a real NASA lab row are already printed in the data, so
// the same bar can show where the measured value sits without inventing bands.
export function bandsForLab(lab) {
  const low = Number(lab?.ref_low)
  const high = Number(lab?.ref_high)
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return null
  const pad = (high - low) * 0.25
  return {
    physical: [low - pad, high + pad],
    nominal: [low, high],
    watch: [low - pad, high + pad],
    label: 'NASA reference range printed on the lab row.',
  }
}
