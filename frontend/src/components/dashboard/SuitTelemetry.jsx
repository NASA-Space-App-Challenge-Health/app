import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, Play, Square } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { api } from '../../api'
import Card from '../Card'
import Chip, { OriginChip } from '../Chip'

// Polls the simulated xEMU generator, stores each sample in Postgres and shows
// the last samples. The idea and generator come from Alisson's telemetry
// endpoints; the CO2 limit and all data are labelled as simulated.

const POLL_MS = 5000

export default function SuitTelemetry({ crew }) {
  const [samples, setSamples] = useState([])
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)

  const load = useCallback(async () => {
    try {
      const payload = await api.suitHistory({ crew, limit: 20 })
      setSamples(payload.samples ?? [])
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load the stored samples.')
    }
  }, [crew])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- load stored samples on mount
    load()
  }, [load])

  const pollOne = useCallback(async () => {
    setBusy(true)
    try {
      await api.suitSensor({ crew })
      await load()
      setError('')
    } catch (err) {
      setError(err.message || 'Could not poll the suit sensors.')
    } finally {
      setBusy(false)
    }
  }, [crew, load])

  useEffect(() => {
    if (!polling) return undefined
    // oxlint-disable-next-line react/set-state-in-effect -- first poll starts immediately
    pollOne()
    timer.current = setInterval(pollOne, POLL_MS)
    return () => clearInterval(timer.current)
  }, [polling, pollOne])

  const latest = samples[samples.length - 1]
  const chart = samples.map((sample) => ({
    time: String(sample.recorded_at).slice(11, 19),
    hr: sample.heart_rate_bpm,
  }))

  return (
    <Card
      title="Suit telemetry"
      action={<OriginChip origin="simulated" />}
      className="min-w-0"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPolling((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-black"
        >
          {polling ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {polling ? 'Stop polling' : 'Start polling'}
        </button>
        <button
          type="button"
          onClick={pollOne}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
        >
          <Activity size={14} aria-hidden="true" />
          Poll one sample
        </button>
        <span className="text-xs text-slate-500">
          {samples.length} stored {samples.length === 1 ? 'sample' : 'samples'}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
          {error}
        </p>
      )}

      {latest && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Heart rate</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {Math.round(latest.heart_rate_bpm)}
              <span className="ml-1 text-xs font-normal text-slate-400">bpm</span>
            </p>
            <Chip kind={latest.heart_rate_emergency ? 'emergency' : 'nominal'}>
              {latest.heart_rate_emergency ? 'Outside app window' : 'Inside app window'}
            </Chip>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Oxygen</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {Math.round(latest.spo2_percent)}
              <span className="ml-1 text-xs font-normal text-slate-400">%</span>
            </p>
            <Chip kind="nominal">Simulated</Chip>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Cabin CO₂</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {Number(latest.co2_mmhg).toFixed(2)}
              <span className="ml-1 text-xs font-normal text-slate-400">mmHg</span>
            </p>
            <Chip kind={latest.co2_above_habitat_limit ? 'watch' : 'nominal'}>
              {latest.co2_above_habitat_limit ? 'Above 3 mmHg' : 'Below 3 mmHg'}
            </Chip>
          </div>
        </div>
      )}

      {chart.length > 0 ? (
        <div className="mt-4 h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={[40, 180]} width={36} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Line type="monotone" dataKey="hr" stroke="#00e5ff" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500">No stored samples yet. Start polling to add one.</p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Simulated xEMU samples stored in Postgres. CO₂ limit is 3 mmHg (NASA-STD-3001 / OCHMO-TB-004). Not NASA
        measurements and not a diagnosis.
      </p>
    </Card>
  )
}
