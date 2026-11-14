// Custom Recharts tooltip so stacked reference bands and other helper series
// never show up as if they were measurements.
export default function ChartTooltip({ active, payload, label, unit = '', decimals = 0, hide = [] }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null

  const rows = payload.filter((entry) => typeof entry.value === 'number' && !hide.includes(entry.dataKey))
  if (rows.length === 0) return null

  const places = Math.max(0, Math.min(4, Number(decimals) || 0))

  return (
    <div className="rounded-xl border border-edge bg-panel px-3 py-2 text-xs shadow-lg shadow-black/30">
      <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <ul className="space-y-0.5">
        {rows.map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color ?? '#94a3b8' }}
              aria-hidden="true"
            />
            <span className="text-slate-300">{entry.name ?? entry.dataKey}</span>
            <span className="ml-auto pl-3 font-medium text-white">
              {Number(entry.value).toFixed(places)}
              {unit ? ` ${unit}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
