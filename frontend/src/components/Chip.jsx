// Small label used to mark where a number comes from and how serious it is.
// Text is always present, so colour is never the only signal.
const STYLES = {
  real: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  simulated: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
  nominal: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  watch: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  concern: 'border-red-500/40 bg-red-500/10 text-red-300',
  emergency: 'border-red-500/50 bg-red-500/15 text-red-300',
  neutral: 'border-white/10 bg-white/5 text-slate-300',
}

const LABELS = {
  real: 'Real NASA',
  simulated: 'Simulated',
  nominal: 'Nominal',
  watch: 'Watch',
  concern: 'Concern',
  emergency: 'Emergency',
}

export default function Chip({ kind = 'neutral', children, className = '', title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STYLES[kind] ?? STYLES.neutral} ${className}`}
    >
      {children ?? LABELS[kind] ?? kind}
    </span>
  )
}

export function bandChip(band) {
  return <Chip kind={band === 'concern' || band === 'critical' ? 'concern' : band === 'watch' ? 'watch' : 'nominal'} />
}

// Single source-of-truth label for data provenance. Every number the product
// shows must carry one of these next to it: NASA open data or the simulated
// POC layer. The tooltip explains what the card's source line already says.
export function OriginChip({ origin, className = '', title }) {
  if (origin === 'real') {
    return (
      <Chip
        kind="real"
        className={className}
        title={title ?? 'NASA open data; the card lists the study or instrument'}
      >
        Real NASA
      </Chip>
    )
  }
  if (origin === 'simulated') {
    return (
      <Chip
        kind="simulated"
        className={className}
        title={title ?? 'Generated for the POC; not a NASA measurement'}
      >
        Simulated
      </Chip>
    )
  }
  return (
    <Chip kind="neutral" className={className} title="The API did not return an origin for this value">
      Source n/a
    </Chip>
  )
}
