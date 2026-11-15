import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, PlayCircle } from 'lucide-react'
import { api, ROLES } from '../api'
import Chip from '../components/Chip'
import { Empty, ErrorState, Loading } from '../components/StateView'
import AlertCard from '../components/dashboard/AlertCard'
import AstronautAvatar from '../components/AstronautAvatar'
import BodyMap from '../components/dashboard/BodyMap'
import Callout from '../components/dashboard/Callout'
import HelpPanel from '../components/dashboard/HelpPanel'
import LabsSummary from '../components/dashboard/LabsSummary'
import RecommendationPreview from '../components/dashboard/RecommendationPreview'
import SystemCards from '../components/dashboard/SystemCards'
import { useViewer } from '../context/ViewerContext'
import useFetch from '../hooks/useFetch'

// Overview board. The viewer and role live in the URL, so every click here
// re-reads the same filtered payload the rest of the app sees. Recommendations
// come from the dedicated endpoint because the dashboard payload carries the
// short alert form while this preview needs what_to_do and a confidence chip.
export default function Dashboard() {
  const { viewer, role } = useViewer()

  const load = useCallback(async () => {
    const [dashboard, recommendationPayload, radiation] = await Promise.all([
      api.dashboard({ viewer, role }),
      api.recommendations({ crew: viewer, role, viewer }).catch(() => null),
      api.predictRadiation().catch(() => null),
    ])
    return {
      dashboard,
      radiation,
      recommendations: recommendationPayload?.recommendations ?? dashboard?.recommendations ?? [],
    }
  }, [viewer, role])

  const { data, loading, error, reload } = useFetch(load, [viewer, role])

  if (loading) return <Loading label="Loading the crew board from the API…" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const dashboard = data?.dashboard
  const crew = Array.isArray(dashboard?.crew) ? dashboard.crew : []
  const member = crew.find((item) => item.call_sign === viewer) ?? crew[0] ?? null
  if (!member) {
    return (
      <Empty>The API returned no crew member for {viewer}. Check that the API is running and try again.</Empty>
    )
  }

  const visible = member.visible === 'full'
  const roleLabel = ROLES.find((item) => item.id === role)?.label ?? role
  const alerts = Array.isArray(dashboard?.alerts) ? dashboard.alerts : []
  const lastLab = member.labs?.[0]?.timepoint ?? '—'
  const lastPocReading = [...(member.readings ?? [])]
    .filter((reading) => reading.recorded_at)
    .sort((left, right) => String(right.recorded_at).localeCompare(String(left.recorded_at)))[0]
  const lastPoc = lastPocReading?.recorded_at
    ? `${String(lastPocReading.recorded_at).replace('T', ' ').slice(0, 16)} UTC`
    : '—'

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-panel via-panel to-panel2 p-5 shadow-lg shadow-black/20">
        <div className="flex flex-wrap items-center gap-5">
          <AstronautAvatar size={92} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Crew overview · {dashboard?.group?.name ?? 'Inspiration4 open data'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white">
                {member.call_sign} · {member.full_name}
              </h1>
              {visible ? (
                <Chip
                  kind={
                    member.overall_band === 'watch'
                      ? 'watch'
                      : member.overall_band === 'concern' || member.overall_band === 'critical'
                        ? 'concern'
                        : 'nominal'
                  }
                  size="lg"
                >
                  {member.overall_band ?? 'No band'}
                </Chip>
              ) : (
                <Chip kind="neutral" size="lg">
                  Private
                </Chip>
              )}
              {member.is_cmo && <Chip kind="real">CMO</Chip>}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {member.role_title ?? 'Crew member'} · viewing as {roleLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Last lab draw {lastLab} · Last POC update {lastPoc}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Data composition">
              <Chip kind="real">Real NASA data</Chip>
              <Chip kind="simulated">Simulated vitals</Chip>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard/radiation"
              className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/20"
            >
              Radiation replay
            </Link>
            <Link
              to="/insights"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
            >
              Data insights
            </Link>
            <a
              href="#help-panel"
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
            >
              Request help
            </a>
          </div>
        </div>
      </section>

      <nav aria-label="On this page" className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-panel/60 px-3 py-2 text-[11px]">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Jump to</span>
        {[
          ['#alerts', 'Alerts'],
          ['#systems', 'Systems'],
          ['#help-panel', 'Help'],
          ['#labs', 'Labs'],
          ['#body-map', 'Body map'],
          ['#recommendations', 'Recommendations'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200">
            {label}
          </a>
        ))}
      </nav>

      {!visible && (
        <Callout tone="warn">
          Role {roleLabel}: this crew member&apos;s vitals and labs are hidden. Crew-wide notices stay visible.
        </Callout>
      )}

      <div id="alerts" className="scroll-mt-24 space-y-4">
        {alerts.map((alert) => (
          <AlertCard key={alert.id ?? alert.title} alert={alert} />
        ))}
      </div>

      <div id="systems" className="scroll-mt-24">
        <SystemCards member={member} radiation={data?.radiation} visible={visible} />
      </div>

      <div id="help-panel" className="scroll-mt-24">
        <HelpPanel />
      </div>

      <div id="labs" className="scroll-mt-24">
        <LabsSummary labs={member.labs} role={role} />
      </div>

      <div id="body-map" className="grid scroll-mt-24 items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <BodyMap
            body={dashboard?.body}
            title="Body map"
            subtitle="Plain-language effects and prevention from CSA, HRP, and OCHMO. Only watch regions keep a status chip here; open a region for the detail."
            compact
          />
        </div>
        <div className="flex flex-col gap-6">
          <section className="mt-auto rounded-2xl border border-accent/30 bg-accent/5 p-5">
            <h2 className="text-base font-semibold text-white">See the privacy and radiation story</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-400">
              Four guided steps through the role rules and the real DosTel and DONKI records.
            </p>
            <Link
              to="/demo"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-cyan-300"
            >
              <PlayCircle size={16} aria-hidden="true" />
              Open guided demo
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>

      <div id="recommendations" className="scroll-mt-24">
        <RecommendationPreview recommendations={data?.recommendations} />
      </div>
    </div>
  )
}
