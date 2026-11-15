import { Link } from 'react-router-dom'
import Card from '../Card'
import Chip, { OriginChip } from '../Chip'
import SourceLinks from '../SourceLinks'
import { Empty } from '../StateView'
import { confidenceKind, safeArray } from './format'

// Two preventive cards from /recommendations, filtered to what the current role
// may see. Crew-wide emergency cards already have their own panel above, so
// they are left out of this preview.
export default function RecommendationPreview({ recommendations, title = 'Recommendations' }) {
  const items = safeArray(recommendations)
    .filter((item) => !item.broadcast && item.tier !== 'emergency')
    .slice(0, 2)

  return (
    <Card
      title={title}
      subtitle="Preventive cards visible to this role."
      action={
        <Link
          to="/insights"
          className="text-xs font-medium text-cyan-300 underline decoration-dotted underline-offset-2 hover:text-cyan-200"
        >
          All insights
        </Link>
      }
    >
      {items.length === 0 ? (
        <Empty>No preventive cards for this role. Switch to CMO or Flight surgeon to see them.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((item, index) => {
            const action = item.what_to_do ?? item.suggested_action ?? item.detail ?? ''
            return (
              <li
                key={`${item.id ?? 'recommendation'}-${index}`}
                className="flex h-full min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <OriginChip origin={item.origin} />
                  {item.confidence ? (
                    <Chip kind={confidenceKind(item.confidence)}>Confidence: {item.confidence}</Chip>
                  ) : item.severity ? (
                    <Chip kind="watch">Severity: {item.severity}</Chip>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-semibold leading-snug text-white">
                  {item.title ?? 'Preventive card'}
                </p>
                {action && <p className="mt-1 text-xs leading-relaxed text-slate-300">{action}</p>}
                <SourceLinks sources={item.sources ?? []} className="mt-auto pt-3" />
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
