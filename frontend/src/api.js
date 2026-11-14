// Thin client for the crew-health API.
//
// Every call is a same-origin relative path: Vite proxies /api, /eda, /predict
// and /recommendations to the local Compose service, and Vercel rewrites those
// prefixes to the FastAPI function. Nothing is hard-coded to a port here.

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

function query(params = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

async function getJSON(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = typeof body.detail === 'string' ? body.detail : ''
    } catch {
      // Non-JSON error body: keep the status only.
    }
    throw new Error(detail || `The API answered ${response.status}.`)
  }
  return response.json()
}

export const ROLES = [
  { id: 'self', label: 'Self' },
  { id: 'cmo', label: 'CMO' },
  { id: 'flight_surgeon', label: 'Flight surgeon' },
  { id: 'crewmate', label: 'Crewmate' },
  { id: 'commander', label: 'Commander' },
]

export const CREW = ['C001', 'C002', 'C003', 'C004']

export const api = {
  dashboard: ({ viewer, role } = {}) => getJSON(`/api/dashboard${query({ viewer, role })}`),
  demo: ({ viewer, role } = {}) => getJSON(`/api/demo${query({ viewer, role })}`),
  insights: ({ viewer } = {}) => getJSON(`/api/insights${query({ viewer })}`),
  crew: () => getJSON('/api/crew'),
  recommendations: ({ crew, role, viewer } = {}) => getJSON(`/recommendations${query({ crew, role, viewer })}`),

  edaOverview: () => getJSON('/eda/overview'),
  edaOutOfRange: (limit = 12) => getJSON(`/eda/labs/out_of_range${query({ limit })}`),
  edaAnalytes: () => getJSON('/eda/labs/analytes'),
  edaTrends: (analyte) => getJSON(`/eda/labs/trends${query({ analyte })}`),
  edaShift: (limit = 12) => getJSON(`/eda/labs/shift${query({ limit })}`),
  edaSunburst: () => getJSON('/eda/labs/sunburst'),
  edaFlow: () => getJSON('/eda/labs/flow'),
  edaRadiation: () => getJSON('/eda/radiation/series'),
  edaExtremes: (limit = 15) => getJSON(`/eda/extremes${query({ limit })}`),

  predictLabs: ({ crew, analyte } = {}) => getJSON(`/predict/labs${query({ crew, analyte })}`),
  predictRisks: (limit = 20) => getJSON(`/predict/labs/risks${query({ limit })}`),
  predictRadiation: () => getJSON('/predict/radiation'),
  predictVitals: ({ crew } = {}) => getJSON(`/predict/vitals${query({ crew })}`),
}
