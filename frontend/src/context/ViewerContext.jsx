import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CREW } from '../api'

// The OCHMO privacy demo: who is looking at the board (viewer) and which role
// they act as (role). Kept in the URL so a filtered view is shareable.
const ViewerContext = createContext(null)

function readFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const viewer = CREW.includes(params.get('viewer')) ? params.get('viewer') : 'C001'
  const role = params.get('role') || 'self'
  return { viewer, role }
}

export function ViewerProvider({ children }) {
  const [state, setState] = useState(readFromUrl)

  const sync = useCallback((next) => {
    setState(next)
    const params = new URLSearchParams(window.location.search)
    params.set('viewer', next.viewer)
    params.set('role', next.role)
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
  }, [])

  const setViewer = useCallback((viewer) => sync({ ...state, viewer }), [state, sync])
  const setRole = useCallback((role) => sync({ ...state, role }), [state, sync])

  const value = useMemo(
    () => ({ viewer: state.viewer, role: state.role, setViewer, setRole }),
    [state.viewer, state.role, setViewer, setRole],
  )

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
}

export function useViewer() {
  const context = useContext(ViewerContext)
  if (!context) throw new Error('useViewer must be used inside ViewerProvider')
  return context
}
