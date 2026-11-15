import { useCallback } from 'react'
import { ArrowRight, Gauge, PhoneCall, Radiation } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ROLES, api } from '../api'
import AstronautAvatar from '../components/AstronautAvatar'
import Card from '../components/Card'
import Chip, { OriginChip } from '../components/Chip'
import SourceLinks from '../components/SourceLinks'
import { Empty, ErrorState, Loading } from '../components/StateView'
import { useViewer } from '../context/ViewerContext'
import useFetch from '../hooks/useFetch'

// Big-number status page: a quick "am I OK?" read for the astronaut and the
// clinician. It does not replace the board; it only surfaces the handful of
// indicators that answer the question fastest. Real NASA lab rows and the
// simulated POC vitals keep their own labels and are never mixed in one number.

const LAB_PRIORITY = ['POTASSIUM', 'GLUCOSE', 'HEMOGLOBIN', 'PLATELET COUNT']

const VITAL_PRIORITY = [
  'heart_rate',
  'spo2',
  'temperature_c',
  'sleep_hours',
  'hydration_liters',
  'cortisol_ug_dl',
]

function decimalsFor(value) {
  const number = Number(value)
  return Number.isInteger(number) ? 0 : 1
}

function formatNumber(value, decimals = decimalsFor(value)) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatDay(value) {
  if (!value) return '—'
  const text = String(value).replace('T', ' ')
  return `${text.slice(0, 16)} UTC`
}

function readingKind(band) {
  if (band === 'nominal') return 'nominal'
  if (band === 'watch') return 'watch'
  if (band === 'concern' || band === 'critical') return 'concern'
  return 'neutral'
}

function readingLabel(band) {
  if (band === 'nominal') return 'Nominal'
  if (band === 'watch') return 'Watch'
  if (band === 'concern' || band === 'critical') return 'Concern'
  return 'No band'
}

function labKind(flag) {
  if (flag === 'normal') return 'nominal'
  if (flag === 'high' || flag === 'low') return 'watch'
  return 'neutral'
}

function labLabel(flag) {
  if (flag === 'normal') return 'In range'
  if (flag === 'high') return 'High'
  if (flag === 'low') return 'Low'
  return 'No flag'
}

function firstSentence(text, fallback = '') {
  if (!text) return fallback
  const sentence = String(text).split(/(?<=\.)\s+/)[0]
  return sentence.length > 150 ? `${sentence.slice(0, 147)}…` : sentence
}

function RangeBar({ low, high, value, flag }) {
  const lo = Number(low)
  const hi = Number(high)
  const current = Number(value)
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return null
  const clamp = (n) => Math.min(100, Math.max(0, n))
  const valuePct = clamp(((current - lo) / (hi - lo)) * 100)
  return (
    <div className="mt-3">
      <div className="relative h-2 rounded-full bg-white/10">
        <div className="absolute inset-y-0 rounded-full bg-emerald-500/25" style={{ left: '0%', width: '100%' }} aria-hidden="true" />
        <span
          className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-space ${
            flag === 'normal' || !flag ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
          style={{ left: `calc(${valuePct}% - 6px)` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{formatNumber(lo, 1)}</span>
        <span>reference range</span>
        <span>{formatNumber(hi, 1)}</span>
      </div>
    </div>
  )
}

function Ring({ inRange, total, label = 'NASA labs' }) {
  const pct = total > 0 ? Math.round((inRange / total) * 100) : 0
  const radius = 40
  const circumference = 2 * Math.PI * radius
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="116" height="116" viewBox="0 0 104 104" role="img" aria-label={`${inRange} of ${total} ${label} in range`}>
        <circle cx="52" cy="52" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          stroke="#34d399"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          transform="rotate(-90 52 52)"
        />
        <text x="52" y="49" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="700">
          {pct}%
        </text>
        <text x="52" y="66" textAnchor="middle" fill="#94a3b8" fontSize="9">
          {label}
        </text>
      </svg>
      <p className="text-center text-xs text-slate-300">
        <span className="font-semibold text-white">
          {inRange} of {total}
        </span>{' '}
        lab rows in range
      </p>
    </div>
  )
}

function BigSection({ title, subtitle, action, children }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function Status() {
  const { viewer, role } = useViewer()
  const load = useCallback(async () => {
    const [dashboard, radiation] = await Promise.all([
      api.dashboard({ viewer, role }),
      api.predictRadiation(),
    ])
    return { dashboard, radiation }
  }, [viewer, role])
  const { data, loading, error, reload } = useFetch(load, [viewer, role])

  if (loading) return <Loading label="Reading the crew status…" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const dashboard = data?.dashboard
  const radiation = data?.radiation
  const crew = dashboard?.crew ?? []
  const member = crew.find((item) => item.call_sign === viewer) ?? crew[0] ?? null
  if (!member) return <Empty>The API returned no crew member for {viewer}.</Empty>

  const roleLabel = ROLES.find((item) => item.id === role)?.label ?? role
  const visible = member.visible === 'full'
  const alerts = dashboard?.alerts ?? []
  const readings = member.readings ?? []
  const labs = member.labs ?? []

  const keyLabs = LAB_PRIORITY.map((name) => labs.find((lab) => lab.analyte === name)).filter(Boolean)
  const keyVitals = VITAL_PRIORITY.map((indicator) =>
    readings.find((reading) => reading.indicator === indicator && reading.value != null),
  ).filter(Boolean)

  const labsInRange = labs.filter((lab) => lab.flag === 'normal').length
  const watchSignals =
    labs.filter((lab) => lab.flag && lab.flag !== 'normal').length +
    readings.filter((reading) => reading.value != null && reading.risk_band && reading.risk_band !== 'nominal')
      .length
  const emergency = alerts.some((alert) => alert.tier === 'emergency' || alert.severity === 'critical')
  const overallKind = emergency ? 'concern' : watchSignals > 0 ? 'watch' : 'nominal'
  const overallLabel = emergency ? 'Attention' : watchSignals > 0 ? 'Monitor' : 'Nominal'

  const lastReading = [...readings]
    .filter((reading) => reading.recorded_at)
    .sort((a, b) => String(b.recorded_at).localeCompare(String(a.recorded_at)))[0]
  const lastLab = labPriorityLabel(labs)
  const mission = member.mission ?? dashboard?.group?.name ?? 'Inspiration4 open data'

  const peak = radiation?.peak
  const cumulative30 = (radiation?.cumulative ?? []).find((item) => item.days === 30)
  const nextSep = (radiation?.sep_after_peak ?? [])[0]
  const spikeCount = (radiation?.spikes_at_or_above_rule ?? []).length

  const action = emergency
    ? {
        tone: 'concern',
        title: 'Follow the radiation contingency procedure',
        body: 'A crew-wide emergency notice is active. The CMO and flight surgeon can see the DosTel peak and the SEP evidence.',
        cta: { to: '/dashboard/radiation', label: 'Open the replay' },
      }
    : watchSignals > 0
      ? {
          tone: 'watch',
          title: `${watchSignals} signal${watchSignals === 1 ? '' : 's'} to mention at the next check-in`,
          body: 'There is nothing to treat on this page. Keep the planned monitoring cadence and tell the CMO at the next contact.',
          cta: { to: '/insights', label: 'See the details' },
        }
      : {
          tone: 'nominal',
          title: 'No action needed right now',
          body: 'The released NASA lab rows are inside their printed ranges and the simulated POC vitals are inside their illustrative bands.',
          cta: { to: '/dashboard', label: 'Open the full board' },
        }

  const actionStyles = {
    concern: 'border-red-500/40 bg-red-500/10',
    watch: 'border-amber-500/40 bg-amber-500/10',
    nominal: 'border-emerald-500/30 bg-emerald-500/10',
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-4 self-start xl:sticky xl:top-6">
        <Card className="overflow-hidden">
          <div className="flex flex-col items-center text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">Astronaut profile</p>
            <AstronautAvatar size={92} className="mt-3" />
            <h1 className="mt-3 text-xl font-bold leading-tight text-white">{member.call_sign}</h1>
            <p className="text-sm text-slate-300">{member.full_name}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{member.role_title ?? 'Crew member'}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <Chip kind={overallKind}>{overallLabel}</Chip>
              {emergency && <Chip kind="emergency">Emergency notice</Chip>}
              {!visible && <Chip kind="neutral">Measurements private</Chip>}
            </div>
          </div>

          <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 text-[11px]">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">Mission</dt>
              <dd className="text-right text-slate-200">{mission}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">Viewing as</dt>
              <dd className="text-right text-slate-200">{roleLabel}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">Last lab draw</dt>
              <dd className="text-right text-slate-200">{visible ? lastLab : 'Private'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">Latest POC estimate</dt>
              <dd className="text-right text-slate-200">{visible && lastReading ? formatDay(lastReading.recorded_at) : 'Private'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">Crew-wide alerts</dt>
              <dd className={`text-right ${alerts.length ? 'text-red-200' : 'text-slate-200'}`}>
                {alerts.length ? `${alerts.length} active` : 'None'}
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-2">
            <Link
              to="/dashboard#help-panel"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
            >
              <PhoneCall size={14} aria-hidden="true" />
              Request help
            </Link>
            <Link
              to="/dashboard/radiation"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/20"
            >
              <Radiation size={14} aria-hidden="true" />
              Radiation replay
            </Link>
          </div>
        </Card>

        <Card className="hidden xl:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">How to read this</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Big numbers first: real NASA lab rows keep their printed range and source; simulated POC vitals stay
            marked. For charts, evidence and role detail, open the board.
          </p>
          <Link
            to="/dashboard"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-cyan-200"
          >
            Open the detailed board
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </Card>
      </aside>

      <div className="min-w-0 space-y-6">
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-panel via-panel to-panel2 p-5 shadow-lg shadow-black/20">
          <div className="flex flex-wrap items-center gap-6">
            {visible ? (
              <Ring inRange={labsInRange} total={labs.length} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-xs text-slate-400">
                Vitals and labs are private
                <br />
                in this role.
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">General overview</p>
              <h2 className="mt-1 text-xl font-bold text-white">{overallLabel}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
                {visible
                  ? 'Real NASA lab rows and simulated POC vitals, read in one place. The ring counts released lab rows, not a medical score.'
                  : 'Personal measurements are hidden for this role. Crew-wide notices and the vehicle radiation record stay visible.'}
              </p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">General status</dt>
                  <dd className="mt-1">
                    <Chip kind={overallKind}>{overallLabel}</Chip>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Crew-wide alerts</dt>
                  <dd className={`mt-1 text-sm font-semibold ${alerts.length ? 'text-red-200' : 'text-slate-200'}`}>
                    {alerts.length ? `${alerts.length} active` : 'None'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Last assessment</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-200">
                    {visible && lastReading ? formatDay(lastReading.recorded_at) : 'Private'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className={`mt-5 rounded-xl border p-3 ${actionStyles[action.tone]}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{action.title}</p>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">{action.body}</p>
              </div>
              <Link
                to={action.cta.to}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                {action.cta.label}
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {!visible && (
          <Card title="Measurements are private in this role">
            <Empty>
              Switch to Self, CMO or Flight surgeon in the header to read this crew member&apos;s labs and vitals. The
              vehicle radiation card below stays visible because it is not personal data.
            </Empty>
          </Card>
        )}

        {visible && (
          <BigSection
            title="Real NASA measurements"
            subtitle="The latest released Inspiration4 draw (R+194). Ranges are the ones printed on the NASA rows."
            action={<Chip kind="real">Real NASA · OSDR</Chip>}
          >
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {keyLabs.map((lab) => {
                const decimals = decimalsFor(lab.value)
                const inRange = lab.flag === 'normal'
                return (
                  <li
                    key={lab.analyte}
                    className="flex h-full min-w-0 flex-col rounded-2xl border border-white/10 bg-panel/80 p-4 shadow-lg shadow-black/20"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{lab.analyte}</p>
                    <p className="mt-2 text-3xl font-bold leading-none text-white">
                      {formatNumber(lab.value, decimals)}
                      <span className="ml-1 text-sm font-medium text-slate-400">{lab.unit}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Chip kind={labKind(lab.flag)}>{labLabel(lab.flag)}</Chip>
                      <OriginChip origin={lab.origin} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {lab.source_study} · {lab.timepoint}
                    </p>
                    <RangeBar low={lab.ref_low} high={lab.ref_high} value={lab.value} flag={lab.flag} />
                    <p className="mt-auto pt-2 text-[11px] leading-relaxed text-slate-400">
                      {inRange
                        ? 'No action needed; keep the planned monitoring cadence.'
                        : 'Mention this at the next check-in with the CMO.'}
                    </p>
                  </li>
                )
              })}
            </ul>
          </BigSection>
        )}

        <BigSection
          title="Radiation — vehicle area dose"
          subtitle="Real in-flight DosTel data. Area dose rate from the vehicle monitor, not a personal dose."
          action={<Chip kind="real">Real NASA · RadLab DosTel</Chip>}
        >
          <div className="rounded-2xl border border-white/10 bg-panel/80 p-4 shadow-lg shadow-black/20">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Peak raw sample</p>
                <p className="mt-1 text-3xl font-bold text-white">
                  {peak ? formatNumber(peak.absorbed_dose_rate, 1) : '—'}
                  <span className="ml-1 text-sm font-medium text-slate-400">µGy/h</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {peak ? `${peak.instrument_id} · ${formatDay(peak.recorded_at)}` : 'No peak in the payload'}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">30-day area dose</p>
                <p className="mt-1 text-3xl font-bold text-white">
                  {cumulative30 ? formatNumber(cumulative30.area_dose_ugy, 1) : '—'}
                  <span className="ml-1 text-sm font-medium text-slate-400">µGy</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-400">Flat-rate estimate from the recorded week&apos;s mean rate</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Samples above the app rule</p>
                <p className="mt-1 text-3xl font-bold text-white">
                  {spikeCount}
                  <span className="ml-1 text-sm font-medium text-slate-400">of 12,873</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Rule: {radiation?.spike_threshold_ugy_h ?? 400} µGy/h on the raw ~2-minute samples
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
              <p className="text-[11px] leading-relaxed text-slate-400">
                {nextSep
                  ? `Next DONKI SEP in the file: ${formatDay(nextSep.event_time)} (${nextSep.instruments}).`
                  : 'No SEP after the peak in the file.'}{' '}
                Use the replay to see the rule result at the real crossing.
              </p>
              <Link
                to="/dashboard/radiation"
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-cyan-200"
              >
                Open the replay
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </BigSection>

        {visible && (
          <BigSection
            title="Simulated POC vitals"
            subtitle="Illustrative estimates generated for this prototype. They are not NASA measurements and no action is based on them alone."
            action={<Chip kind="simulated">POC layer</Chip>}
          >
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {keyVitals.map((reading) => (
                <li
                  key={reading.indicator}
                  className="flex h-full min-w-0 flex-col rounded-2xl border border-white/10 bg-panel/80 p-4 shadow-lg shadow-black/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{reading.label}</p>
                    <OriginChip origin={reading.origin} />
                  </div>
                  <p className="mt-2 text-3xl font-bold leading-none text-white">
                    {formatNumber(reading.value, reading.decimals ?? decimalsFor(reading.value))}
                    <span className="ml-1 text-sm font-medium text-slate-400">{reading.unit}</span>
                  </p>
                  <div className="mt-2">
                    <Chip kind={readingKind(reading.risk_band)}>{readingLabel(reading.risk_band)}</Chip>
                  </div>
                  <p className="mt-auto pt-3 text-[11px] leading-relaxed text-slate-400">
                    {firstSentence(reading.guidance, 'Simulated estimate; log it and keep the monitoring cadence.')}
                  </p>
                </li>
              ))}
            </ul>
          </BigSection>
        )}

        <section className="rounded-2xl border border-white/10 bg-panel/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Gauge size={15} className="text-cyan-300" aria-hidden="true" />
            <p className="text-xs text-slate-400">
              Sources: NASA OSDR OSD-569/575/656, NASA RadLab DosTel, DONKI SEP. Simulated vitals are a POC layer, not
              NASA measurements. Not a diagnosis.
            </p>
          </div>
          <SourceLinks
            sources={[
              { id: 'osd_569', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-569/', title: 'OSD-569' },
              { id: 'osd_575', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575', title: 'OSD-575' },
              { id: 'radlab_api', url: 'https://visualization.osdr.nasa.gov/radlab/gui/data-api/', title: 'NASA RadLab data API' },
              { id: 'ochmo_tb_044', url: 'https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf', title: 'OCHMO-TB-044 Medical Operations' },
            ]}
            className="mt-2"
          />
        </section>
      </div>
    </div>
  )
}

function labPriorityLabel(labs) {
  const names = LAB_PRIORITY.map((name) => labs.find((lab) => lab.analyte === name)).filter(Boolean)
  const last = names[0]
  if (!last) return '—'
  return last.timepoint ?? '—'
}
