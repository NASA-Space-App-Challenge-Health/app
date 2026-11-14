// Shared Recharts styling so every chart on the board reads the same way on the
// dark surface. Animation is disabled on the series themselves for reduced
// motion and to keep the charts cheap to paint.
export const CREW_COLORS = {
  C001: '#00e5ff',
  C002: '#a78bfa',
  C003: '#34d399',
  C004: '#fbbf24',
}

export const FALLBACK_COLORS = ['#00e5ff', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#94a3b8']

export const AXIS_TICK = { fill: '#94a3b8', fontSize: 11 }

export const AXIS_PROPS = {
  tick: AXIS_TICK,
  stroke: '#334155',
  tickLine: false,
}

export const GRID_PROPS = {
  strokeDasharray: '3 3',
  stroke: '#1e2438',
  vertical: false,
}

export const LEGEND_PROPS = {
  wrapperStyle: { fontSize: 11, color: '#cbd5e1', paddingTop: 4 },
  iconSize: 8,
}
