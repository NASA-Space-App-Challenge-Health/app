import Card from '../Card'
import Chip from '../Chip'
import { Empty } from '../StateView'
import { safeArray } from './format'

// Team schedule estimate. It is simulated, so the card says so next to the
// suggestion instead of styling it as a measurement.
export default function HygieneCard({ hygiene, viewer }) {
  if (!hygiene) {
    return (
      <Card title="Hygiene timing" subtitle="Team schedule idea.">
        <Empty>No hygiene schedule in this payload.</Empty>
      </Card>
    )
  }

  const order = safeArray(hygiene.order)
  const station = hygiene.station ?? 'Hygiene station'

  return (
    <Card title={station} subtitle="Team schedule idea under OCHMO countermeasures." action={<Chip kind="simulated">Simulated</Chip>}>
      {hygiene.suggestion && <p className="text-sm leading-relaxed text-slate-200">{hygiene.suggestion}</p>}

      {order.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {order.map((callSign, index) => (
            <li key={`${callSign}-${index}`} className="flex items-center gap-2 text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px] text-slate-300">
                {index + 1}
              </span>
              <span className={callSign === viewer ? 'font-semibold text-accent' : 'text-slate-300'}>{callSign}</span>
              {callSign === viewer && <span className="text-[11px] text-cyan-300">selected</span>}
            </li>
          ))}
        </ol>
      )}

      {hygiene.label && <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{hygiene.label}</p>}
    </Card>
  )
}
