import Card from '../Card'
import Chip, { OriginChip } from '../Chip'

export { OriginChip }

// Small presentational pieces shared by the four Insights panels. Colour is
// always paired with a text label.

export function ChartCard({ title, summary, provenance, children, className = '' }) {
  return (
    <Card
      title={title}
      className={className}
      action={provenance ? <OriginChip origin={provenance} /> : undefined}
    >
      {summary && <p className="mb-3 text-sm leading-relaxed text-slate-300">{summary}</p>}
      {children}
    </Card>
  )
}

export function BigStat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-panel/80 p-4 shadow-lg shadow-black/20">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-tight text-white">{value}</p>
      {hint && <p className="mt-1 text-xs leading-snug text-slate-400">{hint}</p>}
    </div>
  )
}

export function FlagChip({ flag }) {
  if (flag === 'high') return <Chip kind="concern">High</Chip>
  if (flag === 'low') return <Chip kind="watch">Low</Chip>
  if (flag === 'normal') return <Chip kind="nominal">In range</Chip>
  return <Chip kind="neutral">No flag</Chip>
}

export function ConfidenceChip({ confidence }) {
  const kind =
    confidence === 'high' ? 'nominal' : confidence === 'medium' ? 'watch' : 'neutral'
  return <Chip kind={kind}>Confidence: {confidence ?? 'unknown'}</Chip>
}

export function Note({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-white/10 bg-white/[0.03] text-slate-300',
    watch: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  }
  return (
    <p className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${tones[tone] ?? tones.neutral}`}>
      {children}
    </p>
  )
}

// Short labelled details block used for model caveats and scope notes.
export function Details({ label, children, className = '' }) {
  return (
    <details className={`group text-xs ${className}`}>
      <summary className="cursor-pointer list-none text-cyan-300 underline decoration-dotted underline-offset-2 hover:text-accent">
        {label}
      </summary>
      <div className="mt-2 space-y-1.5 leading-relaxed text-slate-400">{children}</div>
    </details>
  )
}
