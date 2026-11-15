import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../api'
import { useViewer } from '../../context/ViewerContext'
import Card from '../Card'
import Chip from '../Chip'
import AlertCard from './AlertCard'
import { ErrorState, Loading } from '../StateView'

// Replay of the recorded ISS DosTel week (real in-flight data). The chart draws
// one hour per tick; whenever the recorded hourly mean crosses the app rule the
// component asks the API whether the pairing with a real SEP would have fired.
// The alert rendered is the API's role-projected answer, not a UI invention.

const SPEEDS = [
  { label: '1×', ms: 160 },
  { label: '2×', ms: 80 },
  { label: '4×', ms: 40 },
]

const UNIT = 'µGy/h'
const COLOR = '#00e5ff'
const EMPTY = []

function formatHour(value) {
  if (!value) return '—'
  return `${String(value).slice(0, 10)} ${String(value).slice(11, 16)} UTC`
}

export default function RadiationReplay() {
  const { viewer, role } = useViewer()
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(SPEEDS[0])
  const [alertPayload, setAlertPayload] = useState(null)
  const [alertError, setAlertError] = useState('')
  const cache = useRef(new Map())
  const timer = useRef(null)

  const load = useCallback(async () => {
    try {
      const payload = await api.predictRadiation()
      const spikesByHour = new Map()
      for (const spike of payload.spikes_at_or_above_rule ?? []) {
        const hour = String(spike.recorded_at).slice(0, 13)
        const current = spikesByHour.get(hour) ?? 0
        spikesByHour.set(hour, Math.max(current, Number(spike.rate) || 0))
      }
      setHistory({
        points: payload.history.x.map((hour, i) => ({
          hour,
          rate: payload.history.y[i],
          spike: spikesByHour.get(String(hour).slice(0, 13)) ?? null,
        })),
        threshold: payload.spike_threshold_ugy_h ?? 400,
        spikes: payload.spikes_at_or_above_rule?.length ?? 0,
      })
      setError('')
    } catch (err) {
      setError(err.message || 'The replay could not load.')
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- first load runs on mount
    load()
  }, [load])

  const points = history?.points ?? EMPTY
  const threshold = history?.threshold ?? 400
  const current = points[Math.min(index, Math.max(points.length - 1, 0))]
  const currentHour = current?.hour ?? null
  const visible = useMemo(() => points.slice(0, Math.min(index + 1, points.length)), [points, index])
  const crossed = Boolean(current && (current.rate >= threshold || current.spike != null))
  const checked = alertPayload !== null

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

  // Ask the API only when the recorded value crosses the rule (cached per hour).
  useEffect(() => {
    if (!crossed || !currentHour || alertPayload?.alert) return
    const key = `${currentHour}|${role}|${viewer}`
    if (cache.current.has(key)) {
      setAlertPayload(cache.current.get(key))
      return
    }
    api
      .radiationAlert({ at: `${String(currentHour).slice(0, 13)}:59:59Z`, viewer, role })
      .then((payload) => {
        cache.current.set(key, payload)
        setAlertPayload(payload)
        setAlertError('')
        if (payload.alert) setPlaying(false)
      })
      .catch((err) => {
        setAlertError(err.message || 'The rule check failed.')
      })
  }, [crossed, currentHour, role, viewer, alertPayload])

  function reset() {
    setPlaying(false)
    setIndex(0)
    setAlertPayload(null)
    setAlertError('')
  }

  if (error) return <ErrorState error={error} onRetry={load} />
  if (!history) return <Loading label="Loading the recorded DosTel week…" />

  const alert = alertPayload?.alert ?? null
  const progress = points.length > 1 ? Math.round((index / (points.length - 1)) * 100) : 0

  return (
    <Card
      title="Replay the recorded DosTel week"
      subtitle="Real in-flight data, hour by hour. The rule check runs on the API at every crossing."
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
          {formatHour(current?.hour)} · {index + 1}/{points.length}
        </p>
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-white/10" aria-hidden="true">
        <div className="h-1.5 rounded-full bg-accent transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-3 w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visible} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <XAxis dataKey="hour" hide />
            <YAxis
              width={44}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(value) => Number(value).toFixed(0)}
              label={{ value: UNIT, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
            />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(2)} ${UNIT}`, 'Hourly mean']}
              labelFormatter={(value) => formatHour(value)}
              contentStyle={{ background: '#101323', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12 }}
            />
            <ReferenceLine
              y={threshold}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: `app rule ${threshold}`, position: 'insideTopRight', fill: '#fca5a5', fontSize: 10 }}
            />
            <Line type="monotone" dataKey="rate" stroke={COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="spike"
              stroke="#ef4444"
              strokeWidth={0}
              dot={{ r: 4, fill: '#ef4444', stroke: '#ef4444' }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        Recorded replay of the June 2024 DosTel week: the line is the hourly mean, the red dots are
        the raw ~2-minute samples above the app rule ({history.spikes} in the file). Area dose rate, not a
        personal dose. Not live telemetry.
      </p>

      <div aria-live="polite" className="mt-3 space-y-2">
        {alertError && (
          <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
            {alertError}
          </p>
        )}
        {crossed && !checked && !alertError && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100">
            A recorded sample above the app rule exists in this hour. Checking the real solar-particle
            window…
          </p>
        )}
        {crossed && checked && !alert && !alertError && (
          <p className="rounded-lg border border-white/15 bg-white/[0.03] p-2 text-xs text-slate-300">
            Rate above the app rule at this hour, but no real SEP inside the 96-hour window — logged, no crew
            broadcast.
          </p>
        )}
        {alert && (
          <div data-testid="replay-alert">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
              Rule result at {formatHour(alert?.evidence?.recorded_at ?? alertPayload?.at ?? currentHour)}
            </p>
            <AlertCard alert={alert} />
          </div>
        )}
      </div>
    </Card>
  )
}
