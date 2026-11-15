import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { api, ROLES } from '../api'
import Chip from '../components/Chip'
import { Empty, ErrorState, Loading } from '../components/StateView'
import AlertCard from '../components/dashboard/AlertCard'
import AstronautBody from '../components/dashboard/AstronautBody'
import Callout from '../components/dashboard/Callout'
import HelpDrawer from '../components/dashboard/HelpDrawer'
import LabsSummary from '../components/dashboard/LabsSummary'
import SystemCards from '../components/dashboard/SystemCards'
import { useViewer } from '../context/ViewerContext'
import useFetch from '../hooks/useFetch'

// Overview for the station display: the hero is the command center (interactive
// astronaut body map, status, help and the next action), then alerts, the four
// system cards and the lab summary. Everything else lives one tap away.

function firstSentence(text, fallback = '') {
  if (!text) return fallback
  const sentence = String(text).split(/(?<=\.)\s+/)[0]
  return sentence.length > 140 ? `${sentence.slice(0, 137)}…` : sentence
}

function NextAction({ recommendations }) {
  const next = recommendations.find((item) => !item.broadcast && item.tier !== 'emergency')
  return (
    <div className="w-full rounded-xl border border-accent/25 bg-accent/5 p-4 xl:w-80">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Next action</p>
      {next ? (
        <>
          <p className="mt-1 text-sm font-semibold leading-snug text-white">{next.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            {firstSentence(next.what_to_do ?? next.detail ?? next.suggested_action)}
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm font-semibold leading-snug text-white">No preventive actions for this role</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Switch to the CMO or flight surgeon in the header for clinical detail.
          </p>
        </>
      )}
      <Link
        to="/insights"
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-cyan-200"
      >
        All recommendations
        <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </div>
  )
}

export default function Dashboard() {
  const { viewer, role } = useViewer()
  const [helpOpen, setHelpOpen] = useState(false)

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
  const statusKind =
    member.overall_band === 'watch' ? 'watch' : member.overall_band === 'concern' ? 'concern' : 'nominal'

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-panel via-panel to-panel2 p-5 shadow-lg shadow-black/20">
        <div className="flex flex-wrap items-start gap-6 xl:flex-nowrap">
          <AstronautBody regions={dashboard?.body} />

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Crew overview · {dashboard?.group?.name ?? 'Inspiration4 open data'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white">
                {member.call_sign} · {member.full_name}
              </h1>
              {visible ? (
                <Chip kind={statusKind} size="lg">
                  {member.overall_band ?? 'No band'}
                </Chip>
              ) : (
                <Chip kind="neutral" size="lg">
                  Private
                </Chip>
              )}
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

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
              >
                Request help
              </button>
              <Link
                to="/dashboard/radiation"
                className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20"
              >
                Radiation replay
              </Link>
              <Link
                to="/insights"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
              >
                Data insights
              </Link>
            </div>
          </div>

          <NextAction recommendations={data?.recommendations ?? []} />
        </div>
      </section>

      <nav aria-label="On this page" className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-panel/60 px-3 py-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Jump to</span>
        <a href="#alerts" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200">
          Alerts
        </a>
        <a href="#systems" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200">
          Systems
        </a>
        <a href="#labs" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200">
          Labs
        </a>
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

      <div id="labs" className="scroll-mt-24">
        <LabsSummary labs={member.labs} role={role} />
      </div>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
