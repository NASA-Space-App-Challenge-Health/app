const KIND_COLORS = {
  nominal: 'bg-emerald-400',
  watch: 'bg-amber-400',
  concern: 'bg-red-400',
  neutral: 'bg-slate-400',
}

// Draws where a value sits inside the illustrative band the backend returns for
// that indicator. The nominal window is green, the wider watch window is amber,
// and the marker uses the reading's own band. No value is invented here: without
// bands the component renders nothing.
export default function MetricBar({
  value,
  unit = '',
  bands,
  kind = 'nominal',
  compact = false,
  label = '',
  className = '',
}) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || !bands?.nominal || !bands?.watch) return null

  const [nominalLow, nominalHigh] = bands.nominal
  const [watchLow, watchHigh] = bands.watch
  const span = Math.max(watchHigh - watchLow, Math.abs(nominalHigh) * 0.1, 1)
  const domainLow = watchLow - span * 0.25
  const domainHigh = watchHigh + span * 0.25
  const domainSpan = domainHigh - domainLow
  const position = (number) => Math.min(100, Math.max(0, ((number - domainLow) / domainSpan) * 100))

  const markerColor = KIND_COLORS[kind] ?? KIND_COLORS.neutral
  const ariaLabel = `${label ? `${label}: ` : ''}${numeric} ${unit}. Nominal band ${nominalLow} to ${nominalHigh}; watch band ${watchLow} to ${watchHigh}. ${bands.label ?? ''}`.trim()

  return (
    <div className={`min-w-0 ${className}`} role="img" aria-label={ariaLabel}>
      <div className={`relative w-full rounded-full bg-white/10 ${compact ? 'h-2' : 'h-2.5'}`}>
        <div
          className="absolute inset-y-0 rounded-full bg-amber-500/20"
          style={{ left: `${position(watchLow)}%`, width: `${Math.max(position(watchHigh) - position(watchLow), 2)}%` }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-y-0 rounded-full bg-emerald-500/30"
          style={{
            left: `${position(nominalLow)}%`,
            width: `${Math.max(position(nominalHigh) - position(nominalLow), 2)}%`,
          }}
          aria-hidden="true"
        />
        <span
          className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-space ${markerColor}`}
          style={{ left: `calc(${position(numeric)}% - 6px)` }}
          aria-hidden="true"
        />
      </div>
      {!compact && (
        <p className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>watch {watchLow}</span>
          <span className="text-slate-400">nominal {nominalLow}–{nominalHigh}</span>
          <span>{watchHigh}</span>
        </p>
      )}
    </div>
  )
}
