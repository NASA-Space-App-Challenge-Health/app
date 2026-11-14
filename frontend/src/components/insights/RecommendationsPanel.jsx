import Card from '../Card'
import Chip from '../Chip'
import SourceLinks from '../SourceLinks'
import { Empty, ErrorState, Loading } from '../StateView'
import { isOutOfRange, technicalRows, tierMeta } from './constants'
import { ConfidenceChip, Details, Note, OriginChip } from './Ui'

const PRIVATE_ROLES = new Set(['crewmate', 'commander'])

function cardRank(card) {
  return card.tier === 'emergency' ? 0 : 1
}

export default function RecommendationsPanel({
  recommendations,
  loading,
  error,
  reload,
  role,
  viewer,
  crew,
  only,
}) {
  if (loading) return <Loading label="Loading recommendations…" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const all = recommendations?.recommendations ?? []
  const privateRole = PRIVATE_ROLES.has(role)

  const crewWide = all.filter((card) => !card.crew_id)
  const perCrew = all.filter((card) => card.crew_id && crew.has(card.crew_id))
  const visible = [...crewWide, ...perCrew]
    .filter(
      (card) =>
        !only ||
        !card.technical?.flag ||
        isOutOfRange(card.technical.flag) ||
        (card.technical?.flags?.length ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        cardRank(a) - cardRank(b) ||
        String(a.crew_id ?? '').localeCompare(String(b.crew_id ?? '')) ||
        String(a.title ?? '').localeCompare(String(b.title ?? '')),
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          Showing {visible.length} of {all.length} cards · role{' '}
          <span className="text-slate-300">{role}</span> · viewer{' '}
          <span className="text-slate-300">{viewer}</span>
        </p>
        {privateRole && <Note>Private cards are hidden for this role.</Note>}
      </div>

      {all.length === 0 && (
        <Card title="Recommendations">
          <Empty>The API returned no recommendation cards for this viewer and role.</Empty>
        </Card>
      )}

      {all.length > 0 && visible.length === 0 && (
        <Empty>No cards match these filters. Try Reset filters, or turn off Only out-of-range.</Empty>
      )}

      {visible.length > 0 && (
        <ul className="grid gap-3 xl:grid-cols-2">
          {visible.map((card, index) => {
            const tier = tierMeta(card.tier)
            const technical = technicalRows(card.technical)
            const test = card.technical?.analyte ?? card.indicator
            return (
              <li
                key={`${card.id ?? 'card'}-${card.crew_id ?? 'crew'}-${card.indicator ?? 'card'}-${index}`}
              >
                <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-panel/80 p-4 shadow-lg shadow-black/20">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip kind={tier.kind}>{tier.label}</Chip>
                    <OriginChip origin={card.origin} />
                    <ConfidenceChip confidence={card.confidence} />
                  </div>

                  <h3 className="mt-2 text-sm font-semibold leading-snug text-white">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">{card.what_it_means}</p>

                  <p className="mt-2 text-[11px] text-slate-500">
                    {card.crew_id ? (
                      <span className="font-mono">{card.crew_id}</span>
                    ) : (
                      <span>Crew-wide</span>
                    )}
                    {test ? ` · ${test}` : ''}
                    {card.broadcast ? ' · broadcast notice' : ''}
                  </p>

                  <div className="mt-3 space-y-2">
                    {card.why_it_matters_in_space && (
                      <Details label="Why it matters in space">
                        <p>{card.why_it_matters_in_space}</p>
                      </Details>
                    )}
                    {card.what_to_do && (
                      <Details label="What to do">
                        <p>{card.what_to_do}</p>
                      </Details>
                    )}
                    {card.who_is_notified && (
                      <Details label="Who is notified">
                        <p>{card.who_is_notified}</p>
                      </Details>
                    )}
                    {card.confidence_reason && (
                      <Details label="Confidence reason">
                        <p>{card.confidence_reason}</p>
                      </Details>
                    )}
                    {technical.length > 0 && (
                      <Details label="Technical numbers">
                        <dl className="space-y-1">
                          {technical.map(([label, value]) => (
                            <div key={label} className="flex flex-wrap gap-x-2">
                              <dt className="text-slate-500">{label}:</dt>
                              <dd className="text-slate-300">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </Details>
                    )}
                  </div>

                  <div className="mt-auto pt-3">
                    <SourceLinks sources={card.sources} />
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
