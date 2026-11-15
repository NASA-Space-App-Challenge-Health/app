import { useId } from 'react'
import Chip, { OriginChip } from '../Chip'
import SourceLinks from '../SourceLinks'
import { evidenceRows } from './format'

// Crew-wide notice. The old banner overlapped text and struck it through, so
// this card keeps exactly one headline and one short public sentence on the
// surface; the technical detail, evidence, and sources sit behind <details>.
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
      className={`rounded-2xl border p-5 shadow-lg shadow-black/20 ${
        emergency ? 'border-red-500/40 bg-red-500/10' : 'border-white/10 bg-panel/80'
      }`}
    >
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

      <h2 id={titleId} className="mt-2 text-lg font-semibold leading-snug text-white">
        {headline}
      </h2>
      {sentence && (
        <p className={`mt-1 max-w-3xl text-sm leading-relaxed ${emergency ? 'text-red-100' : 'text-slate-200'}`}>
          {sentence}
        </p>
      )}

      <details
        className={`mt-3 rounded-xl border px-3 py-2 ${
          emergency ? 'border-red-400/30 bg-black/10' : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        <summary
          className={`cursor-pointer text-xs font-semibold ${emergency ? 'text-red-100' : 'text-slate-200'}`}
        >
          Full detail, evidence and sources
        </summary>
        <div
          className={`mt-2 space-y-2 text-sm leading-relaxed ${
            emergency ? 'text-red-100/90' : 'text-slate-300'
          }`}
        >
          {detail && detail !== sentence && <p>{detail}</p>}
          {action && (
            <p>
              <span className={`font-semibold ${emergency ? 'text-red-50' : 'text-white'}`}>Suggested action: </span>
              {action}
            </p>
          )}
          {rows.length > 0 && (
            <dl className="grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.key} className="flex gap-1">
                  <dt className="shrink-0 opacity-70">{row.label}:</dt>
                  <dd className="min-w-0 break-words">
                    {row.key.endsWith('_link') && /^https?:\/\//i.test(row.value) ? (
                      <a
                        href={row.value}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-dotted underline-offset-2 hover:text-white"
                      >
                        Open record
                      </a>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <SourceLinks sources={alert.sources ?? []} className="pt-1" />
        </div>
      </details>
    </section>
  )
}
