import { useCallback, useEffect, useMemo } from 'react'
import { api } from '../api'
import { ErrorState, Loading } from '../components/StateView'
import FilterBar from '../components/insights/FilterBar'
import LabsPanel from '../components/insights/LabsPanel'
import OverviewPanel from '../components/insights/OverviewPanel'
import RadiationPanel from '../components/insights/RadiationPanel'
import RecommendationsPanel from '../components/insights/RecommendationsPanel'
import { VIEW_LABEL } from '../components/insights/constants'
import useInsightsFilters from '../components/insights/useInsightsFilters'
import { useViewer } from '../context/ViewerContext'
import useFetch from '../hooks/useFetch'

// Data insights: one page, one visible section at a time, every number from the
// real API. Filters are client-side and mirrored into the URL query string.
function loadCore(viewer) {
  return Promise.all([
    api.edaOverview({ crew: viewer }),
    api.edaOutOfRange(12, { crew: viewer }),
    api.edaAnalytes({ crew: viewer }),
    api.edaShift(12, { crew: viewer }),
    api.edaRadiation(),
    api.edaExtremes(15, { crew: viewer }),
    api.predictRisks(20, { crew: viewer }),
    api.predictRadiation(),
    api.insights({ viewer }),
  ]).then(([overview, outOfRange, analytes, shift, radiation, extremes, risks, predict, insights]) => ({
    overview,
    outOfRange,
    analytes,
    shift,
    radiation,
    extremes,
    risks,
    predict,
    insights,
  }))
}

export default function Insights() {
  const { viewer, role } = useViewer()
  const {
    topics,
    view,
    only,
    crewSet,
    topicSet,
    toggleTopic,
    setView,
    setOnly,
    setCrew,
    reset,
  } = useInsightsFilters()

  useEffect(() => {
    // The header selector is the demo identity; keep the local crew filter in sync.
    setCrew([viewer])
  }, [viewer, setCrew])

  const core = useFetch(useCallback(() => loadCore(viewer), [viewer]), [viewer])
  const loadRecommendations = useCallback(
    () => api.recommendations({ role, viewer }),
    [role, viewer],
  )
  const recommendations = useFetch(loadRecommendations, [role, viewer])

  const topicCounts = useMemo(() => {
    const counts = { cbc: 0, cmp: 0, cyto: 0, rad: 0 }
    for (const item of core.data?.analytes?.analytes ?? []) {
      if (item.panel === 'CBC') counts.cbc += 1
      else if (item.panel === 'CMP') counts.cmp += 1
      else counts.cyto += 1
    }
    counts.rad = core.data?.overview?.radiation_days ?? 0
    return counts
  }, [core.data])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-white">Data insights</h1>
      </header>

      <FilterBar
        topics={topics}
        view={view}
        only={only}
        topicCounts={topicCounts}
        onToggleTopic={toggleTopic}
        onView={setView}
        onOnly={setOnly}
        onReset={reset}
      />

      {core.loading ? (
        <Loading label="Loading the insights data…" />
      ) : core.error ? (
        <ErrorState error={core.error} onRetry={core.reload} />
      ) : (
        <section aria-label={`${VIEW_LABEL[view] ?? 'Overview'} view`}>
          {view === 'overview' && (
            <OverviewPanel data={core.data} crew={crewSet} topics={topicSet} only={only} />
          )}
          {view === 'labs' && (
            <LabsPanel data={core.data} crew={crewSet} topics={topicSet} only={only} />
          )}
          {view === 'radiation' && <RadiationPanel data={core.data} topics={topicSet} />}
          {view === 'recommendations' && (
            <RecommendationsPanel
              recommendations={recommendations.data}
              loading={recommendations.loading}
              error={recommendations.error}
              reload={recommendations.reload}
              role={role}
              viewer={viewer}
              crew={crewSet}
              only={only}
            />
          )}
        </section>
      )}

      {core.data?.insights?.disclaimer && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer text-cyan-300 underline decoration-dotted underline-offset-2 hover:text-accent">
            Data notes and disclaimer
          </summary>
          <p className="mt-2 max-w-4xl leading-relaxed">{core.data.insights.disclaimer}</p>
        </details>
      )}
    </div>
  )
}
