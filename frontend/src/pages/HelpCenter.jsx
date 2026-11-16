import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useViewer } from '../context/ViewerContext'
import Card from '../components/Card'
import HelpPanel from '../components/dashboard/HelpPanel'

// Clinical inbox: the CMO and flight surgeon see every open request here. The
// crew-facing "Request help" drawer stays on the Overview.
export default function HelpCenter() {
  const { viewer, role } = useViewer()
  const [count, setCount] = useState(0)

  const loadCount = useCallback(async () => {
    try {
      const data = await api.helpRequests({ viewer, role })
      const open = Array.isArray(data.open) ? data.open : []
      setCount(open.filter((item) => item.status === 'requested' || item.status === 'escalated').length)
    } catch {
      setCount(0)
    }
  }, [viewer, role])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refresh the inbox count
    loadCount()
    const timer = setInterval(loadCount, 5000)
    return () => clearInterval(timer)
  }, [loadCount])

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">Crew support</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Help requests</h1>
        <p className="mt-1 text-sm text-slate-400">
          {count > 0 ? `${count} request${count === 1 ? '' : 's'} waiting for a responder.` : 'No open requests right now.'}
        </p>
      </header>
      <Card title="Queue">
        <HelpPanel embedded />
      </Card>
    </div>
  )
}
