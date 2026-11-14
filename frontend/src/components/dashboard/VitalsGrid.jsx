import Card from '../Card'
import Chip, { bandChip } from '../Chip'
import { Empty } from '../StateView'
import PrivacyNote from './PrivacyNote'
import { formatNumber, originKind, safeArray } from './format'

function ReadingCard({ reading }) {
  const hasValue = reading.value !== null && reading.value !== undefined
  const originText = reading.origin === 'real' ? 'Real' : reading.origin === 'simulated' ? 'Simulated' : 'Unknown'
  const hasDetail = Boolean(reading.explanation || reading.guidance)

  return (
    <li>
      <article className="h-full rounded-xl border border-white/10 bg-panel2/60 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{reading.label}</p>
          {!hasValue ? (
            <Chip kind="neutral">No value</Chip>
          ) : reading.risk_band ? (
            bandChip(reading.risk_band)
          ) : (
            <Chip kind="neutral">No band</Chip>
          )}
        </div>

        <p className="mt-2 text-2xl font-semibold leading-tight text-white">
          {hasValue ? (
            <>
              {formatNumber(reading.value, reading.decimals)}
              {reading.unit && <span className="ml-1 text-sm font-normal text-slate-400">{reading.unit}</span>}
            </>
          ) : (
            <span className="text-sm font-normal text-slate-400">No value in this payload</span>
          )}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip kind={originKind(reading.origin)}>{originText}</Chip>
        </div>

        {hasDetail && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-medium text-cyan-300">Explanation and guidance</summary>
            <div className="mt-1 space-y-1 text-[11px] leading-relaxed text-slate-400">
              {reading.explanation && <p>{reading.explanation}</p>}
              {reading.guidance && <p className="text-slate-300">{reading.guidance}</p>}
            </div>
          </details>
        )}
      </article>
    </li>
  )
}

export default function VitalsGrid({
  readings,
  role,
  title = 'Vitals',
  subtitle = 'Simulated unless a chip says Real.',
  indicators,
  emptyMessage = 'No readings for this panel in the API response.',
}) {
  const all = safeArray(readings)
  const filtered = indicators ? all.filter((reading) => indicators.includes(reading.indicator)) : all

  return (
    <Card title={title} subtitle={subtitle}>
      {readings === null || readings === undefined ? (
        <PrivacyNote role={role} scope="vitals" />
      ) : filtered.length === 0 ? (
        <Empty>{emptyMessage}</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((reading) => (
            <ReadingCard key={reading.indicator} reading={reading} />
          ))}
        </ul>
      )}
    </Card>
  )
}
