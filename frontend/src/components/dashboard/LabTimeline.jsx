import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../api'
import Card from '../Card'
import Chip from '../Chip'
import SourceLinks from '../SourceLinks'
import { ErrorState, Loading } from '../StateView'
import useFetch from '../../hooks/useFetch'

// Step-through animation of the real Inspiration4 lab draws. This is a recorded
// series, not a live signal: each step shows one NASA draw for the four crew
// members. The line joins recorded visits and no interpolation is implied.

const ANALYTES = [
  {
    value: 'GLUCOSE',
    label: 'Blood sugar (glucose)',
    study: 'OSD-575',
    source: { id: 'osd_575', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575', title: 'NASA OSDR OSD-575' },
  },
  {
    value: 'POTASSIUM',
    label: 'Potassium',
    study: 'OSD-575',
    source: { id: 'osd_575', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575', title: 'NASA OSDR OSD-575' },
  },
  {
    value: 'HEMOGLOBIN',
    label: 'Hemoglobin',
    study: 'OSD-569',
    source: { id: 'osd_569', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-569/', title: 'NASA OSDR OSD-569' },
  },
]

const COLORS = ['#00e5ff', '#a78bfa', '#fbbf24', '#34d399']
const EMPTY = []
const STEP_MS = 950

export default function LabTimeline() {
  const [analyte, setAnalyte] = useState(ANALYTES[0].value)
  const [index, setIndex] = useState(1)
  const [playing, setPlaying] = useState(false)

  const selected = ANALYTES.find((item) => item.value === analyte) ?? ANALYTES[0]
  const load = useCallback(() => api.edaTrends(analyte), [analyte])
  const { data, loading, error, reload } = useFetch(load, [analyte])

  const timepoints = data?.timepoints ?? EMPTY
  const traces = data?.traces ?? EMPTY
  const maxIndex = Math.max(timepoints.length, 1)

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- reset the replay when the analyte changes
    setIndex(1)
    setPlaying(false)
  }, [analyte])

  useEffect(() => {
    if (!playing || timepoints.length === 0) return undefined
    const timer = setInterval(() => {
      setIndex((value) => {
        if (value >= maxIndex) {
          setPlaying(false)
          return value
        }
        return value + 1
      })
    }, STEP_MS)
    return () => clearInterval(timer)
  }, [playing, maxIndex, timepoints.length])

  const chartData = useMemo(() => {
    if (timepoints.length === 0) return []
    return timepoints.slice(0, Math.min(index, timepoints.length)).map((timepoint, i) => {
      const row = { timepoint }
      for (const trace of traces) row[trace.name] = trace.y?.[i] ?? null
      return row
    })
  }, [timepoints, traces, index])

  const refIndex = Math.min(index, timepoints.length) - 1
  const refLow = traces[0]?.ref_low?.[refIndex]
  const refHigh = traces[0]?.ref_high?.[refIndex]
  const currentLabel = timepoints[Math.min(index, timepoints.length) - 1] ?? '—'
  const unit = data?.unit ?? ''

  if (loading) return <Loading label="Loading the recorded draws…" />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (timepoints.length === 0) {
    return (
      <Card title="Timeline of recorded draws">
        <p className="text-sm text-slate-400">The API returned no draws for this indicator.</p>
      </Card>
    )
  }

  return (
    <Card
      title="Timeline of recorded draws"
      action={
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip kind="real">Real NASA · {selected.study}</Chip>
        </div>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[11px] uppercase tracking-wide text-slate-400">
          Indicator
          <select
            value={analyte}
            onChange={(event) => setAnalyte(event.target.value)}
            className="mt-1 block rounded-lg border border-white/10 bg-panel px-2 py-1.5 text-sm text-white"
          >
            {ANALYTES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
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
            onClick={() => {
              setPlaying(false)
              setIndex(1)
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200"
          >
            <RotateCcw size={13} aria-hidden="true" />
            Reset
          </button>
          <p className="text-xs text-slate-400" aria-live="polite">
            Draw {Math.min(index, timepoints.length)} of {timepoints.length} · {currentLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 w-full" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <XAxis dataKey="timepoint" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis
              width={44}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(value) => Number(value).toFixed(0)}
              label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
            />
            <Tooltip
              formatter={(value, name) => [`${value} ${unit}`, name]}
              contentStyle={{ background: '#101323', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12 }}
            />
            {typeof refLow === 'number' && (
              <ReferenceLine y={refLow} stroke="#64748b" strokeDasharray="3 3" />
            )}
            {typeof refHigh === 'number' && (
              <ReferenceLine y={refHigh} stroke="#64748b" strokeDasharray="3 3" />
            )}
            {traces.map((trace, i) => (
              <Line
                key={trace.name}
                type="monotone"
                dataKey={trace.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        {traces.length} crew traces, {timepoints.length} recorded visits from L-92 to R+194. Dashed lines are the
        reference range printed on the NASA rows. This is a recorded series, not a live signal.
      </p>
      <SourceLinks sources={[selected.source]} className="mt-2" />
    </Card>
  )
}
