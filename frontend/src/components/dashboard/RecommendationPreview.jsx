import { Link } from 'react-router-dom'
import Card from '../Card'
import Chip from '../Chip'
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
        <ul className="space-y-3">
          {items.map((item, index) => {
            const action = item.what_to_do ?? item.suggested_action ?? item.detail ?? ''
            return (
              <li
                key={`${item.id ?? 'recommendation'}-${index}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug text-white">{item.title ?? 'Preventive card'}</p>
                  {item.confidence ? (
                    <Chip kind={confidenceKind(item.confidence)}>Confidence: {item.confidence}</Chip>
                  ) : item.severity ? (
                    <Chip kind="watch">Severity: {item.severity}</Chip>
                  ) : null}
                </div>
                {action && <p className="mt-1 text-xs leading-relaxed text-slate-300">{action}</p>}
                <SourceLinks sources={item.sources ?? []} className="mt-2" />
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
