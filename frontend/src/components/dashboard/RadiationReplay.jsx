import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../../api'
import { useViewer } from '../../context/ViewerContext'
import Card from '../Card'
import Chip from '../Chip'
import SourceLinks from '../SourceLinks'
import { ErrorState, Loading } from '../StateView'

// Replay of the recorded ISS DosTel week (real in-flight data).
//
// The rule threshold (400 µGy/h) applies to the raw ~2-minute samples, not to the
// hourly mean. The chart therefore plots both series: the thin line is the hourly
// mean (context) and the thick line is the hourly maximum, which is the series
// that actually crosses the rule. At every recorded spike the component asks the
// API for the rule answer at that hour; the alert is the API's role-projected
// answer, never a UI invention.

const SPEEDS = [
  { label: '1×', ms: 140 },
  { label: '2×', ms: 70 },
  { label: '4×', ms: 35 },
]
const UNIT = 'µGy/h'
const MEAN_COLOR = '#64748b'
const PEAK_COLOR = '#00e5ff'
const WINDOW_HOURS = 36
const CLINICAL_ROLES = new Set(['cmo', 'flight_surgeon'])
const EMPTY = []

function formatHour(value) {
  if (!value) return '—'
  return `${String(value).slice(0, 10)} ${String(value).slice(11, 16)} UTC`
}

function hourEnd(hour) {
  return `${String(hour).slice(0, 13)}:59:59Z`
}

function ClinicalAlert({ alert }) {
  const evidence = alert.evidence ?? {}
  const peak = Number(evidence.absorbed_dose_rate)
  return (
    <section className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip kind="emergency">Emergency</Chip>
        <Chip kind="real">Real NASA</Chip>
        {alert.severity && <Chip kind="neutral">{alert.severity}</Chip>}
      </div>
      <h2 className="mt-2 text-base font-semibold text-white">
        Radiation exposure alert — peak {Number.isFinite(peak) ? peak.toFixed(1) : '—'} {UNIT}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-red-100">{alert.detail}</p>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-red-200/70">Peak dose rate</dt>
          <dd className="text-white">
            {Number.isFinite(peak) ? peak.toFixed(2) : '—'} {UNIT} ({evidence.instrument_id ?? '—'})
          </dd>
        </div>
        <div>
          <dt className="text-red-200/70">Recorded</dt>
          <dd className="text-white">{formatHour(evidence.recorded_at)}</dd>
        </div>
        <div>
          <dt className="text-red-200/70">Next SEP</dt>
          <dd className="text-white">{formatHour(evidence.sep_time)}</dd>
        </div>
        <div>
          <dt className="text-red-200/70">Hours after the peak</dt>
          <dd className="text-white">{evidence.hours_after_peak ?? '—'} h</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs leading-relaxed text-red-200/80">{alert.suggested_action}</p>
      <SourceLinks sources={alert.sources} className="mt-2" />
      <p className="mt-1 text-[11px] text-red-200/60">
        Area dose rate from the vehicle monitor, not a personal dose. Not a diagnosis.
      </p>
    </section>
  )
}

function GenericAlert({ alert }) {
  return (
    <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip kind="emergency">Emergency · crew broadcast</Chip>
        <Chip kind="real">Real NASA</Chip>
      </div>
      <h2 className="mt-2 text-base font-semibold text-white">{alert.title ?? alert.public_title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-red-100">{alert.detail ?? alert.public_detail}</p>
      <p className="mt-2 text-xs text-red-200/80">{alert.suggested_action ?? 'Follow procedures.'}</p>
      <SourceLinks sources={alert.sources} className="mt-2" />
      <p className="mt-1 text-[11px] text-red-200/60">
        The crew notice does not include numbers. The CMO and the flight surgeon see the details.
      </p>
    </section>
  )
}

export default function RadiationReplay({ onAlertChange }) {
  const { viewer, role } = useViewer()
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(SPEEDS[1])
  const [alertPayload, setAlertPayload] = useState(null)
  const [alertError, setAlertError] = useState('')
  const [alertIndex, setAlertIndex] = useState(null)
  const cache = useRef(new Map())
  const timer = useRef(null)

  const load = useCallback(async () => {
    try {
      const payload = await api.predictRadiation()
      const peaks = payload.history.max ?? payload.history.y
      const points = payload.history.x.map((hour, i) => ({
        hour,
        mean: payload.history.y[i],
        peak: peaks[i],
      }))
      const spikeHours = Array.from(
        new Set((payload.spikes_at_or_above_rule ?? []).map((spike) => String(spike.recorded_at).slice(0, 13))),
      )
      // Prefetch the rule answer for every recorded spike hour so the alert card
      // appears at the right frame without a network round-trip mid-playback.
      const answers = await Promise.all(
        spikeHours.map((hour) => api.radiationAlert({ at: hourEnd(hour), viewer, role }).catch(() => null)),
      )
      let firstAlertHour = null
      spikeHours.forEach((hour, i) => {
        const answer = answers[i]
        cache.current.set(`${hour}|${role}|${viewer}`, answer)
        if (firstAlertHour === null && answer?.alert) firstAlertHour = hour
      })
      const firstIndex = firstAlertHour
        ? points.findIndex((point) => String(point.hour).slice(0, 13) === firstAlertHour)
        : null
      setAlertIndex(firstIndex >= 0 ? firstIndex : null)
      setHistory({
        points,
        threshold: payload.spike_threshold_ugy_h ?? 400,
        spikeHours,
        spikes: payload.spikes_at_or_above_rule?.length ?? 0,
        startIndex: firstIndex >= 0 ? Math.max(0, firstIndex - 24) : 0,
      })
      // Start 12 hours before the first rule result so pressing Play reaches the
      // alert quickly instead of showing a long quiet stretch.
      setIndex(firstIndex >= 0 ? Math.max(0, firstIndex - 24) : 0)
      setError('')
    } catch (err) {
      setError(err.message || 'The replay could not load.')
    }
  }, [role, viewer])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- first load runs on mount
    load()
  }, [load])

  const points = history?.points ?? EMPTY
  const threshold = history?.threshold ?? 400
  const current = points[Math.min(index, Math.max(points.length - 1, 0))]
  const currentHour = current?.hour ?? null
  const visible = useMemo(() => {
    const end = Math.min(index + 1, points.length)
    const start = Math.max(0, end - WINDOW_HOURS)
    return points.slice(start, end)
  }, [points, index])
  const yMax = useMemo(() => {
    const highest = points.reduce((best, point) => Math.max(best, Number(point.peak) || 0), threshold)
    return Math.ceil((highest * 1.1) / 100) * 100
  }, [points, threshold])
  const checked = alertPayload !== null
  const alert = alertPayload?.alert ?? null

  useEffect(() => {
    if (!currentHour) return
    const cached = cache.current.get(`${String(currentHour).slice(0, 13)}|${role}|${viewer}`)
    // oxlint-disable-next-line react/set-state-in-effect -- align the alert card with the replay frame
    if (cached !== undefined) {
      setAlertPayload(cached)
      if (cached?.alert) setPlaying(false)
    }
  }, [currentHour, role, viewer])

  useEffect(() => {
    if (onAlertChange) onAlertChange(Boolean(alert))
  }, [alert, onAlertChange])

  useEffect(() => {
    if (!playing || points.length === 0) return undefined
    timer.current = setInterval(() => {
      setIndex((value) => {
        if (value >= points.length - 1) {
          setPlaying(false)
          return value
        }
        return value + 1
      })
    }, speed.ms)
    return () => clearInterval(timer.current)
  }, [playing, points.length, speed])

  function reset() {
    setPlaying(false)
    setIndex(history?.startIndex ?? 0)
    setAlertPayload(null)
    setAlertError('')
  }

  function jumpToAlert() {
    if (alertIndex == null) return
    setPlaying(false)
    setIndex(alertIndex)
  }

  if (error) return <ErrorState error={error} onRetry={load} />
  if (!history) return <Loading label="Loading the recorded DosTel week…" />

  const progress = points.length > 1 ? Math.round((index / (points.length - 1)) * 100) : 0
  const clinical = CLINICAL_ROLES.has(role)
  const visibleSpikes = visible.filter((point) => Number(point.peak) >= threshold)

  return (
    <Card
      title="Replay the recorded DosTel week"
      subtitle="Real in-flight data. The thick line is the hourly peak of the raw ~2-minute samples — the series the rule actually checks."
      action={<Chip kind="real">Real NASA · RadLab DosTel</Chip>}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black"
        >
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200"
        >
          <RotateCcw size={13} aria-hidden="true" />
          Reset
        </button>
        {alertIndex != null && (
          <button
            type="button"
            onClick={jumpToAlert}
            className="inline-flex items-center gap-1 rounded-lg border border-accent/60 bg-accent/20 px-3 py-1.5 text-xs font-semibold text-accent"
          >
            <SkipForward size={13} aria-hidden="true" />
            Jump to the alert
          </button>
        )}
        <div className="flex items-center gap-1" role="group" aria-label="Replay speed">
          {SPEEDS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setSpeed(option)}
              aria-pressed={speed.label === option.label}
              className={`rounded-lg border px-2 py-1 text-[11px] ${
                speed.label === option.label
                  ? 'border-accent/60 bg-accent/10 text-accent'
                  : 'border-white/10 text-slate-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="ml-auto text-xs text-slate-400" aria-live="polite">
          {formatHour(currentHour)} · {index + 1}/{points.length}
        </p>
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-white/10" aria-hidden="true">
        <div className="h-1.5 rounded-full bg-accent transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-3 w-full" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visible} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(value) => String(value).slice(5)}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, yMax]}
              width={44}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              label={{ value: UNIT, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
            />
            <Tooltip
              formatter={(value, name) => [`${Number(value).toFixed(2)} ${UNIT}`, name]}
              labelFormatter={(value) => formatHour(value)}
              contentStyle={{ background: '#101323', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12 }}
            />
            <ReferenceLine
              y={threshold}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: `app rule ${threshold} ${UNIT} (raw samples)`, position: 'insideTopRight', fill: '#fca5a5', fontSize: 10 }}
            />
            <Line type="monotone" dataKey="mean" name="Hourly mean" stroke={MEAN_COLOR} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="peak" name="Hourly peak (raw 2-min sample)" stroke={PEAK_COLOR} strokeWidth={2.2} dot={false} isAnimationActive={false} />
            {visibleSpikes.map((point) => (
              <ReferenceDot
                key={point.hour}
                x={point.hour}
                y={Number(point.peak)}
                r={4}
                fill="#ef4444"
                stroke="#0b1020"
                strokeWidth={1}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: PEAK_COLOR }} aria-hidden="true" />
          Hourly peak (raw 2-min sample) — the rule checks this
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: MEAN_COLOR }} aria-hidden="true" />
          Hourly mean (context)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-red-400" aria-hidden="true" />
          App rule {threshold} {UNIT}
        </li>
      </ul>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        Recorded replay of the June 2024 DosTel week. {history.spikes} raw samples in the file are at or above the
        rule. The line jumps when the peak crosses it; the alert only fires when a real SEP is inside the 96-hour
        window. Area dose rate, not a personal dose. Not live telemetry.
      </p>

      <div aria-live="polite" className="mt-3 space-y-2">
        {alertError && (
          <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
            {alertError}
          </p>
        )}
        {checked && !alert && (
          <p className="rounded-lg border border-white/15 bg-white/[0.03] p-2 text-xs text-slate-300">
            This hour crossed the rule, but no real SEP is inside the 96-hour window — logged, no crew broadcast.
          </p>
        )}
        {alert && (
          <div data-testid="replay-alert">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
              Rule result at {formatHour(alert.evidence?.recorded_at ?? alertPayload?.at ?? currentHour)}
              {clinical ? ' — clinical view (CMO / flight surgeon)' : ' — crew notice (no numbers)'}
            </p>
            {clinical ? <ClinicalAlert alert={alert} /> : <GenericAlert alert={alert} />}
          </div>
        )}
      </div>
    </Card>
  )
}
