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

// The API returns one card per crew member for the same finding. On a desktop
// that becomes a wall of near-duplicates, so identical findings are grouped and
// the per-crew values stay available behind one disclosure.
function groupRecommendations(cards) {
  const groups = new Map()
  for (const card of cards) {
    const key = `${card.technical?.analyte ?? card.indicator ?? card.title}|${card.tier}|${card.broadcast ? 'broadcast' : 'preventive'}`
    if (!groups.has(key)) groups.set(key, { key, cards: [], crewIds: [] })
    const group = groups.get(key)
    group.cards.push(card)
    if (card.crew_id && !group.crewIds.includes(card.crew_id)) group.crewIds.push(card.crew_id)
  }
  return [...groups.values()]
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
  const groups = groupRecommendations(visible)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          Showing {groups.length} findings ({visible.length} cards) of {all.length} · role{' '}
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
          {groups.map((group) => {
            const card = group.cards[0]
            const tier = tierMeta(card.tier)
            const technical = technicalRows(card.technical)
            const test = card.technical?.analyte ?? card.indicator
            const crewIds = group.crewIds
            return (
              <li key={group.key}>
                <article className="flex h-full min-w-0 flex-col rounded-2xl border border-white/10 bg-panel/80 p-4 shadow-lg shadow-black/20">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip kind={tier.kind}>{tier.label}</Chip>
                    <OriginChip origin={card.origin} />
                    <ConfidenceChip confidence={card.confidence} />
                  </div>

                  <h3 className="mt-2 text-sm font-semibold leading-snug text-white">
                    {card.title}
                  </h3>
                  {crewIds.length > 1 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Crew</span>
                      {crewIds.map((crewId) => (
                        <Chip key={crewId} kind="neutral">
                          {crewId}
                        </Chip>
                      ))}
                    </div>
                  )}
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
                    <Details label="Context and actions">
                      <dl className="space-y-1.5">
                        {card.why_it_matters_in_space && (
                          <div>
                            <dt className="text-slate-500">Why it matters in space</dt>
                            <dd>{card.why_it_matters_in_space}</dd>
                          </div>
                        )}
                        {card.what_to_do && (
                          <div>
                            <dt className="text-slate-500">What to do</dt>
                            <dd>{card.what_to_do}</dd>
                          </div>
                        )}
                        {card.who_is_notified && (
                          <div>
                            <dt className="text-slate-500">Who is notified</dt>
                            <dd>{card.who_is_notified}</dd>
                          </div>
                        )}
                        {card.confidence_reason && (
                          <div>
                            <dt className="text-slate-500">Why the confidence is {card.confidence ?? 'unknown'}</dt>
                            <dd>{card.confidence_reason}</dd>
                          </div>
                        )}
                      </dl>
                    </Details>
                    {group.cards.length > 1 ? (
                      <Details label={`Per-crew values (${group.cards.length})`}>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[420px] text-left text-[11px]">
                            <thead className="text-slate-500">
                              <tr>
                                <th className="py-1 pr-2 font-medium">Crew</th>
                                <th className="py-1 pr-2 font-medium">Latest</th>
                                <th className="py-1 pr-2 font-medium">Flag</th>
                                <th className="py-1 font-medium">Next step</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.cards.map((item) => (
                                <tr key={item.crew_id ?? item.id} className="border-t border-white/5">
                                  <td className="py-1 pr-2 font-mono text-slate-300">{item.crew_id ?? 'crew-wide'}</td>
                                  <td className="py-1 pr-2 text-slate-300">
                                    {item.technical?.value ?? '—'} {item.technical?.unit ?? ''}
                                  </td>
                                  <td className="py-1 pr-2 text-slate-300">{item.technical?.flag ?? '—'}</td>
                                  <td className="py-1 text-slate-300">
                                    {typeof item.technical?.next_step?.yhat === 'number'
                                      ? `${item.technical.next_step.yhat.toFixed(1)} ${item.technical?.unit ?? ''}`
                                      : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Details>
                    ) : (
                      technical.length > 0 && (
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
                      )
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
