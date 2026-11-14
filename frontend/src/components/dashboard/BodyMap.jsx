import { useId, useState } from 'react'
import { Bone, Brain, Droplets, Dumbbell, Eye, HeartPulse, Radiation } from 'lucide-react'
import Card from '../Card'
import Chip, { bandChip } from '../Chip'
import SourceLinks from '../SourceLinks'
import { Empty } from '../StateView'
import { safeArray } from './format'

const REGION_ICONS = {
  head: Brain,
  eyes: Eye,
  heart: HeartPulse,
  blood: Droplets,
  muscles: Dumbbell,
  bones: Bone,
  environment: Radiation,
}

function RegionDetail({ region }) {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{region.label}</h3>
        {region.status ? bandChip(region.status) : <Chip kind="neutral">No status</Chip>}
      </div>

      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-semibold uppercase tracking-wide text-slate-500">Function</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-300">{region.function ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-slate-500">Why it matters in space</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-300">{region.why ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-slate-500">What the data shows</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-300">{region.spaceflight ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-slate-500">Prevention</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-300">{region.prevention ?? '—'}</dd>
        </div>
      </dl>

      <SourceLinks sources={region.sources ?? []} className="mt-3" />
    </div>
  )
}

// Accessible body map: real buttons with aria-pressed and aria-controls, plus a
// labelled detail region. Selecting a region reveals the plain-language source
// text; colour is always paired with the status word.
export default function BodyMap({ body, title = 'Body map', subtitle, initialId }) {
  const regions = safeArray(body)
  const detailId = useId()
  const [selectedId, setSelectedId] = useState(initialId ?? null)
  const selected = regions.find((region) => region.id === selectedId) ?? regions[0] ?? null

  return (
    <Card title={title} subtitle={subtitle}>
      {regions.length === 0 ? (
        <Empty>The API returned no body entries.</Empty>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {regions.map((region) => {
              const Icon = REGION_ICONS[region.id] ?? Radiation
              const active = selected?.id === region.id
              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => setSelectedId(region.id)}
                  aria-pressed={active}
                  aria-controls={detailId}
                  className={`h-full rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? 'border-accent/60 bg-accent/10'
                      : 'border-white/10 bg-panel2/60 hover:border-white/25'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium leading-snug text-white">
                    <Icon size={16} className="shrink-0 text-cyan-300" aria-hidden="true" />
                    {region.label}
                  </span>
                  <span className="mt-2 flex">
                    {region.status ? bandChip(region.status) : <Chip kind="neutral">No status</Chip>}
                  </span>
                </button>
              )
            })}
          </div>

          <div id={detailId} aria-live="polite">
            {selected && <RegionDetail region={selected} />}
          </div>
        </>
      )}
    </Card>
  )
}
