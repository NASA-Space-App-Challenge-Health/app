import { useCallback, useEffect, useRef, useState } from 'react'

// Small data hook shared by the pages: loading, error, retry, and a reload
// function. The fetcher must be stable (wrap it with useCallback) or be passed
// with its dependencies re-created only when the request really changes.
export default function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const mounted = useRef(true)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    setState((previous) => ({ ...previous, loading: true, error: null }))
    fetcher()
      .then((data) => {
        if (!cancelled && mounted.current) setState({ data, error: null, loading: false })
      })
      .catch((error) => {
        if (!cancelled && mounted.current) {
          setState({ data: null, error: error.message || 'Request failed.', loading: false })
        }
      })
    return () => {
      cancelled = true
      mounted.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { ...state, reload }
}
