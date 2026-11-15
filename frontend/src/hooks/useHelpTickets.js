import { useEffect, useState } from 'react'
import { api } from '../api'

// Polls the help queue for clinical roles so the sidebar badge and banner work
// before the help drawer/page is opened. HelpPanel has its own poll while open.
export default function useHelpTickets({ viewer, role, enabled = true }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return undefined
    }
    let cancelled = false
    const load = async () => {
      try {
        const data = await api.helpRequests({ viewer, role })
        if (cancelled) return
        const open = Array.isArray(data.open) ? data.open : []
        setCount(open.filter((item) => item.status === 'requested' || item.status === 'escalated').length)
      } catch {
        // A background badge must not break the board.
      }
    }
    // oxlint-disable-next-line react/set-state-in-effect -- first poll runs on mount
    load()
    const timer = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [viewer, role, enabled])

  return count
}
