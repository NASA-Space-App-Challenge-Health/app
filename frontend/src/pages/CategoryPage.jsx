import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bone, Brain, HeartPulse, Radiation } from 'lucide-react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api'
import Card from '../components/Card'
import Chip from '../components/Chip'
import SourceLinks from '../components/SourceLinks'
import { Empty, ErrorState, Loading } from '../components/StateView'
import { AXIS_PROPS, CREW_COLORS, FALLBACK_COLORS, GRID_PROPS, LEGEND_PROPS } from '../components/dashboard/chartTheme'
import AlertCard from '../components/dashboard/AlertCard'
import BodyMap from '../components/dashboard/BodyMap'
import Callout from '../components/dashboard/Callout'
import CategoryHeader from '../components/dashboard/CategoryHeader'
import ChartFrame from '../components/dashboard/ChartFrame'
import ChartTooltip from '../components/dashboard/ChartTooltip'
import LabTimeline from '../components/dashboard/LabTimeline'
import LabsTable from '../components/dashboard/LabsTable'
import PrivacyNote from '../components/dashboard/PrivacyNote'
import RadiationReplay from '../components/dashboard/RadiationReplay'
import StatGrid from '../components/dashboard/StatGrid'
import VitalsGrid from '../components/dashboard/VitalsGrid'
import {
  flagKind,
  flagLabel,
  formatDay,
  formatMeasurement,
  formatNumber,
  formatPercent,
  formatRange,
  formatTimestamp,
  safeArray,
} from '../components/dashboard/format'
import { useViewer } from '../context/ViewerContext'
import useFetch from '../hooks/useFetch'

const HEART_LAB_ANALYTES = ['HEMOGLOBIN', 'WHITE BLOOD CELL COUNT', 'PLATELET COUNT', 'GLUCOSE']

const CATEGORIES = {
  brain: {
    id: 'brain',
    title: 'Brain & balance',
    purpose: 'Sleep and the stress hormone, plus how weightlessness affects the head and eyes.',
    icon: Brain,
  },
  heart: {
    id: 'heart',
    title: 'Blood & heart',
    purpose: 'Heart rate, oxygen, the released blood panel, and a glucose forecast.',
    icon: HeartPulse,
  },
  radiation: {
    id: 'radiation',
    title: 'Radiation & temperature',
    purpose: 'Vehicle dose rate, solar particle events, and body temperature.',
    icon: Radiation,
  },
  muscles: {
    id: 'muscles',
    title: 'Muscles & bones',
    purpose: 'What the public sources say, and an honest empty state for measurements.',
    icon: Bone,
  },
}

function bodyByIds(body, ids) {
  return safeArray(body).filter((region) => ids.includes(region.id))
}

function UnknownCategory({ categoria }) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">Category</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Unknown category</h1>
        <p className="mt-1 text-sm text-slate-400">“{categoria}” is not a category on this board.</p>
      </header>

      <Card title="Available categories" subtitle="Pick one of the four crew-health areas.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {Object.values(CATEGORIES).map((item) => (
            <li key={item.id}>
              <Link
                to={`/dashboard/${item.id}`}
                className="block rounded-xl border border-white/10 bg-panel2/60 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-accent/50 hover:text-white"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Link to="/dashboard" className="text-xs font-medium text-cyan-300 underline decoration-dotted">
        Back to the overview board
      </Link>
    </div>
  )
}

// ---- Heart -----------------------------------------------------------------

function buildTrendData(trends) {
  const timepoints = safeArray(trends?.timepoints)
  const traces = safeArray(trends?.traces)

  return timepoints.map((timepoint, index) => {
    const row = { timepoint, refLow: null, refSpan: null }
    traces.forEach((trace) => {
      const value = trace?.y?.[index]
      row[trace.name] = typeof value === 'number' ? value : null

      const low = trace?.ref_low?.[index]
      const high = trace?.ref_high?.[index]
      if (typeof low === 'number' && typeof high === 'number' && low <= high && row.refLow === null) {
        row.refLow = low
        row.refSpan = high - low
      }
    })
    return row
  })
}

function GlucoseChart({ trends, viewer }) {
  const data = buildTrendData(trends)
  const traces = safeArray(trends?.traces)
  const unit = trends?.unit ?? 'mg/dL'

  if (data.length === 0 || traces.length === 0) {
    return (
      <Card title="Glucose across the crew" subtitle="Released OSD-575 draws.">
        <Empty>No glucose traces returned by the API.</Empty>
      </Card>
    )
  }

  const last = data[data.length - 1]
  const latestValues = traces
    .map((trace) => last?.[trace.name])
    .filter((value) => typeof value === 'number')
  const low = last?.refLow
  const high = typeof low === 'number' && typeof last?.refSpan === 'number' ? low + last.refSpan : null
  const hasBand = typeof low === 'number' && typeof high === 'number'
  const inside = hasBand ? latestValues.filter((value) => value >= low && value <= high).length : 0

  const yValues = traces.flatMap((trace) => safeArray(trace.y)).filter((value) => typeof value === 'number')
  if (hasBand) yValues.push(low, high)
  const highest = yValues.length ? Math.max(...yValues) : 99
  // A zero baseline keeps the reference band readable; round the top to a
  // 30 mg/dL step so the axis labels stay tidy.
  const domain = [0, Math.max(120, Math.ceil((highest + 10) / 30) * 30)]

  const takeaway = hasBand
    ? `${inside} of ${latestValues.length} crew traces end inside the ${formatRange(low, high, unit)} reference band. The shaded band is the range stored on each NASA row.`
    : `${latestValues.length} crew traces in the released glucose series. The last draw did not return a reference range.`

  return (
    <ChartFrame
      title="Glucose across the crew"
      subtitle="Released OSD-575 research draws, de-identified. Not a diagnosis."
      provenance="real"
      takeaway={takeaway}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="timepoint" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis {...AXIS_PROPS} width={52} domain={domain} />
        <Tooltip content={<ChartTooltip unit={unit} decimals={1} hide={['refLow', 'refSpan']} />} />
        <Legend {...LEGEND_PROPS} />
        <Area
          type="monotone"
          dataKey="refLow"
          stackId="reference"
          stroke="none"
          fill="none"
          isAnimationActive={false}
          activeDot={false}
          legendType="none"
        />
        <Area
          type="monotone"
          dataKey="refSpan"
          stackId="reference"
          stroke="none"
          fill="#94a3b8"
          fillOpacity={0.12}
          isAnimationActive={false}
          activeDot={false}
          legendType="none"
        />
        {traces.map((trace, index) => (
          <Line
            key={trace.name}
            type="monotone"
            dataKey={trace.name}
            name={trace.name}
            stroke={CREW_COLORS[trace.name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
            strokeWidth={trace.name === viewer ? 3 : 2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ChartFrame>
  )
}

function ForecastPanel({ payload, role, visible, canForecast }) {
  const item = safeArray(payload?.items)[0] ?? null
  const latest = item?.last ?? null
  const next = safeArray(item?.forecasts)[0] ?? item?.plain?.technical?.next_step ?? null
  const unit = latest?.unit ?? item?.plain?.technical?.unit ?? ''
  const sources = item?.plain?.sources ?? []

  return (
    <Card
      title="Next-step forecast"
      subtitle="Straight-line extrapolation on days from launch. Not a physiological model."
      className="min-w-0 overflow-hidden"
      action={<Chip kind="real">Real NASA draws</Chip>}
    >
      {!canForecast ? (
        <Empty>Forecasts are visible to the Self and Flight surgeon roles.</Empty>
      ) : !visible ? (
        <PrivacyNote role={role} scope="forecast" />
      ) : !item || !next ? (
        <Empty>No forecast rows for this crew and analyte.</Empty>
      ) : (
        <div className="space-y-3">
          <StatGrid
            items={[
              {
                label: 'Latest draw',
                value: formatMeasurement(latest?.value),
                unit,
                hint: latest?.timepoint ? `Draw ${latest.timepoint}` : undefined,
              },
              {
                label: 'Next straight-line step',
                value: formatNumber(next.yhat, 2),
                unit,
                hint: typeof next.day === 'number' ? `Day ${formatNumber(next.day, 0)}` : undefined,
              },
              {
                label: '95% interval',
                value: `${formatNumber(next.pi95_low, 2)}–${formatNumber(next.pi95_high, 2)}`,
                unit,
                hint: 'Prediction interval, not a range of normal',
              },
              {
                label: 'Out-of-range risk',
                value: formatPercent(next.p_out_of_range),
                hint: 'Probability the next result falls outside the file range',
              },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <Chip kind={flagKind(latest?.flag)}>{flagLabel(latest?.flag)}</Chip>
            <span>
              Latest {formatMeasurement(latest?.value)} {unit} at {latest?.timepoint ?? '—'} (range{' '}
              {formatRange(latest?.ref_low, latest?.ref_high, unit)})
            </span>
          </div>

          {item?.uncertainty && <p className="text-xs leading-relaxed text-slate-400">{item.uncertainty}</p>}
          {item?.plain?.what_to_do && <p className="text-xs leading-relaxed text-slate-300">{item.plain.what_to_do}</p>}
          <SourceLinks sources={sources} />
        </div>
      )}
    </Card>
  )
}

function HeartSection({ member, role, viewer, data }) {
  const visible = member.visible === 'full'
  const canForecast = role === 'self' || role === 'flight_surgeon'

  return (
    <>
      <VitalsGrid
        readings={member.readings}
        role={role}
        indicators={['heart_rate', 'spo2']}
        title="Heart and oxygen"
        subtitle="Simulated vitals, labelled on each card."
        emptyMessage="No heart rate or oxygen reading for this crew member."
      />

      <LabsTable
        labs={member.labs}
        role={role}
        analytes={HEART_LAB_ANALYTES}
        title="Blood panel"
        subtitle="Released CBC/CMP, de-identified. Reference ranges come from the NASA rows."
        emptyMessage="No haemoglobin, white-cell, platelet, or glucose rows for this crew member."
      />

      <GlucoseChart trends={data?.trends} viewer={viewer} />

      <LabTimeline />

      <ForecastPanel payload={data?.forecast} role={role} visible={visible} canForecast={canForecast} />
    </>
  )
}

// ---- Radiation -------------------------------------------------------------

function buildDailyData(radiation) {
  const daily = radiation?.daily ?? {}
  const days = safeArray(daily.x)
  const means = safeArray(daily.mean_ugy_h)
  const maxes = safeArray(daily.max_ugy_h)

  return days.map((day, index) => ({
    day,
    mean: typeof means[index] === 'number' ? means[index] : null,
    max: typeof maxes[index] === 'number' ? maxes[index] : null,
  }))
}

function RadiationDailyChart({ radiation }) {
  const data = buildDailyData(radiation)
  const unit = 'μGy/h'

  if (data.length === 0) {
    return (
      <Card title="Daily vehicle dose rate" subtitle="ISS DosTel extract.">
        <Empty>No daily dose-rate series returned by the API.</Empty>
      </Card>
    )
  }

  const meanValues = data.map((row) => row.mean).filter((value) => typeof value === 'number')
  const meanLow = meanValues.length ? Math.min(...meanValues) : null
  const meanHigh = meanValues.length ? Math.max(...meanValues) : null
  const peak = data.reduce((best, row) => {
    if (typeof row.max !== 'number') return best
    return !best || row.max > best.max ? row : best
  }, null)

  const takeaway = peak
    ? `Peak daily maximum ${formatNumber(peak.max, 1)} μGy/h on ${formatDay(peak.day)}. Daily means stay between ${formatNumber(meanLow, 1)} and ${formatNumber(meanHigh, 1)} μGy/h. Bars are the daily mean (left axis), the line is the daily maximum (right axis). Vehicle area dose, never a personal dose.`
    : 'No numeric daily dose-rate values in this payload.'

  return (
    <ChartFrame
      title="Daily vehicle dose rate"
      subtitle="ISS DosTel hourly means reduced to one day per point. Area dose, not a personal dose."
      provenance="real"
      takeaway={takeaway}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="day" {...AXIS_PROPS} tickFormatter={(value) => String(value).slice(5)} />
        <YAxis
          {...AXIS_PROPS}
          yAxisId="mean"
          width={54}
          label={{ value: 'Mean μGy/h', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
        />
        <YAxis
          {...AXIS_PROPS}
          yAxisId="max"
          orientation="right"
          width={54}
          label={{ value: 'Max μGy/h', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 10 }}
        />
        <Tooltip content={<ChartTooltip unit={unit} decimals={1} />} />
        <Legend {...LEGEND_PROPS} />
        <Bar
          yAxisId="mean"
          dataKey="mean"
          name="Daily mean"
          fill="#00e5ff"
          fillOpacity={0.35}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          yAxisId="max"
          type="monotone"
          dataKey="max"
          name="Daily maximum"
          stroke="#fbbf24"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartFrame>
  )
}

function SepByMonthChart({ radiation }) {
  const months = safeArray(radiation?.sep_by_month?.x)
  const counts = safeArray(radiation?.sep_by_month?.y)
  const data = months.map((month, index) => ({ month, events: Number(counts[index]) || 0 }))

  if (data.length === 0) {
    return (
      <Card title="Solar particle events by month" subtitle="DONKI SEP events.">
        <Empty>No monthly SEP series returned by the API.</Empty>
      </Card>
    )
  }

  const total = data.reduce((sum, row) => sum + row.events, 0)
  const peak = data.reduce((best, row) => (!best || row.events > best.events ? row : best), data[0])
  const takeaway = `${total} DONKI solar energetic particle events in the file; ${peak.month} has the most (${peak.events}).`

  return (
    <ChartFrame
      title="Solar particle events by month"
      subtitle="DONKI SEP events in the 2024 extract."
      provenance="real"
      takeaway={takeaway}
      height={220}
    >
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="month" {...AXIS_PROPS} tickFormatter={(value) => String(value).slice(2)} />
        <YAxis {...AXIS_PROPS} width={40} allowDecimals={false} />
        <Tooltip content={<ChartTooltip unit="events" decimals={0} />} />
        <Bar dataKey="events" name="SEP events" fill="#7851a9" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartFrame>
  )
}

function RadiationSummary({ prediction }) {
  const peak = prediction?.peak ?? null
  const nextSep = safeArray(prediction?.sep_after_peak)[0] ?? null
  const cumulative = safeArray(prediction?.cumulative)
  const sources = prediction?.sources ?? []

  return (
    <Card
      title="Radiation summary"
      subtitle="Vehicle monitor and space-weather records from NASA open data."
      className="min-w-0 overflow-hidden"
      action={<Chip kind="real">Real NASA</Chip>}
    >
      <StatGrid
        items={[
          {
            label: 'Peak dose rate',
            value: formatNumber(peak?.absorbed_dose_rate, 1),
            unit: peak?.unit ?? 'μGy/h',
            hint: peak ? `${peak.instrument_id ?? 'Instrument'} · ${formatTimestamp(peak.recorded_at)}` : 'No peak returned',
          },
          {
            label: 'Next SEP in the file',
            value: nextSep ? formatTimestamp(nextSep.event_time) : '—',
            hint: nextSep?.instruments ?? 'No following SEP returned',
          },
          {
            label: '30-day area dose',
            value: formatNumber(cumulative[0]?.area_dose_ugy, 1),
            unit: cumulative[0] ? 'μGy' : undefined,
            hint: 'Area dose, not a personal dose',
          },
        ]}
      />

      {cumulative.length > 0 && (
        <div className="mt-4 max-w-full overflow-x-auto">
          <table className="w-full min-w-[280px] text-left text-sm">
            <caption className="sr-only">Cumulative area dose at 30, 90 and 180 days</caption>
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-slate-400">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Horizon
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Mean rate
                </th>
                <th scope="col" className="py-2 font-medium">
                  Area dose
                </th>
              </tr>
            </thead>
            <tbody>
              {cumulative.map((row) => (
                <tr key={row.days} className="border-b border-white/5 last:border-0">
                  <th scope="row" className="py-2 pr-4 font-normal text-slate-200">
                    {row.days} days
                  </th>
                  <td className="py-2 pr-4 text-slate-300">{formatNumber(row.mean_rate_ugy_h, 2)} μGy/h</td>
                  <td className="py-2 text-white">{formatNumber(row.area_dose_ugy, 1)} μGy</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {cumulative[0]?.label ?? 'Area dose, not a personal dose.'}
          </p>
        </div>
      )}

      {prediction?.plain && (
        <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-200">What this means</summary>
          <div className="mt-2 space-y-1 text-xs leading-relaxed text-slate-400">
            {prediction.plain.what_it_means && <p>{prediction.plain.what_it_means}</p>}
            {prediction.plain.why_it_matters_in_space && <p>{prediction.plain.why_it_matters_in_space}</p>}
            {prediction.plain.what_to_do && <p className="text-slate-300">{prediction.plain.what_to_do}</p>}
            {prediction.plain.confidence && <p>Confidence: {prediction.plain.confidence}</p>}
          </div>
        </details>
      )}

      {prediction?.note && <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{prediction.note}</p>}
      <SourceLinks sources={sources} className="mt-3" />
    </Card>
  )
}

function RadiationSection({ member, role, dashboard, radiation, prediction }) {
  const alerts = safeArray(dashboard?.alerts)
  const [replayAlert, setReplayAlert] = useState(false)

  return (
    <>
      <RadiationReplay onAlertChange={setReplayAlert} />

      {!replayAlert &&
        alerts.map((alert) => <AlertCard key={alert.id ?? alert.title} alert={alert} />)}

      <VitalsGrid
        readings={member.readings}
        role={role}
        indicators={['temperature_c']}
        title="Body temperature"
        subtitle="Simulated vital, labelled on the card."
        emptyMessage="No temperature reading for this crew member."
      />

      <RadiationDailyChart radiation={radiation} />

      <SepByMonthChart radiation={radiation} />

      <RadiationSummary prediction={prediction} />
    </>
  )
}

// ---- Brain and muscles -----------------------------------------------------

function BrainSection({ member, role, body }) {
  return (
    <>
      <Callout>
        The public package has no balance test, EEG, or cognitive score. Sleep and cortisol here are simulated
        estimates, not OSD-575 assays.
      </Callout>

      <VitalsGrid
        readings={member.readings}
        role={role}
        indicators={['sleep_hours', 'cortisol_ug_dl']}
        title="Sleep and cortisol"
        subtitle="Simulated estimates, labelled on each card."
        emptyMessage="No sleep or cortisol estimate for this crew member."
      />

      <BodyMap
        body={bodyByIds(body, ['head', 'eyes'])}
        title="Head and eyes"
        subtitle="What the public sources say, and what to do about it."
        initialId="head"
      />
    </>
  )
}

function MusclesSection({ body }) {
  return (
    <>
      <Card title="No measured bone or muscle values" subtitle="An honest empty state, not a fake number.">
        <Empty>
          This open-data package has no bone-density scan, DXA, or muscle-mass record. The panel below is prevention
          guidance from CSA, HRP, and OCHMO, not a measurement.
        </Empty>
      </Card>

      <BodyMap
        body={bodyByIds(body, ['muscles', 'bones'])}
        title="Muscles and bones"
        subtitle="Prevention guidance from CSA, HRP, and OCHMO."
        initialId="muscles"
      />
    </>
  )
}

// ---- Page ------------------------------------------------------------------

export default function CategoryPage() {
  const { categoria } = useParams()
  const { viewer, role } = useViewer()
  const category = CATEGORIES[categoria]

  const load = useCallback(() => {
    if (!category) return Promise.resolve(null)

    const dashboard = api.dashboard({ viewer, role })

    if (category.id === 'heart') {
      const canForecast = role === 'self' || role === 'flight_surgeon'
      const jobs = [dashboard, api.edaTrends('GLUCOSE')]
      if (canForecast) jobs.push(api.predictLabs({ crew: viewer, analyte: 'GLUCOSE' }))
      return Promise.all(jobs).then(([dashboardData, trends, forecast]) => ({
        dashboard: dashboardData,
        trends,
        forecast: forecast ?? null,
      }))
    }

    if (category.id === 'radiation') {
      return Promise.all([dashboard, api.edaRadiation(), api.predictRadiation()]).then(
        ([dashboardData, radiation, prediction]) => ({
          dashboard: dashboardData,
          radiation,
          prediction,
        }),
      )
    }

    return dashboard.then((dashboardData) => ({ dashboard: dashboardData }))
  }, [viewer, role, category])

  const { data, loading, error, reload } = useFetch(load, [viewer, role, categoria])

  if (!category) return <UnknownCategory categoria={categoria} />
  if (loading) return <Loading label={`Loading the ${category.title.toLowerCase()} panel…`} />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const dashboard = data?.dashboard
  const crew = safeArray(dashboard?.crew)
  const member = crew.find((item) => item.call_sign === viewer) ?? crew[0] ?? null

  if (!member) {
    return <Empty>The API returned no crew member for {viewer}.</Empty>
  }

  return (
    <div className="space-y-6">
      <CategoryHeader category={category} />

      {category.id !== 'radiation' &&
        safeArray(dashboard?.alerts).map((alert) => (
          <AlertCard key={alert.id ?? alert.title} alert={alert} />
        ))}

      {category.id === 'brain' && <BrainSection member={member} role={role} body={dashboard?.body} />}
      {category.id === 'heart' && <HeartSection member={member} role={role} viewer={viewer} data={data} />}
      {category.id === 'radiation' && (
        <RadiationSection
          member={member}
          role={role}
          dashboard={dashboard}
          radiation={data?.radiation}
          prediction={data?.prediction}
        />
      )}
      {category.id === 'muscles' && <MusclesSection body={dashboard?.body} />}
    </div>
  )
}
