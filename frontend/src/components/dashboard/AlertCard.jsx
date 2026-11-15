import { useId } from 'react'
import { AlertTriangle } from 'lucide-react'
import Chip, { OriginChip } from '../Chip'
import SourceLinks from '../SourceLinks'
import { evidenceRows } from './format'

// Crew-wide notice. Exactly one headline, one short public sentence and the
// sources; the technical detail and clinician instruction sit behind a
// disclosure. An emergency gets a stronger surface and an icon, but the public
// text never names a person or a diagnosis.
export default function AlertCard({ alert }) {
  const titleId = useId()
  if (!alert) return null

  const emergency = alert.tier === 'emergency' || alert.kind === 'emergency' || alert.severity === 'critical'
  const headline = alert.public_title ?? alert.title ?? 'Crew notice'
  const sentence = alert.public_detail ?? alert.detail ?? ''
  const rows = evidenceRows(alert.evidence)
  const detail = alert.detail ?? ''
  const action = alert.suggested_action ?? ''

  return (
    <section
      aria-labelledby={titleId}
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-lg shadow-black/20 ${
        emergency ? 'border-red-500/50 bg-red-500/10' : 'border-white/10 bg-panel/80'
      }`}
    >
      {emergency && <span className="absolute inset-y-0 left-0 w-1 bg-red-500/70" aria-hidden="true" />}

      <div className="flex items-start gap-3">
        {emergency && (
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400/50 bg-red-500/15 text-red-300">
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Chip kind={emergency ? 'emergency' : 'neutral'}>
              {emergency ? 'Emergency · crew broadcast' : 'Crew-wide notice'}
            </Chip>
            {alert.origin && <OriginChip origin={alert.origin} />}
            {alert.severity && (
              <span
                className={`text-[11px] font-medium uppercase tracking-wide ${
                  emergency ? 'text-red-200/90' : 'text-slate-400'
                }`}
              >
                Severity: {alert.severity}
              </span>
            )}
          </div>

          <h2 id={titleId} className={`mt-2 font-semibold leading-snug text-white ${emergency ? 'text-xl' : 'text-lg'}`}>
            {headline}
          </h2>
          {sentence && (
            <p className={`mt-1 max-w-3xl text-sm leading-relaxed ${emergency ? 'text-red-100' : 'text-slate-200'}`}>
              {sentence}
            </p>
          )}
          {!emergency && action && (
            <p className="mt-2 text-xs font-medium text-slate-300">
              <span className="font-semibold">Next step: </span>
              {action}
            </p>
          )}
        </div>
      </div>

      <details
        className={`mt-4 rounded-xl border px-3 py-2 ${
          emergency ? 'border-red-400/30 bg-black/10' : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        <summary className={`cursor-pointer text-xs font-semibold ${emergency ? 'text-red-100' : 'text-slate-200'}`}>
          {emergency ? 'Procedure, evidence and sources' : 'Full detail, evidence and sources'}
        </summary>
        <div className={`mt-2 space-y-2 text-sm leading-relaxed ${emergency ? 'text-red-100/90' : 'text-slate-300'}`}>
          {detail && detail !== sentence && <p>{detail}</p>}
          {action && (
            <p>
              <span className={`font-semibold ${emergency ? 'text-red-50' : 'text-white'}`}>Suggested action: </span>
              {action}
            </p>
          )}
          {rows.length > 0 && (
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.key} className="flex flex-wrap gap-x-2">
                  <dt className={emergency ? 'text-red-200/80' : 'text-slate-400'}>{row.label}:</dt>
                  <dd className="text-white">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <SourceLinks sources={alert.sources ?? []} />
        </div>
      </details>
    </section>
  )
}
