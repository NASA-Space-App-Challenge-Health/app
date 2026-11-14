import Card from '../Card'
import Chip from '../Chip'
import SourceLinks from '../SourceLinks'
import { Empty } from '../StateView'
import { RadiationDailyChart, SepMonthChart } from './charts'
import { formatCount, formatUtc } from './constants'
import { ChartCard, Details, Note } from './Ui'

function peakInstrument(peak) {
  if (!peak) return '—'
  return `${peak.instrument_id ?? 'instrument'} · ${formatUtc(peak.recorded_at)}`
}

function firstInstruments(sep) {
  const text = sep?.instruments
  if (!text) return 'Instruments not listed'
  return String(text).split(';')[0].trim()
}

export default function RadiationPanel({ data, topics }) {
  if (!topics.has('rad')) {
    return (
      <Card title="Radiation" subtitle="ISS DosTel dose rates and DONKI solar events, not a personal dose.">
        <Empty>
          The Radiation topic is off. Turn it on in the filter bar to see the vehicle dose-rate
          charts.
        </Empty>
      </Card>
    )
  }

  const series = data?.radiation ?? {}
  const daily = series.daily ?? { x: [], mean_ugy_h: [], max_ugy_h: [] }
  const sep = series.sep_by_month ?? { x: [], y: [] }
  const predict = data?.predict ?? {}
  const peak = predict.peak
  const cumulative = Array.isArray(predict.cumulative) ? predict.cumulative : []
  const nextSep = Array.isArray(predict.sep_after_peak) ? predict.sep_after_peak[0] : null
  const unit = peak?.unit ?? 'µGy/h'

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-panel/80 p-4 shadow-lg shadow-black/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Peak area dose rate
          </p>
          <p className="mt-1 text-2xl font-bold leading-tight text-white">
            {peak ? `${formatCount(peak.absorbed_dose_rate)} ${unit}` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-400">{peakInstrument(peak)}</p>
          <p className="mt-2 text-[11px] font-medium text-amber-200">
            Area dose rate, not a personal dose.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-panel/80 p-4 shadow-lg shadow-black/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Next solar particle event
          </p>
          <p className="mt-1 text-lg font-bold leading-tight text-white">
            {nextSep ? formatUtc(nextSep.event_time) : 'None in window'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {nextSep ? firstInstruments(nextSep) : 'No SEP record after the peak.'}
          </p>
          <div className="mt-2">
            <Chip kind="real">Real NASA · DONKI</Chip>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-panel/80 p-4 shadow-lg shadow-black/20 md:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Area dose if this week repeated
          </p>
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {[30, 90, 180].map((days) => {
              const item = cumulative.find((entry) => entry.days === days)
              return (
                <li key={days} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                  <span className="block text-[11px] text-slate-400">{days} days</span>
                  <span className="block text-sm font-semibold text-white">
                    {item ? `${formatCount(item.area_dose_ugy)} µGy` : '—'}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[11px] font-medium text-amber-200">
            Area dose from the week&apos;s mean rate, not a personal dose.
          </p>
        </div>
      </div>

      <Note>
        Vehicle measurement from one DosTel instrument. The crew filter does not apply to
        radiation, and these are not personal doses.
      </Note>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Daily dose rate, June 2024"
          summary="The daily maximum jumps far above the daily mean, while the mean stays near 15–25 µGy/h all week."
        >
          <RadiationDailyChart
            daily={daily}
            threshold={predict.spike_threshold_ugy_h}
            unit={unit}
            label="Daily mean and maximum area dose rate for the ISS DosTel week"
          />
          <Details label="What the red rule means" className="mt-3">
            <p>
              {predict.spike_threshold_source
                ? `The ${predict.spike_threshold_ugy_h} ${unit} line is an app setting (${predict.spike_threshold_source}), not a NASA career limit.`
                : 'The red line is an app setting, not a NASA limit.'}
            </p>
            <p>{series.series_note}</p>
          </Details>
        </ChartCard>

        <ChartCard
          title="Solar particle events by month, 2024"
          summary="Solar events appear in 11 of 12 months; October leads with 17, August has 1."
        >
          <SepMonthChart
            x={sep.x}
            y={sep.y}
            label="Count of solar particle events per month in 2024"
          />
          <Details label="What is counted here" className="mt-3">
            <p>
              One bar per calendar month from the DONKI SEP records in the file. These are solar
              events, not readings from the station.
            </p>
            <p>{predict.note}</p>
          </Details>
        </ChartCard>
      </div>

      <Card title="About the radiation record" subtitle="Vehicle dose rate and solar events, linked to the source pages.">
        <p className="text-sm leading-relaxed text-slate-300">
          {predict.plain?.what_it_means ??
            'The DosTel instrument measured the vehicle area dose rate, and DONKI logged solar particle events. Neither is a personal dose.'}
        </p>
        <Details label="Model method and caveats" className="mt-3">
          <p>
            {predict.method ? `Method: ${predict.method} (alpha ${predict.alpha}).` : 'Model method not returned.'}
          </p>
          <p>{predict.note}</p>
          {cumulative[0]?.assumption && <p>{cumulative[0].assumption}</p>}
          <p>
            {predict.spikes_at_or_above_rule?.length ?? 0} hourly readings are at or above the app
            rule of {predict.spike_threshold_ugy_h ?? '—'} {unit}.
          </p>
        </Details>
        <SourceLinks sources={predict.sources} className="mt-3" />
      </Card>
    </div>
  )
}
