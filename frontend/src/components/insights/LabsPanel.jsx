import { useState } from 'react'
import { api } from '../../api'
import Chip from '../Chip'
import { Empty, ErrorState, Loading } from '../StateView'
import useFetch from '../../hooks/useFetch'
import { OutOfRangeChart, ShiftChart, TrendLineChart } from './charts'
import {
  analyteTopic,
  formatValue,
  isOutOfRange,
  matchesLabTopic,
  riskProbability,
  riskMeta,
} from './constants'
import { ChartCard, Details, FlagChip, Note } from './Ui'

export default function LabsPanel({ data, crew, topics, only }) {
  const [picked, setPicked] = useState('')
  const analytes = data?.analytes?.analytes ?? []
  const panelByAnalyte = Object.fromEntries(
    analytes.map((item) => [item.analyte, item.panel]),
  )

  const options = analytes
    .filter((item) => item.panel === 'CBC' || item.panel === 'CMP')
    .filter((item) => topics.has(analyteTopic(item.panel)))
    .map((item) => ({ value: item.analyte, label: `${item.analyte} (${item.panel})` }))
  const selected = options.some((option) => option.value === picked)
    ? picked
    : (options.find((option) => option.value === 'GLUCOSE')?.value ?? options[0]?.value ?? '')

  const {
    data: trend,
    loading: trendLoading,
    error: trendError,
    reload: reloadTrend,
  } = useFetch(() => (selected ? api.edaTrends(selected) : Promise.resolve(null)), [selected])

  const flagRows = (data?.outOfRange?.analyte ?? [])
    .map((analyte, index) => ({
      analyte,
      low: data.outOfRange.low?.[index] ?? 0,
      high: data.outOfRange.high?.[index] ?? 0,
    }))
    .filter((row) => matchesLabTopic(row.analyte, panelByAnalyte, topics))

  const shiftRows = (data?.shift?.analyte ?? [])
    .map((analyte, index) => ({
      analyte,
      unit: data.shift.unit?.[index] ?? '',
      mean_percent: data.shift.mean_percent?.[index] ?? null,
    }))
    .filter((row) => matchesLabTopic(row.analyte, panelByAnalyte, topics))
    .slice(0, 10)

  const traces = (trend?.traces ?? []).filter((trace) => crew.has(trace.name))
  const bandTrace = traces[0]
  const refLow = (bandTrace?.ref_low ?? []).find((value) => typeof value === 'number')
  const refHigh = (bandTrace?.ref_high ?? []).find((value) => typeof value === 'number')

  const risks = (data?.risks?.risks ?? [])
    .filter((risk) => crew.has(risk.crew_id))
    .filter((risk) => topics.has(analyteTopic(risk.panel ?? panelByAnalyte[risk.analyte])))
    .filter(
      (risk) =>
        !only || isOutOfRange(risk.last?.flag) || (risk.flags?.length ?? 0) > 0,
    )
    .map((risk) => ({ ...risk, probability: riskProbability(risk), meta: riskMeta(risk) }))
    .sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1))

  return (
    <div className="space-y-5">
      <ChartCard
        title="Out-of-range flags by test"
        provenance="real"
        summary="Glucose and urea nitrogen flag most often; a low or high flag means the row fell outside the range printed on the lab report."
      >
        {flagRows.length > 0 ? (
          <OutOfRangeChart
            rows={flagRows}
            height={Math.max(280, flagRows.length * 34)}
            label="Stacked low and high lab flags by test"
          />
        ) : (
          <Empty>No lab flags left after the topic filter. Turn on Blood cells or Metabolism.</Empty>
        )}
        <Note>
          Counts are crew-wide. The crew filter applies to the trend lines and the risk rows below.
        </Note>
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Analyte trend"
          provenance="real"
          summary="One line per crew across the seven draws; the shaded band is the range printed on the lab rows."
        >
          {options.length === 0 ? (
            <Empty>No CBC/CMP test matches the topic filter.</Empty>
          ) : (
            <>
              <label
                htmlFor="insights-analyte"
                className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400"
              >
                Test
              </label>
              <select
                id="insights-analyte"
                value={selected}
                onChange={(event) => setPicked(event.target.value)}
                className="mb-3 w-full rounded-lg border border-white/10 bg-panel2 px-2 py-1.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {trendLoading ? (
                <Loading label="Loading the trend…" />
              ) : trendError ? (
                <ErrorState error={trendError} onRetry={reloadTrend} />
              ) : traces.length === 0 ? (
                <Empty>No crew member in this filter has a row for {selected}.</Empty>
              ) : (
                <TrendLineChart
                  timepoints={trend?.timepoints ?? []}
                  traces={traces}
                  refLow={refLow}
                  refHigh={refHigh}
                  unit={trend?.unit}
                  height={280}
                  label={`${selected} values per crew with the printed reference band`}
                />
              )}
              {trend?.reference_note && (
                <Details label="Where the band comes from" className="mt-3">
                  <p>{trend.reference_note}</p>
                </Details>
              )}
            </>
          )}
        </ChartCard>

        <ChartCard
          title="Shift L-3 → R+1"
          provenance="real"
          summary="Positive bars are higher just after the flight than three days before it; negative bars are lower."
        >
          {shiftRows.length > 0 ? (
            <ShiftChart
              rows={shiftRows}
              height={Math.max(280, shiftRows.length * 34)}
              label="Mean percent change from L-3 to R+1 per test"
            />
          ) : (
            <Empty>No shifts left after the topic filter.</Empty>
          )}
          <Note>Crew-mean change. There is no in-flight sample in this extract.</Note>
        </ChartCard>
      </div>

      <ChartCard
        title="Predicted next-draw risk"
        provenance="real"
        summary="Higher percentages mean the straight-line model expects the next draw to fall outside the printed range. It is a model, not a symptom forecast."
      >
        {risks.length === 0 ? (
          <Empty>
            No risk rows match these filters. Try Reset filters, or turn off Only out-of-range.
          </Empty>
        ) : (
          <ol className="grid gap-2 md:grid-cols-2">
            {risks.map((risk) => {
              const percent = risk.probability === null ? null : Math.round(risk.probability * 100)
              return (
                <li
                  key={`${risk.crew_id}-${risk.analyte}`}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-400">{risk.crew_id}</span>
                    <span className="text-sm font-medium text-white">{risk.analyte}</span>
                    {isOutOfRange(risk.last?.flag) ? (
                      <FlagChip flag={risk.last?.flag} />
                    ) : (
                      <Chip kind="neutral">In range at last draw</Chip>
                    )}
                    <span className="ml-auto text-sm font-semibold text-white">
                      {percent === null ? 'No forecast' : `${percent}%`}
                      {percent !== null && (
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          next-draw risk
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Last {formatValue(risk.last?.value, 2)} {risk.last?.unit} at{' '}
                    {risk.last?.timepoint ?? '—'} · {risk.n ?? '—'} draws
                  </p>
                  {percent !== null && (
                    <div
                      aria-hidden="true"
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                    >
                      <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                    </div>
                  )}
                  {risk.plain?.what_it_means && (
                    <Details label="Why this is flagged" className="mt-2">
                      <p>{risk.plain.what_it_means}</p>
                      {risk.meta?.assumption && <p>{risk.meta.assumption}</p>}
                      {risk.uncertainty && <p>{risk.uncertainty}</p>}
                    </Details>
                  )}
                </li>
              )
            })}
          </ol>
        )}
        <Details label="What the model does" className="mt-3">
          <p>
            Each series is fitted with a straight line on its seven observed draws, then sampled at
            the next timepoint. The 95% band is a prediction interval, not a physical model.
          </p>
        </Details>
      </ChartCard>
    </div>
  )
}
