import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, CREW, ROLES, setSessionToken } from '../api'

// The OCHMO privacy demo: who is looking at the board (viewer) and which role
// they act as (role). The server signs the demo identity, so the query string
// alone cannot select another crew member when DEMO_AUTH_REQUIRED is on.
const ViewerContext = createContext(null)
const ROLE_IDS = new Set(ROLES.map((item) => item.id))

function readFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const viewer = CREW.includes(params.get('viewer')) ? params.get('viewer') : 'C001'
  const role = ROLE_IDS.has(params.get('role')) ? params.get('role') : 'self'
  return { viewer, role }
}

export function ViewerProvider({ children }) {
  const initial = useRef(readFromUrl()).current
  const [state, setState] = useState(initial)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  const apply = useCallback(async (next) => {
    const id = requestId.current + 1
    requestId.current = id
    setBusy(true)
    try {
      const session = await api.createSession(next)
      if (id !== requestId.current) return
      setSessionToken(session.token)
      setState(next)
      const params = new URLSearchParams(window.location.search)
      params.set('viewer', next.viewer)
      params.set('role', next.role)
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
      setError('')
      setReady(true)
    } catch (err) {
      if (id === requestId.current) {
        setError(err.message || 'Could not open a demo session.')
        setReady(true)
      }
    } finally {
      if (id === requestId.current) setBusy(false)
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- open the signed demo session once
    apply(initial)
  }, [apply, initial])

  const sync = useCallback((next) => apply(next), [apply])
  const setViewer = useCallback((viewer) => sync({ ...state, viewer }), [state, sync])
  const setRole = useCallback((role) => sync({ ...state, role }), [state, sync])

  const value = useMemo(
    () => ({ viewer: state.viewer, role: state.role, setViewer, setRole, busy, error }),
    [state.viewer, state.role, setViewer, setRole, busy, error],
  )

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-space px-4 text-sm text-slate-300">
        Opening T.H.A.I.S. demo session…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-space px-4 text-center text-sm text-slate-300">
        <p role="alert" className="max-w-md rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          {error}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black"
        >
          Try again
        </button>
      </div>
    )
  }

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
}

export function useViewer() {
  const context = useContext(ViewerContext)
  if (!context) throw new Error('useViewer must be used inside ViewerProvider')
  return context
}
