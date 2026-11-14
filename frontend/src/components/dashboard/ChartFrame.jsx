import { ResponsiveContainer } from 'recharts'
import Card from '../Card'

// Wraps a chart with the two things the product requires: one readable chart
// area and a plain-language takeaway that is visible text, not only a tooltip.
export default function ChartFrame({ title, subtitle, takeaway, height = 260, children }) {
  return (
    <Card title={title} subtitle={subtitle} className="min-w-0">
      <figure className="m-0 min-w-0">
        <div className="w-full min-w-0" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
        {takeaway && <figcaption className="mt-2 text-xs leading-relaxed text-slate-400">{takeaway}</figcaption>}
      </figure>
    </Card>
  )
}
