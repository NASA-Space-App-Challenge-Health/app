import { useCallback, useEffect, useMemo, useState } from 'react'
import { CREW_IDS, TOPIC_IDS, VIEWS } from './constants'

// Filter state for the Data insights page, mirrored into the URL query string
// so a filtered view is shareable. We read and write only our own keys with
// history.replaceState: the viewer/role params owned by ViewerContext stay put.

const VIEW_IDS = VIEWS.map((view) => view.id)

const DEFAULT_FILTERS = {
  crew: [...CREW_IDS],
  topics: [...TOPIC_IDS],
  view: 'overview',
  only: false,
}

function readList(params, key, allowed) {
  if (!params.has(key)) return [...allowed]
  const raw = params.get(key) ?? ''
  if (raw.trim() === '') return []
  const requested = raw.split(',').map((value) => value.trim())
  const picked = allowed.filter((value) => requested.includes(value))
  // Hand-edited or stale URLs: fall back to "all" instead of an empty board.
  return picked.length > 0 ? picked : [...allowed]
}

function readFilters() {
  if (typeof window === 'undefined') return DEFAULT_FILTERS
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  return {
    crew: readList(params, 'crew', CREW_IDS),
    topics: readList(params, 'topic', TOPIC_IDS),
    view: VIEW_IDS.includes(view) ? view : 'overview',
    only: params.get('only') === '1',
  }
}

function writeFilters(filters) {
  if (typeof window === 'undefined') return
  // Start from the live query string so viewer/role (and any future param) survive.
  const params = new URLSearchParams(window.location.search)
  if (filters.crew.length === CREW_IDS.length) params.delete('crew')
  else params.set('crew', filters.crew.join(','))
  if (filters.topics.length === TOPIC_IDS.length) params.delete('topic')
  else params.set('topic', filters.topics.join(','))
  if (filters.view === 'overview') params.delete('view')
  else params.set('view', filters.view)
  if (filters.only) params.set('only', '1')
  else params.delete('only')
  const search = params.toString()
  window.history.replaceState(
    {},
    '',
    `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`,
  )
}

export default function useInsightsFilters() {
  const [filters, setFilters] = useState(readFilters)

  useEffect(() => {
    writeFilters(filters)
  }, [filters])

  const toggleCrew = useCallback((id) => {
    setFilters((current) => {
      const next = current.crew.includes(id)
        ? current.crew.filter((value) => value !== id)
        : [...current.crew, id]
      return { ...current, crew: CREW_IDS.filter((value) => next.includes(value)) }
    })
  }, [])

  const toggleTopic = useCallback((id) => {
    setFilters((current) => {
      const next = current.topics.includes(id)
        ? current.topics.filter((value) => value !== id)
        : [...current.topics, id]
      return { ...current, topics: TOPIC_IDS.filter((value) => next.includes(value)) }
    })
  }, [])

  const setView = useCallback((view) => {
    setFilters((current) => ({ ...current, view }))
  }, [])

  const setOnly = useCallback((only) => {
    setFilters((current) => ({ ...current, only }))
  }, [])

  const setCrew = useCallback((ids) => {
    setFilters((current) => ({
      ...current,
      crew: CREW_IDS.filter((id) => ids.includes(id)),
    }))
  }, [])

  const reset = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  const crewSet = useMemo(() => new Set(filters.crew), [filters.crew])
  const topicSet = useMemo(() => new Set(filters.topics), [filters.topics])

  return {
    crew: filters.crew,
    topics: filters.topics,
    view: filters.view,
    only: filters.only,
    crewSet,
    topicSet,
    toggleCrew,
    toggleTopic,
    setView,
    setOnly,
    setCrew,
    reset,
  }
}
