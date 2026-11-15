import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Card from '../Card'
import Chip from '../Chip'
import { Empty } from '../StateView'
import PrivacyNote from './PrivacyNote'
import { safeArray } from './format'

// One-line lab summary for the Overview. The seven rows and the charts live in
// Blood & heart; keeping the full table here duplicated the system cards and
// pushed the page past the 20-item information budget.
export default function LabsSummary({ labs, role }) {
  const rows = safeArray(labs)
  const total = rows.length
  const inRange = rows.filter((lab) => lab.flag === 'normal').length
  const latest = rows[0]?.timepoint

  return (
    <Card
      title="Released research labs"
      subtitle="Inspiration4 CBC/CMP, de-identified by NASA. The full table and charts are in Blood & heart."
      action={<Chip kind="real">Real NASA</Chip>}
    >
      {labs === null || labs === undefined ? (
        <PrivacyNote role={role} scope="labs" />
      ) : total === 0 ? (
        <Empty>No lab rows for this crew member in the API response.</Empty>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-2xl font-bold text-white">
            {inRange}
            <span className="ml-1 text-sm font-medium text-slate-400">of {total} in range</span>
          </p>
          <p className="text-xs text-slate-400">
            Latest draw {latest ?? '—'} · OSD-569 / OSD-575
          </p>
          <Link
            to="/dashboard/heart"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-cyan-200"
          >
            Open Blood &amp; heart
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      )}
    </Card>
  )
}
