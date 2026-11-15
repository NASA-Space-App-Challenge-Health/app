import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import Card from '../components/Card'
import Chip from '../components/Chip'
import { Empty, ErrorState, Loading } from '../components/StateView'
import { useViewer } from '../context/ViewerContext'
import useFetch from '../hooks/useFetch'

// Crew profile: personal data, mission, and the readable lab history for the
// selected crew member. Values come from the same open NASA tables as the board.
export default function Profile() {
  const { viewer, role } = useViewer()
  const load = useCallback(() => api.dashboard({ viewer, role }), [viewer, role])
  const { data, loading, error, reload } = useFetch(load, [viewer, role])

  if (loading) return <Loading label="Loading the crew profile…" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const member = data?.crew?.find((item) => item.call_sign === viewer) ?? data?.crew?.[0]
  if (!member) return <Empty>No crew member returned by the API.</Empty>

  const visible = member.visible === 'full'
  const labs = member.labs ?? []

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Crew profile</h1>
          <p className="text-sm text-slate-400">
            {member.call_sign} · {member.role_title}
          </p>
        </div>
        <Chip kind={member.is_cmo ? 'real' : 'neutral'}>{member.is_cmo ? 'CMO' : 'Crew member'}</Chip>
      </header>

      {!visible && (
        <Card title="This panel is private in the current role" subtitle="OCHMO privacy demo">
          <p className="text-sm text-slate-300">
            Switch to <strong>Self</strong>, <strong>CMO</strong> or <strong>Flight surgeon</strong> in the header to
            read the measurements.
          </p>
        </Card>
      )}

      {visible && (
        <Card
          title="Released research labs"
          action={<Chip kind="real">Real NASA</Chip>}
        >
          {labs.length === 0 ? (
            <Empty>No lab rows for this crew member in the API response.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4 font-medium">Test</th>
                    <th className="py-2 pr-4 font-medium">Value</th>
                    <th className="py-2 pr-4 font-medium">Reference</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {labs.map((lab) => (
                    <tr key={`${lab.analyte}-${lab.timepoint}`} className="border-b border-white/5">
                      <td className="py-2 pr-4 text-slate-200">{lab.analyte}</td>
                      <td className="py-2 pr-4 text-white">
                        {lab.value} <span className="text-xs text-slate-400">{lab.unit}</span>
                      </td>
                      <td className="py-2 pr-4 text-slate-400">
                        {lab.ref_low ?? '—'}–{lab.ref_high ?? '—'}
                      </td>
                      <td className="py-2">
                        <Chip kind={lab.flag === 'normal' ? 'nominal' : 'watch'}>
                          {lab.flag === 'normal' ? 'In range' : lab.flag}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <p className="text-xs text-slate-500">
        Looking for the whole crew?{' '}
        <Link className="text-cyan-300 underline decoration-dotted" to="/dashboard">
          Go back to the overview board
        </Link>
        .
      </p>
    </div>
  )
}
